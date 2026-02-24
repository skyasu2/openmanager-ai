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
import { getCurrentState, initOTelDataAsync } from './data/precomputed-state';
import { setupIncidentRagBackfill } from './server-incident-rag-backfill';
import { setupTopologyRagBackfill } from './server-topology-rag-backfill';
import { registerGracefulShutdownHandlers } from './server-shutdown';

// Error handling
import { handleUnauthorizedError, jsonSuccess } from './lib/error-handler';

// Rate limiting
import { rateLimitMiddleware } from './middleware/rate-limiter';

// Observability & Resilience
import {
  getLangfuseUsageStatus,
  restoreUsageFromRedis,
  initializeLangfuseClient,
} from './services/observability/langfuse';
import { getAllCircuitStats, resetAllCircuitBreakers } from './services/resilience/circuit-breaker';
import { getAvailableAgentsStatus, preFilterQuery, executeMultiAgent, type MultiAgentRequest } from './services/ai-sdk/agents';

// Routes — lazy loaded after server starts listening
let routesReady = false;

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

/** Timing-safe API key verification (shared across all auth middlewares) */
function verifyApiKey(c: Context): boolean {
  const apiKey = c.req.header('X-API-Key');
  const validKey = process.env.CLOUD_RUN_API_SECRET;
  if (!validKey) {
    logger.error('[Security] CLOUD_RUN_API_SECRET is not configured — blocking request');
    return false;
  }
  if (!apiKey || apiKey.length !== validKey.length ||
      !timingSafeEqual(Buffer.from(apiKey), Buffer.from(validKey))) {
    return false;
  }
  return true;
}

// Security Middleware (Skip for health/warmup) — fail-closed
app.use('/api/*', async (c: Context, next: Next) => {
  if (!verifyApiKey(c)) {
    return handleUnauthorizedError(c);
  }
  await next();
});

// Rate limiting (after auth - only applies to authenticated requests)
app.use('/api/*', rateLimitMiddleware);

