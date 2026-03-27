import * as z from 'zod';
import { AlertSchema } from './api.alert.schema';
import { ServerStatusSchema } from './api.server.schema';
import { TimestampSchema } from './common.schema';

/**
 * 📊 대시보드 데이터 스키마
 *
 * 시스템 개요, 대시보드 데이터 구조, 전체 현황
 */

// ===== 시스템 개요 =====

export const SystemOverviewSchema = z.object({
  totalServers: z.number().nonnegative(),
  onlineServers: z.number().nonnegative(),
  criticalAlerts: z.number().nonnegative(),
  averageResponseTime: z.number().nonnegative(),
  systemHealth: z.enum(['excellent', 'good', 'warning', 'critical']),
  lastUpdated: TimestampSchema,
});

// ===== 대시보드 서버 스키마 (DashboardDataSchema보다 먼저 선언) =====

export const DashboardServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
  status: z.enum(['online', 'offline', 'critical', 'warning']),
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  disk: z.number().min(0).max(100),
  location: z.string(),
  environment: z.string().optional(),
  metrics: z
    .object({
      cpu: z
        .union([
          z.number(),
          z.object({
            usage: z.number(),
            cores: z.number().optional(),
            temperature: z.number().optional(),
          }),
        ])
        .optional(),
      memory: z
        .union([
          z.number(),
          z.object({ used: z.number(), total: z.number(), usage: z.number() }),
        ])
        .optional(),
      disk: z
        .union([
          z.number(),
          z.object({ used: z.number(), total: z.number(), usage: z.number() }),
        ])
        .optional(),
      network: z
        .object({
          rx: z.number().optional(),
          tx: z.number().optional(),
          bytesIn: z.number().optional(),
          bytesOut: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});

// ===== 대시보드 전체 데이터 =====

export const DashboardOverviewDataSchema = z.object({
  servers: z.array(ServerStatusSchema),
  alerts: z.array(AlertSchema),
  systemOverview: SystemOverviewSchema,
  timestamp: TimestampSchema,
});

// ===== 대시보드 통계 스키마 =====

export const DashboardStatsSchema = z.object({
  totalServers: z.number().nonnegative(),
  onlineServers: z.number().nonnegative(),
  warningServers: z.number().nonnegative(),
  criticalServers: z.number().nonnegative(),
  avgCpu: z.number().min(0).max(100),
  avgMemory: z.number().min(0).max(100),
  avgDisk: z.number().min(0).max(100),
  totalAlerts: z.number().nonnegative(),
  criticalAlerts: z.number().nonnegative(),
  responseTime: z.number().nonnegative(),
});

// ===== 대시보드 데이터 스키마 =====

export const DashboardDataSchema = z.object({
  stats: DashboardStatsSchema,
  servers: z.record(z.string(), DashboardServerSchema), // Server data as key-value pairs with proper schema
  recentAlerts: z.array(AlertSchema),
  systemHealth: z.enum(['excellent', 'good', 'warning', 'critical']),
  timestamp: TimestampSchema,
});

// ===== 대시보드 응답 스키마 =====

export const DashboardResponseSchema = z.object({
  success: z.boolean(),
  data: DashboardDataSchema,
  timestamp: TimestampSchema,
  metadata: z
    .object({
      cacheHit: z.boolean().optional(),
      processingTime: z.number().optional(),
      dataSource: z.string().optional(),
    })
    .optional(),
});

// ===== 대시보드 액션 데이터 스키마 =====

export const DashboardActionDataSchema = z.union([
  // Refresh action data
  z.object({
    serverIds: z.array(z.string()).optional(),
    metrics: z.array(z.enum(['cpu', 'memory', 'disk', 'network'])).optional(),
  }),
  // Reset action data
  z.object({
    resetType: z.enum(['metrics', 'alerts', 'cache', 'all']).optional(),
    confirmation: z.boolean().optional(),
  }),
  // Export action data
  z.object({
    format: z.enum(['json', 'csv', 'xml']).optional(),
    filters: z
      .object({
        dateRange: z
          .object({
            start: z.string(),
            end: z.string(),
          })
          .optional(),
        serverTypes: z.array(z.string()).optional(),
        status: z
          .array(z.enum(['online', 'offline', 'critical', 'warning']))
          .optional(),
      })
      .optional(),
  }),
  // Import action data
  z.object({
    source: z.enum(['file', 'url', 'database']).optional(),
    fileData: z.string().optional(), // Base64 encoded file
    url: z.string().url().optional(),
    mapping: z.record(z.string(), z.string()).optional(), // Field mapping
  }),
]);

// ===== 대시보드 액션 요청 스키마 =====

export const DashboardActionRequestSchema = z.object({
  action: z.enum(['refresh', 'reset', 'export', 'import']),
  targetId: z.string().optional(),
  data: DashboardActionDataSchema.optional(),
  options: z
    .object({
      force: z.boolean().optional(),
      includeMetrics: z.boolean().optional(),
      timeRange: z.string().optional(),
    })
    .optional(),
});

// ===== 대시보드 액션 응답 데이터 스키마 =====

export const DashboardActionResponseDataSchema = z.union([
  // Refresh response data
  z.object({
    refreshedServers: z.array(z.string()),
    metricsUpdated: z.array(z.enum(['cpu', 'memory', 'disk', 'network'])),
    lastUpdate: z.string(),
  }),
  // Reset response data
  z.object({
    resetItems: z.array(z.enum(['metrics', 'alerts', 'cache', 'all'])),
    affectedServers: z.number(),
    resetTimestamp: z.string(),
  }),
  // Export response data
  z.object({
    format: z.enum(['json', 'csv', 'xml']),
    fileSize: z.number(),
    recordCount: z.number(),
    downloadUrl: z.string().optional(),
    exportId: z.string(),
  }),
  // Import response data
  z.object({
    importedRecords: z.number(),
    skippedRecords: z.number(),
    errors: z.array(
      z.object({
        row: z.number(),
        field: z.string(),
        error: z.string(),
      })
    ),
    importId: z.string(),
  }),
]);

// ===== 대시보드 액션 응답 스키마 =====

export const DashboardActionResponseSchema = z.object({
  success: z.boolean(),
  action: z.enum(['refresh', 'reset', 'export', 'import']),
  message: z.string().optional(),
  data: DashboardActionResponseDataSchema.optional(),
  timestamp: TimestampSchema,
});

// ===== 최적화된 대시보드 스키마 =====

export const DashboardOptimizedServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['online', 'warning', 'critical', 'offline']),
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  disk: z.number().min(0).max(100),
  network: z.number().min(0).max(1000),
  type: z.string().optional(),
  lastUpdate: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().optional(),
  environment: z.string().optional(),
});

