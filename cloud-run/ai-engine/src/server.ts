/**
 * Cloud Run AI Engine Server
 *
 * Modular Hono server with route separation.
 * Refactored for maintainability and consistency.
 */

import { timingSafeEqual } from 'node:crypto';
import { serve } from '@hono/node-server';
import { version as APP_VERSION } from '../package.json';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { logger } from './lib/logger';

// Configuration
import { logAPIKeyStatus, validateAPIKeys } from './lib/model-config';
import { getConfigStatus, getLangfuseConfig } from './lib/config-parser';
import { isRedisAvailable } from './lib/redis-client';
import { getCurrentState } from './data/precomputed-state';
import { syncIncidentsToRAG } from './lib/incident-rag-injector';

// Error handling
import { handleUnauthorizedError, jsonSuccess } from './lib/error-handler';

// Rate limiting
import { rateLimitMiddleware } from './middleware/rate-limiter';

// Observability & Resilience
import { flushLangfuse, shutdownLangfuse, getLangfuseUsageStatus, restoreUsageFromRedis, initializeLangfuseClient } from './services/observability/langfuse';
import { getAllCircuitStats, resetAllCircuitBreakers } from './services/resilience/circuit-breaker';
import { getAvailableAgentsStatus, preFilterQuery, executeMultiAgent, type MultiAgentRequest } from './services/ai-sdk/agents';

// Routes
import {
  supervisorRouter,
  embeddingRouter,
  generateRouter,
  approvalRouter,
  analyticsRouter,
  graphragRouter,
  jobsRouter,
  feedbackRouter,
} from './routes';
import { providersRouter } from './routes/providers';

// ============================================================================
// App Initialization
// ============================================================================

const app = new Hono();

// ============================================================================
// Middleware
// ============================================================================

app.use('*', honoLogger());
const defaultAllowedOrigin =
  process.env.DEFAULT_ORIGIN ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://openmanager-ai.vercel.app';

app.use('*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [defaultAllowedOrigin],
}));

// Security Middleware (Skip for health/warmup) — fail-closed
app.use('/api/*', async (c: Context, next: Next) => {
  const apiKey = c.req.header('X-API-Key');
  const validKey = process.env.CLOUD_RUN_API_SECRET;

  if (!validKey) {
    logger.error('[Security] CLOUD_RUN_API_SECRET is not configured — blocking request');
    return handleUnauthorizedError(c);
  }

  if (!apiKey || apiKey.length !== validKey.length ||
      !timingSafeEqual(Buffer.from(apiKey), Buffer.from(validKey))) {
    return handleUnauthorizedError(c);
  }
  await next();
});

// Rate limiting (after auth - only applies to authenticated requests)
app.use('/api/*', rateLimitMiddleware);

// 🎯 Global Error Handler (GCP Cloud Logging)
app.onError((err, c) => {
  logger.error({ err, url: c.req.url, method: c.req.method }, 'Unhandled error');

  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  );
});

// ============================================================================
// Core Endpoints (Non-API)
// ============================================================================

/**
 * GET /health - Health Check
 */
app.get('/health', (c: Context) =>
  c.json({
    status: 'ok',
    service: 'ai-engine-v5',
    version: APP_VERSION,
    config: getConfigStatus(),
    redis: isRedisAvailable(),
    timestamp: new Date().toISOString(),
  })
);

/**
 * GET /warmup - Warm-up Endpoint (Lightweight)
 */
app.get('/warmup', (c: Context) => {
  // Precomputed State load (O(1) - already built)
  const state = getCurrentState();
  // Validate keys
  const status = validateAPIKeys();
  const hasRuntimeState = state.servers.length > 0;

  return jsonSuccess(c, {
    status: 'warmed_up',
    keys: status,
    precomputed: {
      totalSlots: 144, // 24h * 6 (10-min intervals)
      currentSlot: state.slotIndex,
      currentTime: state.timeLabel,
      serverCount: state.servers.length,
      runtimeStateReady: hasRuntimeState,
      summary: state.summary,
    },
  });
});

// Monitoring endpoint authentication middleware (must be registered BEFORE route handlers)
app.use('/monitoring/*', async (c: Context, next: Next) => {
  const apiKey = c.req.header('X-API-Key');
  const validKey = process.env.CLOUD_RUN_API_SECRET;
  if (!validKey || !apiKey || apiKey.length !== validKey.length ||
      !timingSafeEqual(Buffer.from(apiKey), Buffer.from(validKey))) {
    return c.json({ error: 'Monitoring endpoints require authentication' }, 403);
  }
  await next();
});

