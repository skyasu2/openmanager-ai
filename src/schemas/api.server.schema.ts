import * as z from 'zod';
import { IdSchema, PercentageSchema, TimestampSchema } from './common.schema';

/**
 * 🖥️ 서버 메트릭 및 상태 스키마
 *
 * 서버 상태, 성능 지표, 네트워크 메트릭, 시스템 모니터링
 */

// ===== 네트워크 메트릭 =====

export const NetworkMetricsSchema = z.object({
  bytesIn: z.number().nonnegative(),
  bytesOut: z.number().nonnegative(),
  packetsIn: z.number().nonnegative(),
  packetsOut: z.number().nonnegative(),
  latency: z.number().nonnegative(),
  connections: z.number().nonnegative(),
  errors: z.number().nonnegative().optional(),
  dropped: z.number().nonnegative().optional(),
});

// ===== 서버 메트릭 =====

export const ServerMetricsSchema = z.object({
  cpu: PercentageSchema,
  memory: PercentageSchema,
  disk: PercentageSchema,
  network: NetworkMetricsSchema,
  processes: z.number().nonnegative(),
  loadAverage: z.tuple([z.number(), z.number(), z.number()]),
  temperature: z.number().optional(),
});

// ===== 서버 상태 =====

export const ServerStatusSchema = z.object({
  id: IdSchema,
  name: z.string(),
  status: z.enum([
    'online',
    'offline',
    'warning',
    'critical',
    'maintenance',
    'unknown',
  ]), // 🔧 수정: 'error' → 'critical', 'unknown' 추가 (타입 통합)
  lastUpdate: TimestampSchema,
  location: z.string(),
  uptime: z.number().nonnegative(),
  metrics: ServerMetricsSchema,
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
// ===== 서버 페이지네이션 스키마 =====

export const ServerPaginationQuerySchema = z.object({
  page: z.number().positive().optional().default(1),
  limit: z.number().positive().max(100).optional().default(20),
  sortBy: z.enum(['name', 'status', 'cpu', 'memory', 'lastUpdate']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  status: z
    .enum([
      'online',
      'offline',
      'warning',
      'critical',
      'maintenance',
      'unknown',
    ]) // 🔧 수정: 'error' → 'critical', 'unknown' 추가
    .optional(),
  search: z.string().optional(),
});

export const ServerPaginatedResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(ServerStatusSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
  timestamp: TimestampSchema,
});

// ===== 서버 배치 작업 스키마 =====

export const ServerBatchRequestSchema = z.object({
  serverIds: z.array(IdSchema),
  action: z.enum([
    'restart',
    'stop',
    'start',
    'update',
    'delete',
    'batch-restart',
    'batch-update',
    'batch-configure',
    'health-check',
  ]),
  options: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(), // Deprecated: use options instead, kept for backward compatibility
});

export const ServerBatchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(
    z.object({
      serverId: IdSchema,
      success: z.boolean(),
      message: z.string().optional(),
      error: z.string().optional(),
    })
  ),
  summary: z.object({
    total: z.number(),
    succeeded: z.number(),
    failed: z.number(),
  }),
  timestamp: TimestampSchema,
});

// ===== 서버 서비스 및 스펙 스키마 =====

export const ServerServiceSchema = z.object({
  name: z.string(),
  status: z.enum(['running', 'stopped', 'error', 'starting', 'stopping']),
  port: z.number().optional(),
  pid: z.number().optional(),
  uptime: z.number().optional(),
  memory: z.number().optional(),
  cpu: z.number().optional(),
});

export const ServerSpecsSchema = z.object({
  cpu: z.object({
    cores: z.number(),
    model: z.string(),
    frequency: z.number().optional(),
  }),
  memory: z.object({
    total: z.number(),
    available: z.number(),
    type: z.string().optional(),
  }),
  disk: z.object({
    total: z.number(),
    available: z.number(),
    type: z.string().optional(),
  }),
  network: z.object({
    interfaces: z.array(z.string()),
    speed: z.number().optional(),
  }),
});

export const ServerHistoryDataPointSchema = z.object({
  timestamp: TimestampSchema,
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
  network: z.number().optional(),
});

export const ServerHistorySchema = z.object({
  serverId: IdSchema,
  timeRange: z.enum(['1h', '6h', '24h', '7d', '30d']),
  data: z.array(ServerHistoryDataPointSchema),
  aggregation: z.enum(['raw', '1m', '5m', '15m', '1h']).optional(),
});

export const PaginatedServerSchema = z.object({
  ...ServerStatusSchema.shape,
  _pagination: z
    .object({
      index: z.number(),
      total: z.number(),
    })
    .optional(),
});

// ===== 타입 내보내기 =====

export type NetworkMetrics = z.infer<typeof NetworkMetricsSchema>;
export type ServerMetrics = z.infer<typeof ServerMetricsSchema>;
export type ServerStatus = z.infer<typeof ServerStatusSchema>;
export type ServerService = z.infer<typeof ServerServiceSchema>;
export type ServerSpecs = z.infer<typeof ServerSpecsSchema>;
export type ServerHistory = z.infer<typeof ServerHistorySchema>;
export type ServerHistoryDataPoint = z.infer<
  typeof ServerHistoryDataPointSchema
>;
export type PaginatedServer = z.infer<typeof PaginatedServerSchema>;

// 페이지네이션 관련 타입 (스키마 이름 불일치 해결)
export type ServerPaginationQuery = z.infer<typeof ServerPaginationQuerySchema>;
export type ServerPaginatedResponse = z.infer<
  typeof ServerPaginatedResponseSchema
>;
export type ServerBatchRequest = z.infer<typeof ServerBatchRequestSchema>;
export type ServerBatchResponse = z.infer<typeof ServerBatchResponseSchema>;

// ===== server-schemas 디렉토리의 스키마들 재수출 =====
export * from './server-schemas/server-details.schema';