export const DashboardOptimizedResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    servers: z.record(z.string(), DashboardOptimizedServerSchema),
    stats: z.object({
      total: z.number(),
      online: z.number(),
      warning: z.number(),
      offline: z.number(),
      healthy: z.number().optional(),
      critical: z.number().optional(),
      avgCpu: z.number(),
      avgMemory: z.number(),
      avgDisk: z.number(),
    }),
    lastUpdate: z.string(),
    dataSource: z.string(),
  }),
  metadata: z
    .object({
      responseTime: z.number(),
      cacheHit: z.boolean(),
      redisKeys: z.number(),
      serversLoaded: z.number(),
      optimizationType: z.string(),
      performanceGain: z.string(),
      apiVersion: z.string(),
      scenario: z.string().optional(),
    })
    .optional(),
});

export const DashboardOptimizedErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  metadata: z
    .object({
      responseTime: z.number(),
      serversLoaded: z.number(),
    })
    .optional(),
});

export type DashboardOptimizedServer = z.infer<
  typeof DashboardOptimizedServerSchema
>;
export type DashboardOptimizedResponse = z.infer<
  typeof DashboardOptimizedResponseSchema
>;
export type DashboardOptimizedErrorResponse = z.infer<
  typeof DashboardOptimizedErrorResponseSchema
>;

// ===== 타입 내보내기 =====

export type SystemOverview = z.infer<typeof SystemOverviewSchema>;
export type DashboardOverviewData = z.infer<typeof DashboardOverviewDataSchema>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export type DashboardData = z.infer<typeof DashboardDataSchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
export type DashboardServer = z.infer<typeof DashboardServerSchema>;
export type DashboardActionRequest = z.infer<
  typeof DashboardActionRequestSchema
>;
export type DashboardActionResponse = z.infer<
  typeof DashboardActionResponseSchema
>;