/**
 * GET /monitoring - Circuit Breaker, Langfuse, Agents & Resilience Status
 */
app.get('/monitoring', (c: Context) => {
  const circuitStats = getAllCircuitStats();
  const langfuseStatus = getLangfuseUsageStatus();
  const agentsStatus = getAvailableAgentsStatus();

  return c.json({
    status: 'ok',
    circuits: circuitStats,
    langfuse: langfuseStatus,
    agents: agentsStatus,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /monitoring/reset - Reset Circuit Breakers (Admin)
 */
app.post('/monitoring/reset', (c: Context) => {
  resetAllCircuitBreakers();

  return jsonSuccess(c, {
    message: 'All circuit breakers reset',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /monitoring/traces - Langfuse 최근 트레이스 조회
 * AI 어시스턴트 테스트 결과 확인용
 */
app.get('/monitoring/traces', async (c: Context) => {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

  if (!publicKey || !secretKey) {
    return c.json({ error: 'Langfuse API keys not configured' }, 500);
  }

  try {
    // Basic Auth: publicKey:secretKey
    const authToken = Buffer.from(`${publicKey}:${secretKey}`).toString('base64');

    // 최근 10개 트레이스 조회
    const response = await fetch(`${baseUrl}/api/public/traces?limit=10`, {
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return c.json({
        error: 'Langfuse API error',
        status: response.status,
        message: errorText,
      }, response.status as 400 | 401 | 403 | 500);
    }

    const data = await response.json();

    // 트레이스 요약 정보만 추출 (보안상 전체 내용은 제외)
    const traces = (data.data || []).map((trace: {
      id: string;
      name: string;
      sessionId?: string;
      input?: string;
      output?: string;
      metadata?: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
    }) => ({
      id: trace.id,
      name: trace.name,
      sessionId: trace.sessionId,
      inputPreview: typeof trace.input === 'string'
        ? trace.input.substring(0, 100) + (trace.input.length > 100 ? '...' : '')
        : '[object]',
      outputPreview: typeof trace.output === 'string'
        ? trace.output.substring(0, 200) + (trace.output.length > 200 ? '...' : '')
        : '[object]',
      metadata: trace.metadata,
      createdAt: trace.createdAt,
      updatedAt: trace.updatedAt,
    }));

    return c.json({
      status: 'ok',
      count: traces.length,
      traces,
      dashboardUrl: `${baseUrl}/project`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      error: 'Failed to fetch Langfuse traces',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Debug/Admin endpoint authentication middleware
// Production: requires API key, Non-production: open access for development
app.use('/debug/*', async (c: Context, next: Next) => {
  if (process.env.NODE_ENV === 'production') {
    const apiKey = c.req.header('X-API-Key');
    const validKey = process.env.CLOUD_RUN_API_SECRET;
    if (!validKey || apiKey !== validKey) {
      return c.json({ error: 'Debug endpoints require authentication in production' }, 403);
    }
  }
  await next();
});

// NOTE: /monitoring/* auth middleware is registered above route handlers (before app.get('/monitoring', ...))

/**
 * GET /debug/prefilter - Test preFilterQuery function
 * Query param: q (the query to test)
 */
app.get('/debug/prefilter', (c: Context) => {
  const query = c.req.query('q') || '서버 상태 요약해줘';
  const result = preFilterQuery(query);
  const agentStatus = getAvailableAgentsStatus();

  return c.json({
    query,
    preFilterResult: result,
    agentStatus,
    expectedBehavior: result.confidence >= 0.8 && result.suggestedAgent
      ? `Forced routing to ${result.suggestedAgent}`
      : result.shouldHandoff
        ? 'LLM orchestrator decides'
        : 'Direct response (fast path)',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /debug/multi-agent - Test executeMultiAgent directly
 * This bypasses the supervisor to test the orchestrator's forced routing
 */
app.post('/debug/multi-agent', async (c: Context) => {
  const body = await c.req.json();
  const query = body.query || '서버 상태 요약해줘';

  const request: MultiAgentRequest = {
    messages: [{ role: 'user', content: query }],
    sessionId: 'debug-test-' + Date.now(),
    enableTracing: false,
  };

  try {
    const result = await executeMultiAgent(request);
    return c.json({
      query,
      result,
      agentStatus: getAvailableAgentsStatus(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      query,
      error: error instanceof Error ? error.message : String(error),
      agentStatus: getAvailableAgentsStatus(),
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

// ============================================================================
// Route Registration
// ============================================================================

// AI Supervisor
app.route('/api/ai/supervisor', supervisorRouter);

// Embedding Service
app.route('/api/ai/embedding', embeddingRouter);

// Generate Service
app.route('/api/ai/generate', generateRouter);

// Human-in-the-Loop Approval
app.route('/api/ai/approval', approvalRouter);

// Analytics (analyze-server, incident-report, analyze-batch)
app.route('/api/ai', analyticsRouter);

// GraphRAG
app.route('/api/ai/graphrag', graphragRouter);

// Async Job Processing
app.route('/api/jobs', jobsRouter);

// Human Feedback → Langfuse
app.route('/api/ai/feedback', feedbackRouter);

// Provider Management (testing/debugging)
app.route('/api/ai/providers', providersRouter);

// ============================================================================
// Server Start
// ============================================================================

const port = parseInt(process.env.PORT || '8080', 10);
logger.info({ port }, 'AI Engine Server starting');
logAPIKeyStatus();

// Initialize Langfuse config (sets env vars from JSON secret)
const langfuseConfig = getLangfuseConfig();
if (langfuseConfig) {
  logger.info({ baseUrl: langfuseConfig.baseUrl }, 'Langfuse initialized');
  initializeLangfuseClient()
    .then(() => {
      logger.info('Langfuse client prewarmed');
    })
    .catch((error) => {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Langfuse prewarm failed (non-blocking)'
      );
    });
} else {
  logger.warn('Langfuse not configured - observability disabled');
}

// Langfuse 사용량 Redis 복원 (fire-and-forget)
restoreUsageFromRedis().catch(() => {});

// Periodic incident -> RAG backfill (lightweight, free-tier conscious)
const enableIncidentRagBackfill =
  process.env.ENABLE_INCIDENT_RAG_BACKFILL !== 'false';
const incidentRagBackfillMinutes = Math.max(
  5,
  Number.parseInt(process.env.INCIDENT_RAG_BACKFILL_MINUTES || '30', 10) || 30
);

if (enableIncidentRagBackfill) {
  let backfillInFlight = false;

  const runIncidentRagBackfill = async () => {
    if (backfillInFlight) return;
    backfillInFlight = true;

    try {
      const result = await syncIncidentsToRAG({ limit: 3, daysBack: 30 });
      if (result.synced > 0 || result.failed > 0) {
        logger.info(
          {
            synced: result.synced,
            skipped: result.skipped,
            failed: result.failed,
            errors: result.errors.slice(0, 3),
          },
          'Incident RAG backfill run'
        );
      }
    } catch (error) {
      logger.warn({ error }, 'Incident RAG backfill failed');
    } finally {
      backfillInFlight = false;
    }
  };

  const initialTimer = setTimeout(() => {
    void runIncidentRagBackfill();
  }, 15_000);
  if (typeof (initialTimer as NodeJS.Timeout).unref === 'function') {
    (initialTimer as NodeJS.Timeout).unref();
  }

  const intervalMs = incidentRagBackfillMinutes * 60 * 1000;
  const intervalTimer = setInterval(() => {
    void runIncidentRagBackfill();
  }, intervalMs);
  if (typeof (intervalTimer as NodeJS.Timeout).unref === 'function') {
    (intervalTimer as NodeJS.Timeout).unref();
  }

  logger.info(
    { incidentRagBackfillMinutes },
    'Incident RAG periodic backfill enabled'
  );
}

serve(
  {
    fetch: app.fetch,
    port,
    hostname: '0.0.0.0', // Required for Cloud Run
  },
  (info: { address: string; port: number }) => {
    logger.info(
      {
        address: info.address,
        port: info.port,
        routes: [
          '/health',
          '/warmup',
          '/monitoring',
          '/api/ai/supervisor',
          '/api/ai/embedding',
          '/api/ai/generate',
          '/api/ai/approval',
          '/api/ai/analyze-server',
          '/api/ai/incident-report',
          '/api/ai/graphrag',
          '/api/ai/providers',
          '/api/jobs',
        ],
      },
      'Server listening'
    );
  }
);

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal');

  const SHUTDOWN_TIMEOUT_MS = 30_000;
  const timeout = setTimeout(() => {
    logger.error('Shutdown timed out after 30s, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    logger.info('Flushing Langfuse traces');
    await flushLangfuse();

    logger.info('Shutting down Langfuse');
    await shutdownLangfuse();

    clearTimeout(timeout);
    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    logger.error({ error }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
