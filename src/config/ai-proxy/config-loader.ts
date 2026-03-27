import { logger } from '@/lib/logging';
import {
  clampTimeoutEnv,
  parseDecimalWithDefault,
  parseNumericWithDefault,
  parseOptionalBooleanEnv,
  parseStringListEnv,
  parseTier,
} from './config-env';
import {
  AIProxyConfigSchema,
  COMPLEXITY_WEIGHTS_DEFAULT_KEYS,
  DEFAULT_MAX_DURATION_SECONDS,
  FREE_TIER_TIMEOUTS,
  PRO_TIER_TIMEOUTS,
  RAG_WEIGHTS_DEFAULT_KEYS,
  type AIProxyConfig,
} from './config-schema';

export function loadAIProxyConfig(): AIProxyConfig {
  const tier = parseTier(
    process.env.VERCEL_TIER?.trim(),
    process.env.VERCEL_PLAN?.trim(),
  );
  const timeouts = tier === 'pro' ? PRO_TIER_TIMEOUTS : FREE_TIER_TIMEOUTS;
  const configuredMaxDurationSeconds = parseNumericWithDefault(
    'AI_MAX_FUNCTION_DURATION_SECONDS',
    DEFAULT_MAX_DURATION_SECONDS[tier],
    (value) => value >= 10 && value <= 800,
  );
  const functionTimeoutReserveMs = parseNumericWithDefault(
    'AI_FUNCTION_TIMEOUT_RESERVE_MS',
    tier === 'pro' ? 2_000 : 1_500,
    (value) => value >= 200 && value <= 10_000,
  );
  const forceJobQueueKeywords = parseStringListEnv('AI_FORCE_JOB_QUEUE_KEYWORDS');

  const rawConfig = {
    tier,
    maxDuration: {
      free: clampTimeoutEnv(configuredMaxDurationSeconds, 10, 300),
      pro: clampTimeoutEnv(configuredMaxDurationSeconds, 10, 800),
    },
    maxFunctionDurationMs: clampTimeoutEnv(
      configuredMaxDurationSeconds * 1_000,
      1_000,
      800_000,
    ),
    functionTimeoutReserveMs,
    timeouts,
    cacheTTL: {
      'supervisor-status': 300,
      supervisor: 1800,
      'incident-report': 3600,
      'intelligent-monitoring': 600,
    },
    queryRouting: {
      complexityThreshold: parseNumericWithDefault(
        'AI_COMPLEXITY_THRESHOLD',
        19,
        (value) => value >= 1 && value <= 100,
      ),
      forceJobQueueKeywords: forceJobQueueKeywords ?? [
        '보고서',
        '리포트',
        '근본 원인',
        '장애 분석',
        '전체 분석',
      ],
    },
    streamRetry: {
      maxRetries: parseNumericWithDefault(
        'AI_STREAM_MAX_RETRIES',
        3,
        (value) => value >= 0 && value <= 5,
      ),
      initialDelayMs: parseNumericWithDefault(
        'AI_STREAM_INITIAL_DELAY',
        1_000,
        (value) => value >= 100 && value <= 5_000,
      ),
      backoffMultiplier: parseNumericWithDefault(
        'AI_STREAM_BACKOFF_MULTIPLIER',
        2,
        (value) => value >= 1 && value <= 5,
      ),
      maxDelayMs: parseNumericWithDefault(
        'AI_STREAM_MAX_DELAY',
        10_000,
        (value) => value >= 1_000 && value <= 30_000,
      ),
      jitterFactor: parseDecimalWithDefault(
        'AI_STREAM_JITTER_FACTOR',
        0.1,
        (value) => value >= 0 && value <= 1,
      ),
      retryableErrors: [
        'timeout',
        'ETIMEDOUT',
        'ECONNRESET',
        'fetch failed',
        'socket hang up',
        '504',
        '503',
        'Stream error',
      ],
    },
    ragWeights: {
      vector: parseDecimalWithDefault(
        RAG_WEIGHTS_DEFAULT_KEYS.vector,
        0.5,
        (value) => value >= 0 && value <= 1,
      ),
      graph: parseDecimalWithDefault(
        RAG_WEIGHTS_DEFAULT_KEYS.graph,
        0.3,
        (value) => value >= 0 && value <= 1,
      ),
      web: parseDecimalWithDefault(
        RAG_WEIGHTS_DEFAULT_KEYS.web,
        0.2,
        (value) => value >= 0 && value <= 1,
      ),
    },
    observability: {
      enableTraceId: parseOptionalBooleanEnv('AI_ENABLE_TRACE_ID') !== false,
      traceIdHeader: process.env.AI_TRACE_ID_HEADER || 'X-Trace-Id',
      verboseLogging: process.env.AI_VERBOSE_LOGGING === 'true',
    },
    complexityWeights: {
      analysis: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.analysis,
        20,
        (value) => value >= 0 && value <= 50,
      ),
      prediction: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.prediction,
        25,
        (value) => value >= 0 && value <= 50,
      ),
      aggregation: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.aggregation,
        15,
        (value) => value >= 0 && value <= 50,
      ),
      timeRange: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.timeRange,
        15,
        (value) => value >= 0 && value <= 50,
      ),
      multiServer: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.multiServer,
        15,
        (value) => value >= 0 && value <= 50,
      ),
      report: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.report,
        20,
        (value) => value >= 0 && value <= 50,
      ),
      rootCause: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.rootCause,
        30,
        (value) => value >= 0 && value <= 50,
      ),
      ragSearch: parseNumericWithDefault(
        COMPLEXITY_WEIGHTS_DEFAULT_KEYS.ragSearch,
        25,
        (value) => value >= 0 && value <= 50,
      ),
    },
  };

  const result = AIProxyConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    logger.error('❌ AI Proxy config validation failed:', result.error.issues);
    throw new Error(
      `Invalid AI Proxy configuration: ${result.error.issues.map((i) => i.message).join(', ')}`,
    );
  }

  return result.data;
}
