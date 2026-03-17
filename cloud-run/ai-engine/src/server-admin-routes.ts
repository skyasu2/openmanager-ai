import type { Context, Hono, Next } from 'hono';

import { logger } from './lib/logger';
import { jsonSuccess } from './lib/error-handler';
import {
  executeMultiAgent,
  getAvailableAgentsStatus,
  preFilterQuery,
  type MultiAgentRequest,
} from './services/ai-sdk/agents';
import {
  getAllCircuitStats,
  resetAllCircuitBreakers,
} from './services/resilience/circuit-breaker';
import {
  getLangfuseClientStatus,
  getLangfuseUsageStatus,
} from './services/observability/langfuse';

let logLevelResetTimer: ReturnType<typeof setTimeout> | null = null;
// Cloud Run egress to Langfuse can exceed 5s on cold network paths.
const DEFAULT_LANGFUSE_TRACES_TIMEOUT_MS = 10_000;
const DEFAULT_LANGFUSE_TRACES_LIMIT = 10;
const MAX_LANGFUSE_TRACES_LIMIT = 100;
const FILTERED_LANGFUSE_TRACES_FETCH_LIMIT = 100;

function getLangfuseTracesTimeoutMs(): number {
  const raw = process.env.LANGFUSE_TRACES_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_LANGFUSE_TRACES_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 100
    ? parsed
    : DEFAULT_LANGFUSE_TRACES_TIMEOUT_MS;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isAuxiliaryLangfuseTrace(name: string): boolean {
  return name.startsWith('timeout_monitor_');
}

function getLangfuseTracesLimit(rawLimit?: string): number {
  if (!rawLimit) {
    return DEFAULT_LANGFUSE_TRACES_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LANGFUSE_TRACES_LIMIT;
  }

  return Math.min(parsed, MAX_LANGFUSE_TRACES_LIMIT);
}

async function fetchLangfuseTraces(
  baseUrl: string,
  authToken: string,
  limit: number,
  timeoutMs = getLangfuseTracesTimeoutMs()
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(`${baseUrl}/api/public/traces?limit=${limit}`, {
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function registerAdminRoutes(
  app: Hono,
  verifyApiKey: (c: Context) => boolean
) {
  app.use('/monitoring/*', async (c: Context, next: Next) => {
    if (!verifyApiKey(c)) {
      return c.json(
        { error: 'Monitoring endpoints require authentication' },
        403
      );
    }
    await next();
  });

  app.get('/monitoring', (c: Context) => {
    const circuitStats = getAllCircuitStats();
    const langfuseStatus = getLangfuseUsageStatus();
    const langfuseClientStatus = getLangfuseClientStatus();
    const agentsStatus = getAvailableAgentsStatus();

    return c.json({
      status: 'ok',
      circuits: circuitStats,
      langfuse: {
        ...langfuseStatus,
        ...langfuseClientStatus,
      },
      agents: agentsStatus,
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/monitoring/reset', (c: Context) => {
    resetAllCircuitBreakers();

    return jsonSuccess(c, {
      message: 'All circuit breakers reset',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/monitoring/traces', async (c: Context) => {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
    const secretKey = process.env.LANGFUSE_SECRET_KEY;
    const baseUrl =
      process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com';

    if (!publicKey || !secretKey) {
      return c.json({ error: 'Langfuse API keys not configured' }, 500);
    }

    try {
      const authToken = Buffer.from(`${publicKey}:${secretKey}`).toString(
        'base64'
      );
      const timeoutMs = getLangfuseTracesTimeoutMs();
      const requestedLimit = getLangfuseTracesLimit(c.req.query('limit'));
      const query = c.req.query('q')?.trim().toLowerCase();
      const includeAuxiliary = c.req.query('includeAuxiliary') === 'true';
      const fetchLimit = query
        ? Math.max(requestedLimit, FILTERED_LANGFUSE_TRACES_FETCH_LIMIT)
        : requestedLimit;
      const response = await fetchLangfuseTraces(
        baseUrl,
        authToken,
        fetchLimit,
        timeoutMs
      );

      if (!response.ok) {
        const errorText = await response.text();
        return c.json(
          {
            error: 'Langfuse API error',
            status: response.status,
            message: errorText,
          },
          response.status as 400 | 401 | 403 | 500
        );
      }

      const data = await response.json();
      const traces = ((data.data || []) as Array<{
        id: string;
        name: string;
        sessionId?: string;
        input?: string;
        output?: string;
        metadata?: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
      }>)
        .map(
        (trace: {
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
          inputPreview:
            typeof trace.input === 'string'
              ? trace.input.substring(0, 100) +
                (trace.input.length > 100 ? '...' : '')
              : '[object]',
          outputPreview:
            typeof trace.output === 'string'
              ? trace.output.substring(0, 200) +
                (trace.output.length > 200 ? '...' : '')
              : '[object]',
          metadata: trace.metadata,
          createdAt: trace.createdAt,
          updatedAt: trace.updatedAt,
        })
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      const visibleBaseTraces = includeAuxiliary
        ? traces
        : traces.filter((trace) => !isAuxiliaryLangfuseTrace(trace.name));

      const filteredTraces = query
        ? visibleBaseTraces.filter((trace) =>
            [trace.id, trace.name, trace.sessionId]
              .filter((value): value is string => typeof value === 'string')
              .some((value) => value.toLowerCase().includes(query))
          )
        : visibleBaseTraces;

      const visibleTraces = filteredTraces.slice(0, requestedLimit);

      return c.json({
        status: 'ok',
        count: visibleTraces.length,
        fetchedCount: traces.length,
        requestedLimit,
        query: query || null,
        includeAuxiliary,
        traces: visibleTraces,
        dashboardUrl: `${baseUrl}/project`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      if (isAbortError(error)) {
        return c.json(
          {
            error: 'Langfuse API timeout',
            message: `Langfuse traces request timed out after ${getLangfuseTracesTimeoutMs()}ms`,
          },
          504
        );
      }

      return c.json(
        {
          error: 'Failed to fetch Langfuse traces',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.use('/debug/*', async (c: Context, next: Next) => {
    if (process.env.NODE_ENV === 'production' && !verifyApiKey(c)) {
      return c.json(
        { error: 'Debug endpoints require authentication in production' },
        403
      );
    }
    await next();
  });

  app.get('/debug/log-level', (c: Context) => {
    const defaultLevel =
      process.env.LOG_LEVEL ||
      (process.env.NODE_ENV === 'development' ? 'debug' : 'warn');

    return c.json({
      level: logger.level,
      defaultLevel,
    });
  });

  app.put('/debug/log-level', async (c: Context) => {
    const validLevels = new Set([
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
      'silent',
      'reset',
    ]);
    const maxTtlSeconds = 3600;

    let body: { level?: string; ttlSeconds?: number };
    try {
      body = (await c.req.json()) as { level?: string; ttlSeconds?: number };
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    const { level, ttlSeconds } = body;
    const defaultLevel =
      process.env.LOG_LEVEL ||
      (process.env.NODE_ENV === 'development' ? 'debug' : 'warn');

    if (!level || !validLevels.has(level)) {
      return c.json(
        { error: `Invalid level. Valid: ${[...validLevels].join(', ')}` },
        400
      );
    }

    if (logLevelResetTimer) {
      clearTimeout(logLevelResetTimer);
      logLevelResetTimer = null;
    }

    const previousLevel = logger.level;
    const resolvedLevel = level === 'reset' ? defaultLevel : level;
    logger.level = resolvedLevel;

    let expiresAt: string | null = null;
    if (level !== 'reset' && ttlSeconds && ttlSeconds > 0) {
      const clampedTtl = Math.min(ttlSeconds, maxTtlSeconds);
      expiresAt = new Date(Date.now() + clampedTtl * 1000).toISOString();
      logLevelResetTimer = setTimeout(() => {
        logger.level = defaultLevel;
        logLevelResetTimer = null;
        logger.warn(`Log level auto-reset to ${defaultLevel} after TTL`);
      }, clampedTtl * 1000);
    }

    logger.warn(
      { previousLevel, currentLevel: resolvedLevel, requestLevel: level, expiresAt },
      `Log level changed from ${previousLevel} to ${resolvedLevel}`
    );

    return c.json({ previousLevel, currentLevel: resolvedLevel, expiresAt });
  });

  app.get('/debug/prefilter', (c: Context) => {
    const query = c.req.query('q') || '서버 상태 요약해줘';
    const result = preFilterQuery(query);
    const agentStatus = getAvailableAgentsStatus();

    return c.json({
      query,
      preFilterResult: result,
      agentStatus,
      expectedBehavior:
        result.confidence >= 0.8 && result.suggestedAgent
          ? `Forced routing to ${result.suggestedAgent}`
          : result.shouldHandoff
            ? 'LLM orchestrator decides'
            : 'Direct response (fast path)',
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/debug/multi-agent', async (c: Context) => {
    const body = (await c.req.json()) as { query?: string };
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
      return c.json(
        {
          query,
          error: error instanceof Error ? error.message : String(error),
          agentStatus: getAvailableAgentsStatus(),
          timestamp: new Date().toISOString(),
        },
        500
      );
    }
  });
}
