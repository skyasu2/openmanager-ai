import { z } from 'zod';

export const VercelTierSchema = z.enum(['free', 'pro']).default('free');
const TierMaxDurationSecondsSchema = z.number().int().min(1).max(800).default(60);
const FunctionTimeoutReserveSchema = z
  .number()
  .int()
  .min(200)
  .max(10_000)
  .default(1_500);

export const TimeoutConfigSchema = z.object({
  min: z.number().min(1000).max(60000),
  max: z.number().min(1000).max(60000),
  default: z.number().min(1000).max(60000),
});

export const QueryRoutingConfigSchema = z.object({
  complexityThreshold: z.number().min(1).max(100).default(19),
  forceJobQueueKeywords: z.array(z.string()).default([
    '보고서',
    '리포트',
    '근본 원인',
    '장애 분석',
    '전체 분석',
  ]),
});

export const StreamRetryConfigSchema = z.object({
  maxRetries: z.number().min(0).max(5).default(3),
  initialDelayMs: z.number().min(100).max(5000).default(1000),
  backoffMultiplier: z.number().min(1).max(5).default(2),
  maxDelayMs: z.number().min(1000).max(30000).default(10000),
  jitterFactor: z.number().min(0).max(1).default(0.1),
  retryableErrors: z.array(z.string()).default([
    'timeout',
    'ETIMEDOUT',
    'ECONNRESET',
    'fetch failed',
    'socket hang up',
    '504',
    '503',
    'Stream error',
  ]),
});

export const RAGWeightsConfigSchema = z.object({
  vector: z.number().min(0).max(1).default(0.5),
  graph: z.number().min(0).max(1).default(0.3),
  web: z.number().min(0).max(1).default(0.2),
});

export const ObservabilityConfigSchema = z.object({
  enableTraceId: z.boolean().default(true),
  traceIdHeader: z.string().default('X-Trace-Id'),
  verboseLogging: z.boolean().default(false),
});

export const ComplexityCategoryWeightsSchema = z.object({
  analysis: z.number().min(0).max(50).default(20),
  prediction: z.number().min(0).max(50).default(25),
  aggregation: z.number().min(0).max(50).default(15),
  timeRange: z.number().min(0).max(50).default(15),
  multiServer: z.number().min(0).max(50).default(15),
  report: z.number().min(0).max(50).default(20),
  rootCause: z.number().min(0).max(50).default(30),
  ragSearch: z.number().min(0).max(50).default(25),
});

export const AIProxyConfigSchema = z.object({
  tier: VercelTierSchema,
  maxDuration: z.object({
    free: TierMaxDurationSecondsSchema,
    pro: TierMaxDurationSecondsSchema,
  }),
  maxFunctionDurationMs: z.number().int().min(1_000).max(800_000),
  functionTimeoutReserveMs: FunctionTimeoutReserveSchema,
  timeouts: z.object({
    supervisor: TimeoutConfigSchema,
    'incident-report': TimeoutConfigSchema,
    'intelligent-monitoring': TimeoutConfigSchema,
    'analyze-server': TimeoutConfigSchema,
  }),
  cacheTTL: z.object({
    'supervisor-status': z.number().default(300),
    supervisor: z.number().default(1800),
    'incident-report': z.number().default(3600),
    'intelligent-monitoring': z.number().default(600),
  }),
  queryRouting: QueryRoutingConfigSchema,
  streamRetry: StreamRetryConfigSchema,
  ragWeights: RAGWeightsConfigSchema,
  observability: ObservabilityConfigSchema,
  complexityWeights: ComplexityCategoryWeightsSchema,
});

export type VercelTier = z.infer<typeof VercelTierSchema>;
export type TimeoutConfig = z.infer<typeof TimeoutConfigSchema>;
export type AIProxyConfig = z.infer<typeof AIProxyConfigSchema>;
export type ProxyEndpoint = keyof AIProxyConfig['timeouts'];
export type CacheEndpoint = keyof AIProxyConfig['cacheTTL'];
export type QueryRoutingConfig = z.infer<typeof QueryRoutingConfigSchema>;
export type StreamRetryConfig = z.infer<typeof StreamRetryConfigSchema>;
export type RAGWeightsConfig = z.infer<typeof RAGWeightsConfigSchema>;
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
export type ComplexityCategoryWeights = z.infer<typeof ComplexityCategoryWeightsSchema>;

export const FREE_TIER_TIMEOUTS = {
  supervisor: { min: 3000, max: 9000, default: 5000 },
  'incident-report': { min: 5000, max: 9000, default: 7000 },
  'intelligent-monitoring': { min: 3000, max: 9000, default: 5000 },
  'analyze-server': { min: 3000, max: 9000, default: 5000 },
} as const;

export const PRO_TIER_TIMEOUTS = {
  supervisor: { min: 30000, max: 55000, default: 50000 },
  'incident-report': { min: 20000, max: 45000, default: 30000 },
  'intelligent-monitoring': { min: 10000, max: 30000, default: 15000 },
  'analyze-server': { min: 8000, max: 25000, default: 12000 },
} as const;

export const RAG_WEIGHTS_DEFAULT_KEYS = {
  vector: 'AI_RAG_WEIGHT_VECTOR',
  graph: 'AI_RAG_WEIGHT_GRAPH',
  web: 'AI_RAG_WEIGHT_WEB',
} as const;

export const COMPLEXITY_WEIGHTS_DEFAULT_KEYS = {
  analysis: 'AI_COMPLEXITY_WEIGHT_ANALYSIS',
  prediction: 'AI_COMPLEXITY_WEIGHT_PREDICTION',
  aggregation: 'AI_COMPLEXITY_WEIGHT_AGGREGATION',
  timeRange: 'AI_COMPLEXITY_WEIGHT_TIME_RANGE',
  multiServer: 'AI_COMPLEXITY_WEIGHT_MULTI_SERVER',
  report: 'AI_COMPLEXITY_WEIGHT_REPORT',
  rootCause: 'AI_COMPLEXITY_WEIGHT_ROOT_CAUSE',
  ragSearch: 'AI_COMPLEXITY_WEIGHT_RAG_SEARCH',
} as const;

export const DEFAULT_MAX_DURATION_SECONDS: Record<VercelTier, number> = {
  free: 60,
  pro: 300,
};
