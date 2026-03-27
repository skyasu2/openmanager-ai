import * as z from 'zod';

/**
 * 🤖 AI 서비스 관련 스키마
 *
 * AI 로그 스트리밍, 성능 모니터링, 벤치마크, Cloud Run AI API
 * v5.84.0: Google AI → Cloud Run AI (Mistral) 마이그레이션
 */

// ===== AI 로그 스트리밍 =====

export const AILogLevelSchema = z.enum(['info', 'warn', 'error', 'debug']);

export const AILogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  level: AILogLevelSchema,
  source: z.string(),
  message: z.string(),
  metadata: z
    .object({
      engineId: z.string().optional(),
      processingTime: z.number().optional(),
      confidence: z.string().optional(),
      tokensUsed: z.number().optional(),
    })
    .optional(),
});

export const AILogActionSchema = z.enum(['write', 'clear', 'export']);

export const AILogWriteRequestSchema = z.object({
  action: z.literal('write'),
  logs: z.array(
    AILogEntrySchema.partial().extend({
      level: AILogLevelSchema,
      source: z.string(),
      message: z.string(),
    })
  ),
});

export const AILogClearRequestSchema = z.object({
  action: z.literal('clear'),
});

export const AILogExportRequestSchema = z.object({
  action: z.literal('export'),
});

export const AILogRequestSchema = z.discriminatedUnion('action', [
  AILogWriteRequestSchema,
  AILogClearRequestSchema,
  AILogExportRequestSchema,
]);

export const AILogWriteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
});

export const AILogExportResponseSchema = z.object({
  success: z.boolean(),
  logs: z.array(AILogEntrySchema),
  count: z.number(),
  timestamp: z.string(),
});

export const AILogResponseSchema = z.union([
  AILogWriteResponseSchema,
  AILogExportResponseSchema,
]);

export const AILogStatsSchema = z.object({
  totalLogs: z.number(),
  errorRate: z.number(),
  avgProcessingTime: z.number(),
  activeEngines: z.array(z.string()),
});

export const AILogStreamMessageSchema = z.object({
  type: z.enum(['logs', 'stats', 'error']),
  data: z.union([z.array(AILogEntrySchema), AILogStatsSchema]).optional(),
  message: z.string().optional(),
  timestamp: z.string(),
  count: z.number().optional(),
  filters: z
    .object({
      level: z.string(),
      source: z.string(),
    })
    .optional(),
});

// ===== AI 성능 모니터링 =====

export const AIPerformanceMetricsSchema = z.object({
  totalQueries: z.number().nonnegative(),
  avgResponseTime: z.number().nonnegative(),
  cacheHitRate: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
  parallelEfficiency: z.number().min(0).max(1),
  optimizationsSaved: z.number().nonnegative(),
});

export const AIOptimizationStatusSchema = z.object({
  warmupCompleted: z.boolean(),
  preloadedEmbeddings: z.number().nonnegative(),
  circuitBreakers: z.number().nonnegative(),
  cacheHitRate: z.number().min(0).max(1),
});

export const AIEngineHealthSchema = z.object({
  id: z.string(),
  status: z.enum(['healthy', 'degraded', 'unavailable']),
  responseTime: z.number().optional(),
  lastCheck: z.string().optional(),
});

export const AIPerformanceStatsResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  service: z.string(),
  metrics: z.object({
    totalQueries: z.number(),
    avgResponseTime: z.number(),
    cacheHitRate: z.number(),
    errorRate: z.number(),
    parallelEfficiency: z.number(),
    optimizationsSaved: z.number(),
  }),
  optimization: z.object({
    warmupCompleted: z.boolean(),
    preloadedEmbeddings: z.number(),
    circuitBreakers: z.number(),
    cacheHitRate: z.number(),
  }),
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'unavailable']),
    engines: z.array(AIEngineHealthSchema),
  }),
  analysis: z.object({
    performanceGrade: z.string(),
    bottlenecks: z.array(z.string()),
    recommendations: z.array(z.string()),
  }),
});

// ===== AI 벤치마크 =====

export const AIBenchmarkRequestSchema = z.object({
  mode: z.enum(['comparison', 'load']).default('comparison'),
  queries: z
    .array(z.string())
    .default(['서버 상태', 'CPU 사용률', '메모리 상태']),
  iterations: z.number().positive().default(3),
});

export const BenchmarkResponseItemSchema = z.object({
  query: z.string(),
  iteration: z.number(),
  responseTime: z.number(),
  success: z.boolean(),
  cached: z.boolean().optional(),
  error: z.string().optional(),
});

export const ComparisonBenchmarkResponseSchema = z.object({
  success: z.boolean(),
  benchmarkType: z.literal('comparison'),
  timestamp: z.string(),
  configuration: z.object({
    queries: z.number(),
    iterations: z.number(),
    totalQueries: z.number(),
  }),
  results: z.object({
    originalEngine: z.object({
      avgResponseTime: z.number(),
      totalTime: z.number(),
      successRate: z.number(),
      responses: z.array(BenchmarkResponseItemSchema),
    }),
    optimizedEngine: z.object({
      avgResponseTime: z.number(),
      totalTime: z.number(),
      successRate: z.number(),
      cacheHitRate: z.number(),
      responses: z.array(BenchmarkResponseItemSchema),
    }),
  }),
  analysis: z.object({
    improvementPercentage: z.number(),
    timeSaved: z.number(),
    performanceBetter: z.boolean(),
    cacheEffectiveness: z.enum(['high', 'medium', 'low']),
  }),
});

