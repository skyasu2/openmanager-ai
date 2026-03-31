import * as z from 'zod';
import { HealthStatusSchema, TimestampSchema } from './common.schema';

/**
 * 🏥 API 헬스체크 스키마
 *
 * 시스템 상태 확인, 서비스 헬스체크, 업타임 모니터링
 */

// ===== 헬스체크 서비스 =====

export const HealthCheckServiceSchema = z.object({
  status: z.enum(['connected', 'disconnected', 'error']),
  latency: z.number().optional(),
  lastCheck: TimestampSchema,
  details: z.string().optional(),
});

export const HealthCheckResponseSchema = z.object({
  status: HealthStatusSchema,
  services: z.record(z.string(), HealthCheckServiceSchema),
  uptime: z.number(),
  version: z.string(),
  timestamp: TimestampSchema,
});

// ===== 메모리 상태 스키마 =====

export const MemorySummarySchema = z.object({
  total: z.number(),
  used: z.number(),
  free: z.number(),
  available: z.number(),
  cached: z.number().optional(),
  buffers: z.number().optional(),
  usage_percentage: z.number().min(0).max(100),
});

export const MemoryStatusResponseSchema = z.object({
  success: z.boolean(),
  memory: MemorySummarySchema,
  swap: z
    .object({
      total: z.number(),
      used: z.number(),
      free: z.number(),
      usage_percentage: z.number().min(0).max(100),
    })
    .optional(),
  processes: z
    .object({
      count: z.number(),
      memory_usage: z.number(),
    })
    .optional(),
  timestamp: TimestampSchema,
});

// ===== 타입 내보내기 (사용 중인 것만 유지) =====

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
