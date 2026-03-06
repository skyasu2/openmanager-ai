import * as z from 'zod';
import {
  type DashboardData,
  DashboardDataSchema,
  type HealthCheckResponse,
  HealthCheckResponseSchema,
  type MCPQueryRequest,
  MCPQueryRequestSchema,
  type MCPQueryResponse,
  MCPQueryResponseSchema,
  type ServerMetrics,
  ServerMetricsSchema,
  type ServerStatus,
  ServerStatusSchema,
} from '@/schemas/api.schema';

/**
 * API 응답 타입 호환 레이어
 *
 * 실제 API 계약 SSOT는 `src/schemas/api.schema.ts`를 사용한다.
 * 이 파일은 기존 `@/types/api` import 경로를 유지하기 위한 얇은 래퍼만 제공한다.
 */

// 🌐 기본 API 응답 스키마
export const BaseApiResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string(),
  requestId: z.string().optional(),
  version: z.string().default('1.0.0'),
});

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  BaseApiResponseSchema.extend({
    data: dataSchema.optional(),
    error: z.string().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  });

export type ApiResponse<T = unknown> = {
  readonly success: boolean;
  readonly timestamp: string;
  readonly requestId?: string;
  readonly version: string;
  readonly data?: T;
  readonly error?: string;
  readonly metadata?: Readonly<Record<string, string>>;
};

// 중앙화된 schema/type 재수출
export {
  DashboardDataSchema,
  HealthCheckResponseSchema,
  MCPQueryRequestSchema,
  MCPQueryResponseSchema,
  ServerMetricsSchema,
  ServerStatusSchema,
};

export type {
  DashboardData,
  HealthCheckResponse,
  MCPQueryRequest,
  MCPQueryResponse,
  ServerMetrics,
  ServerStatus,
};

// 🔧 페이지네이션 스키마
export const PaginationSchema = z.object({
  page: z.number().min(1),
  limit: z.number().min(1).max(100),
  total: z.number().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    items: z.array(itemSchema),
    pagination: PaginationSchema,
  });

// 🎯 에러 응답 스키마
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  errorCode: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// 🏥 시스템 헬스 API 응답 타입
export interface SystemHealthAPIResponse {
  status: 'online' | 'warning' | 'critical';
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  services: {
    database: 'operational' | 'degraded' | 'down';
    cache: 'operational' | 'degraded' | 'down';
    ai: 'operational' | 'degraded' | 'down';
  };
  timestamp: string;
  charts?: {
    performanceChart: Array<{ name: string; value: number; color: string }>;
    availabilityChart: { online: number; total: number };
    alertsChart: { bySeverity: Record<string, number> };
    trendsChart: {
      timePoints: string[];
      metrics: { cpu?: number[]; memory?: number[]; alerts?: number[] };
    };
  };
}

// 🛡️ 타입 가드 함수들
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

export function isErrorResponse(
  response: ApiResponse<unknown>
): response is ApiResponse<never> & { success: false; error: string } {
  return response.success === false && response.error !== undefined;
}
