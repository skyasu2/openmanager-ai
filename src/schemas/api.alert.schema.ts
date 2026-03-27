import * as z from 'zod';
import { IdSchema, TimestampSchema } from './common.schema';

/**
 * 🚨 알림 및 경고 스키마
 *
 * 시스템 알림, 경고 수준, 알림 관리, 해결 추적
 */

// ===== 알림 심각도 =====

export const AlertSeveritySchema = z.enum(['info', 'warning', 'critical']);

// ===== 알림 객체 =====

export const AlertSchema = z.object({
  id: IdSchema,
  serverId: IdSchema,
  severity: AlertSeveritySchema,
  type: z.string(),
  message: z.string(),
  timestamp: TimestampSchema,
  resolved: z.boolean(),
  resolvedAt: TimestampSchema.optional(),
  resolvedBy: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ===== 타입 내보내기 =====

export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;
export type Alert = z.infer<typeof AlertSchema>;
