/**
 * AI 성능/벤치마크 schema 호환 레이어
 *
 * 실제 SSOT는 `src/schemas/api.ai.schema.ts`다.
 * 기존 import 경로를 유지하면서 중복 정의를 제거한다.
 */

export {
  AIBenchmarkRequestSchema,
  AIEngineHealthSchema,
  AIOptimizationStatusSchema,
  AIPerformanceMetricsSchema,
  AIPerformanceStatsResponseSchema,
  BenchmarkResponseItemSchema,
  CacheClearResponseSchema,
  ComparisonBenchmarkResponseSchema,
  LoadBenchmarkResponseSchema,
} from '../api.ai.schema';

export type {
  AIBenchmarkRequest,
  AIEngineHealth,
  AIOptimizationStatus,
  AIPerformanceMetrics,
  AIPerformanceStatsResponse,
  BenchmarkResponseItem,
  CacheClearResponse,
  ComparisonBenchmarkResponse,
  LoadBenchmarkResponse,
} from '../api.ai.schema';
