import * as z from 'zod';
import { TimestampSchema } from '../common.schema';

/**
 * 📡 서버 상세 정보 API 스키마
 *
 * `/api/servers/[id]` route의 legacy/enhanced 응답 구조를 정의합니다.
 */

const ServiceStatusSchema = z.enum([
  'running',
  'stopped',
  'warning',
  'failed',
  'starting',
  'stopping',
  'error',
  'unknown',
]);

const RuntimeServerStatusSchema = z.enum([
  'online',
  'offline',
  'warning',
  'critical',
  'maintenance',
  'unknown',
]);

// ===== 서버 서비스 정보 =====

export const ServerServiceSchema = z.object({
  name: z.string(),
  status: ServiceStatusSchema,
  port: z.number().optional(),
});

export const ServerSpecsSchema = z.object({
  cpu_cores: z.number(),
  memory_gb: z.number(),
  disk_gb: z.number(),
  os: z.string(),
});

// ===== 서버 상세 쿼리 =====

export const _ServerDetailQuerySchema = z.object({
  history: z.enum(['true', 'false']).optional(),
  range: z.string().optional().default('24h'),
  format: z
    .enum(['enhanced', 'legacy', 'prometheus'])
    .optional()
    .default('enhanced'),
  include_metrics: z.enum(['true', 'false']).optional(),
  include_patterns: z.enum(['true', 'false']).optional(),
});

// ===== 서버 히스토리 =====

export const ServerHistoryDataPointSchema = z.object({
  timestamp: TimestampSchema,
  metrics: z.object({
    cpu_usage: z.number(),
    memory_usage: z.number(),
    disk_usage: z.number(),
    network_in: z.number(),
    network_out: z.number(),
    response_time: z.number(),
  }),
});

export const ServerHistorySchema = z.object({
  time_range: z.string(),
  start_time: TimestampSchema,
  end_time: TimestampSchema,
  interval_ms: z.number(),
  data_points: z.array(ServerHistoryDataPointSchema),
});

// ===== 레거시 서버 응답 =====

export const _LegacyServerResponseSchema = z.object({
  success: z.literal(true),
  server: z.object({
    id: z.string(),
    hostname: z.string(),
    name: z.string(),
    type: z.string(),
    environment: z.string(),
    location: z.string(),
    provider: z.string(),
    status: RuntimeServerStatusSchema,
    cpu: z.number(),
    memory: z.number(),
    disk: z.number(),
    uptime: z.string(),
    lastUpdate: TimestampSchema,
    alerts: z.number(),
    services: z.array(ServerServiceSchema),
    specs: ServerSpecsSchema.optional(),
    os: z.string(),
    ip: z.string().optional(),
    metrics: z.object({
      cpu: z.number(),
      memory: z.number(),
      disk: z.number(),
      network_in: z.number(),
      network_out: z.number(),
      response_time: z.number(),
    }),
  }),
  history: ServerHistorySchema.nullable(),
  meta: z.object({
    format: z.literal('legacy'),
    include_history: z.boolean(),
    range: z.string(),
    timestamp: TimestampSchema,
    processing_time_ms: z.number(),
  }),
});

// ===== 향상된 서버 응답 =====

export const _EnhancedServerResponseSchema = z.object({
  success: z.literal(true),
  meta: z.object({
    request_info: z.object({
      server_id: z.string(),
      format: z.string(),
      include_history: z.boolean(),
      include_metrics: z.boolean(),
      include_patterns: z.boolean(),
      range: z.string(),
      processing_time_ms: z.number(),
      timestamp: TimestampSchema,
    }),
    dataSource: z.string(),
    scenario: z.string(),
  }),
  data: z.object({
    server_info: z.object({
      id: z.string(),
      hostname: z.string(),
      environment: z.string(),
      role: z.string(),
      status: RuntimeServerStatusSchema,
      uptime: z.string(),
      last_updated: TimestampSchema,
    }),
    current_metrics: z.object({
      cpu_usage: z.number(),
      memory_usage: z.number(),
      disk_usage: z.number(),
      network_in: z.number(),
      network_out: z.number(),
      response_time: z.number(),
    }),
    resources: ServerSpecsSchema.optional(),
    network: z.object({
      ip: z.string().optional(),
      hostname: z.string(),
      interface: z.string(),
    }),
    alerts: z.array(z.unknown()),
    services: z.array(ServerServiceSchema),
    pattern_info: z.unknown().nullable().optional(),
    correlation_metrics: z.unknown().nullable().optional(),
    history: ServerHistorySchema.optional(),
  }),
});

// ===== 에러 응답 =====

export const _ServerErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  available_servers: z
    .array(
      z.object({
        id: z.string(),
        hostname: z.string(),
      })
    )
    .optional(),
  timestamp: TimestampSchema,
});

// ===== 타입 내보내기 (사용 중인 것만 유지) =====

export type ServerHistory = z.infer<typeof ServerHistorySchema>;
export type LegacyServerResponse = z.infer<typeof _LegacyServerResponseSchema>;
export type EnhancedServerResponse = z.infer<
  typeof _EnhancedServerResponseSchema
>;
