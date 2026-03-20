/**
 * Cloud Run AI Engine Server
 *
 * Modular Hono server with route separation.
 * Refactored for maintainability and consistency.
 */

import { serve } from '@hono/node-server';
import { version as APP_VERSION } from '../package.json';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { logger } from './lib/logger';
import { verifyApiKeyValue } from './lib/api-key-auth';

// Configuration
import { logAPIKeyStatus, validateAPIKeys } from './lib/model-config';
import { getConfigStatus, getLangfuseConfig } from './lib/config-parser';
import { isRedisAvailable } from './lib/redis-client';
import { getCurrentState, initOTelDataAsync } from './data/precomputed-state';
import { setupIncidentRagBackfill } from './server-incident-rag-backfill';
import { setupTopologyRagBackfill } from './server-topology-rag-backfill';
import { buildApiNotReadyResponse, shouldBlockApiRequest } from './server-readiness';
import { registerAdminRoutes } from './server-admin-routes';
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
let routeRegistrationFailed = false;
let routeRegistrationFailureReason: string | null = null;

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

function isValidOrigin(origin: string): boolean {
  try {
    const url = new URL(origin.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || [defaultAllowedOrigin])
  .filter(isValidOrigin);

if (allowedOrigins.length === 0) {
  allowedOrigins.push(defaultAllowedOrigin);
}

app.use('*', cors({
  origin: allowedOrigins,
}));

// Guard /api routes while lazy-loaded route modules are still initializing.
app.use('/api/*', async (c: Context, next: Next) => {
  if (shouldBlockApiRequest(c.req.path, routesReady)) {
    const notReady = buildApiNotReadyResponse();
    return c.json(notReady.body, notReady.status, notReady.headers);
  }
  await next();
});

/** Timing-safe API key verification (shared across all auth middlewares) */
function verifyApiKey(c: Context): boolean {
  const apiKey = c.req.header('X-API-Key');
  const validKey = process.env.CLOUD_RUN_API_SECRET;
  if (!validKey) {
    logger.error('[Security] CLOUD_RUN_API_SECRET is not configured — blocking request');
    return false;
  }
  return verifyApiKeyValue(apiKey, validKey);
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
  c.json(
    {
      status: routeRegistrationFailed ? 'degraded' : 'ok',
      service: 'ai-engine',
      version: APP_VERSION,
      config: getConfigStatus(),
      redis: isRedisAvailable(),
      api: {
        routesReady,
        routeRegistrationFailed,
        ...(routeRegistrationFailureReason && {
          failureReason: routeRegistrationFailureReason,
        }),
      },
      timestamp: new Date().toISOString(),
    },
    routeRegistrationFailed ? 503 : 200
  )
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
    keysConfigured: Object.values(status).filter(Boolean).length,
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
registerAdminRoutes(app, verifyApiKey);

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
// Background Observability Initialization
// Start early to shrink cold-start trace gaps without blocking startup.
// ----------------------------------------------------------------------------
const langfuseConfig = getLangfuseConfig();
if (langfuseConfig) {
  logger.info({ baseUrl: langfuseConfig.baseUrl }, 'Langfuse init (background)');
  void initializeLangfuseClient().catch((error) => {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Langfuse prewarm failed (non-blocking)'
    );
  });

  void restoreUsageFromRedis().catch(() => {});
} else {
  logger.warn('Langfuse not configured - observability disabled');
}

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
  routeRegistrationFailed = true;
  routeRegistrationFailureReason =
    err instanceof Error ? err.message : String(err);
  logger.error({ err }, 'Failed to register API routes');
});

// Periodic incident -> RAG backfill (lightweight, free-tier conscious)
setupIncidentRagBackfill();
setupTopologyRagBackfill();

// ============================================================================
// Graceful Shutdown
// ============================================================================
registerGracefulShutdownHandlers();