// 🎯 Global Error Handler (GCP Cloud Logging)
app.onError((err: Error, c: Context) => {
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
    service: 'ai-engine',
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

/**
 * GET /ready - Readiness Check (routes fully loaded)
 */
app.get('/ready', (c: Context) =>
  routesReady
    ? c.json({ status: 'ready', timestamp: new Date().toISOString() })
    : c.json({ status: 'starting', timestamp: new Date().toISOString() }, 503)
);

// Monitoring endpoint authentication middleware (must be registered BEFORE route handlers)
app.use('/monitoring/*', async (c: Context, next: Next) => {
  if (!verifyApiKey(c)) {
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
  if (process.env.NODE_ENV === 'production' && !verifyApiKey(c)) {
    return c.json({ error: 'Debug endpoints require authentication in production' }, 403);
  }
  await next();
});

// NOTE: /monitoring/* auth middleware is registered above route handlers (before app.get('/monitoring', ...))

/**
 * GET /debug/log-level - Current log level
 */
app.get('/debug/log-level', (c: Context) => {
  const defaultLevel = process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'development' ? 'debug' : 'warn');

  return c.json({
    level: logger.level,
    defaultLevel,
  });
});

/**
 * PUT /debug/log-level - Change log level at runtime
 */
let logLevelResetTimer: ReturnType<typeof setTimeout> | null = null;

app.put('/debug/log-level', async (c: Context) => {
  const validLevels = new Set(['debug', 'info', 'warn', 'error', 'fatal', 'silent']);
  const maxTtlSeconds = 3600;

  let body: { level?: string; ttlSeconds?: number };
  try {
    body = await c.req.json() as { level?: string; ttlSeconds?: number };
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { level, ttlSeconds } = body;

  if (!level || !validLevels.has(level)) {
    return c.json(
      { error: `Invalid level. Valid: ${[...validLevels].join(', ')}` },
      400
    );
  }

  // Clear any previous reset timer to prevent orphaned callbacks
  if (logLevelResetTimer) {
    clearTimeout(logLevelResetTimer);
    logLevelResetTimer = null;
  }

  const previousLevel = logger.level;
  logger.level = level;

  let expiresAt: string | null = null;
  if (ttlSeconds && ttlSeconds > 0) {
    const clampedTtl = Math.min(ttlSeconds, maxTtlSeconds);
    expiresAt = new Date(Date.now() + clampedTtl * 1000).toISOString();
    const defaultLevel = process.env.LOG_LEVEL ||
      (process.env.NODE_ENV === 'development' ? 'debug' : 'warn');
    logLevelResetTimer = setTimeout(() => {
      logger.level = defaultLevel;
      logLevelResetTimer = null;
      logger.warn(`Log level auto-reset to ${defaultLevel} after TTL`);
    }, clampedTtl * 1000);
  }

  logger.warn({ previousLevel, currentLevel: level, expiresAt },
    `Log level changed from ${previousLevel} to ${level}`);

  return c.json({ previousLevel, currentLevel: level, expiresAt });
});

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
// Route Registration (Lazy — loaded after server starts listening)
// ============================================================================

async function registerRoutes() {
  const [
    { supervisorRouter },
    { embeddingRouter },
    { generateRouter },
    { approvalRouter },
    { analyticsRouter },
    { graphragRouter },
    { jobsRouter },
    { feedbackRouter },
    { providersRouter },
  ] = await Promise.all([
    import('./routes/supervisor.js'),
    import('./routes/embedding.js'),
    import('./routes/generate.js'),
    import('./routes/approval.js'),
    import('./routes/analytics.js'),
    import('./routes/graphrag.js'),
    import('./routes/jobs.js'),
    import('./routes/feedback.js'),
    import('./routes/providers.js'),
  ]);

  app.route('/api/ai/supervisor', supervisorRouter);
  app.route('/api/ai/embedding', embeddingRouter);
  app.route('/api/ai/generate', generateRouter);
  app.route('/api/ai/approval', approvalRouter);
  app.route('/api/ai', analyticsRouter);
  app.route('/api/ai/graphrag', graphragRouter);
  app.route('/api/jobs', jobsRouter);
  app.route('/api/ai/feedback', feedbackRouter);
  app.route('/api/ai/providers', providersRouter);

  routesReady = true;
  logger.info('All API routes registered (lazy load complete)');
}

// ============================================================================
// Server Start
// ============================================================================

const port = parseInt(process.env.PORT || '8080', 10);
logger.info({ port }, 'AI Engine Server starting');
logAPIKeyStatus();

// Pre-load OTel data files in parallel (async) to reduce cold start
initOTelDataAsync().catch((err) => {
  logger.warn({ err }, 'OTel async pre-load failed, will fall back to sync reads');
});

// ----------------------------------------------------------------------------
// Deferred Services Initialization (triggered on first API request)
// Langfuse + Redis restore are network-bound — deferring saves 2-5s on cold start
// ----------------------------------------------------------------------------
let servicesInitialized = false;
app.use('/api/*', async (c: Context, next: Next) => {
  if (!servicesInitialized) {
    servicesInitialized = true;

    const langfuseConfig = getLangfuseConfig();
    if (langfuseConfig) {
      logger.info({ baseUrl: langfuseConfig.baseUrl }, 'Langfuse init (deferred)');
      void initializeLangfuseClient().catch((error) => {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          'Langfuse prewarm failed (non-blocking)'
        );
      });
    } else {
      logger.warn('Langfuse not configured - observability disabled');
    }

    void restoreUsageFromRedis().catch(() => {});
  }
  await next();
});

// Start server BEFORE loading routes — /health, /warmup, /ready available immediately
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
        immediateRoutes: ['/health', '/warmup', '/ready'],
      },
      'Server listening (routes loading async...)'
    );
  }
);

// Lazy load API routes after server is already listening
registerRoutes().catch((err) => {
  logger.error({ err }, 'Failed to register API routes');
});

// Periodic incident -> RAG backfill (lightweight, free-tier conscious)
setupIncidentRagBackfill();
setupTopologyRagBackfill();

// ============================================================================
// Graceful Shutdown
// ============================================================================
registerGracefulShutdownHandlers();