export const LoadBenchmarkResponseSchema = z.object({
  success: z.boolean(),
  benchmarkType: z.literal('load'),
  timestamp: z.string(),
  configuration: z.object({
    queries: z.number(),
    iterations: z.number(),
    concurrency: z.number(),
    totalQueries: z.number(),
  }),
  results: z.object({
    totalTime: z.number(),
    avgResponseTime: z.number(),
    successRate: z.number(),
    cacheHitRate: z.number(),
    throughput: z.number(),
    responses: z.array(BenchmarkResponseItemSchema),
  }),
  analysis: z.object({
    performanceGrade: z.enum(['excellent', 'good', 'fair', 'poor']),
    bottlenecks: z.array(z.string()),
    scalability: z.enum(['high', 'medium', 'low']),
  }),
});

export const CacheClearResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  timestamp: z.string(),
  error: z.string().optional(),
});

// ===== Cloud Run AI API =====
// v5.84.0: Migrated from Google AI to Cloud Run (Mistral)

export const CloudRunAIGenerateRequestSchema = z.object({
  prompt: z.string().min(1).max(10000),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().max(10000).default(1000),
  model: z.string().default('mistral-small-latest'),
});

export const CloudRunAIUsageMetadataSchema = z.object({
  totalTokenCount: z.number().optional(),
  promptTokenCount: z.number().optional(),
  completionTokenCount: z.number().optional(),
});

export const CloudRunAIGenerateResponseSchema = z.object({
  success: z.boolean(),
  response: z.string(),
  text: z.string(), // 호환성을 위해 둘 다 제공
  model: z.string(),
  confidence: z.number().min(0).max(1),
  metadata: z.object({
    temperature: z.number(),
    maxTokens: z.number(),
    actualTokens: z.number().optional(),
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    processingTime: z.number(),
  }),
  timestamp: z.string(),
});

export const CloudRunAIErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  timestamp: z.string(),
});

export const CloudRunAIStatusResponseSchema = z.object({
  success: z.boolean(),
  service: z.string(),
  status: z.enum(['active', 'not_configured']),
  configured: z.boolean(),
  models: z.array(z.string()),
  capabilities: z.object({
    textGeneration: z.boolean(),
    streaming: z.boolean(),
    multimodal: z.boolean(),
  }),
  timestamp: z.string(),
});

// ===== 타입 내보내기 =====

// AI 로그 타입
export type AILogLevel = z.infer<typeof AILogLevelSchema>;
export type AILogEntry = z.infer<typeof AILogEntrySchema>;
export type AILogAction = z.infer<typeof AILogActionSchema>;
export type AILogRequest = z.infer<typeof AILogRequestSchema>;
export type AILogWriteResponse = z.infer<typeof AILogWriteResponseSchema>;
export type AILogExportResponse = z.infer<typeof AILogExportResponseSchema>;
export type AILogResponse = z.infer<typeof AILogResponseSchema>;
export type AILogStats = z.infer<typeof AILogStatsSchema>;
export type AILogStreamMessage = z.infer<typeof AILogStreamMessageSchema>;

// AI 성능 모니터링 타입
export type AIPerformanceMetrics = z.infer<typeof AIPerformanceMetricsSchema>;
export type AIOptimizationStatus = z.infer<typeof AIOptimizationStatusSchema>;
export type AIEngineHealth = z.infer<typeof AIEngineHealthSchema>;
export type AIPerformanceStatsResponse = z.infer<
  typeof AIPerformanceStatsResponseSchema
>;

// AI 벤치마크 타입
export type AIBenchmarkRequest = z.infer<typeof AIBenchmarkRequestSchema>;
export type BenchmarkResponseItem = z.infer<typeof BenchmarkResponseItemSchema>;
export type ComparisonBenchmarkResponse = z.infer<
  typeof ComparisonBenchmarkResponseSchema
>;
export type LoadBenchmarkResponse = z.infer<typeof LoadBenchmarkResponseSchema>;
export type CacheClearResponse = z.infer<typeof CacheClearResponseSchema>;

// Cloud Run AI 타입
export type CloudRunAIGenerateRequest = z.infer<
  typeof CloudRunAIGenerateRequestSchema
>;
export type CloudRunAIUsageMetadata = z.infer<
  typeof CloudRunAIUsageMetadataSchema
>;
export type CloudRunAIGenerateResponse = z.infer<
  typeof CloudRunAIGenerateResponseSchema
>;
export type CloudRunAIErrorResponse = z.infer<
  typeof CloudRunAIErrorResponseSchema
>;
export type CloudRunAIStatusResponse = z.infer<
  typeof CloudRunAIStatusResponseSchema
>;
