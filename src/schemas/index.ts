/**
 * 🔒 중앙화된 Zod 스키마 모음
 *
 * 모든 Zod 스키마를 중앙에서 관리하여 재사용성과 일관성 향상
 */

// AI schemas (중복 방지를 위해 선택적 export)
export * from './ai-schemas/ai-performance.schema';
// API schemas - 중복 방지를 위해 필요한 것만 선택적 export
export {
  type MonitoringReportApiResponse,
  MonitoringReportApiResponseSchema,
  type MonitoringReportErrorCode,
  type MonitoringReportErrorResponse,
  MonitoringReportErrorResponseSchema,
  type MonitoringReportResponse,
  MonitoringReportResponseSchema,
} from './api.monitoring-report.schema';
export {
  type CachePerformance,
  CachePerformanceSchema,
  type CacheStats,
  // Cache
  CacheStatsSchema,
  type DashboardData,
  DashboardDataSchema,
  type DashboardResponse,
  DashboardResponseSchema,
  type DashboardStats,
  // Dashboard
  DashboardStatsSchema,
  type ErrorReport,
  type ErrorReportRequest,
  ErrorReportRequestSchema,
  // Error Reporting
  ErrorReportSchema,
  // Types
  type HealthCheckResponse,
  HealthCheckResponseSchema,
  // Health Check
  HealthCheckServiceSchema,
  type MCPQueryRequest,
  // MCP
  MCPQueryRequestSchema,
  type MCPQueryResponse,
  MCPQueryResponseSchema,
  NetworkMetricsSchema as NetworkInfoSchema,
  // Basic Server Types (missing aliases)
  ServerStatusSchema as ServerSchema,
  type SystemOptimizeRequest,
  // System Optimization
  SystemOptimizeRequestSchema,
  type SystemOptimizeResponse,
  SystemOptimizeResponseSchema,
} from './api.schema';

// Auth schemas
export * from './auth.schema';
// Common schemas
export * from './common.schema';
// Monitoring schemas
export * from './monitoring.schema';
// Server schemas (분할된 스키마)
export * from './server-schemas';
// Utils schemas
export * from './utils.schema';
