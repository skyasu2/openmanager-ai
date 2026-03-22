/**
 * Server Metrics Schemas (Zod)
 *
 * Response schemas and type exports for server metrics tools.
 *
 * @version 1.0.0
 * @updated 2025-12-28
 */

import { z } from 'zod';

// ============================================================================
// Response Schemas (Best Practice: Structured Output Documentation)
// ============================================================================

/**
 * Server info in response
 */
export const serverInfoSchema = z.object({
  id: z.string().describe('서버 고유 ID'),
  name: z.string().describe('서버 이름'),
  status: z.enum(['online', 'offline', 'warning', 'critical']).describe('서버 상태'),
  cpu: z.number().describe('CPU 사용률 (%)'),
  memory: z.number().describe('메모리 사용률 (%)'),
  disk: z.number().describe('디스크 사용률 (%)'),
});

export const dataSlotSchema = z.object({
  slotIndex: z.number().describe('현재 KST 10분 슬롯 인덱스 (0-143)'),
  minuteOfDay: z.number().describe('현재 KST minuteOfDay (0-1430, 10분 단위)'),
  timeLabel: z.string().describe('현재 synthetic OTel 데이터 슬롯 라벨 (HH:MM KST)'),
});

/**
 * getServerMetrics response schema
 */
export const getServerMetricsResponseSchema = z.object({
  success: z.boolean(),
  servers: z.array(serverInfoSchema),
  summary: z.object({
    total: z.number().describe('전체 서버 수'),
    alertCount: z.number().describe('경고/위험 상태 서버 수'),
  }),
  dataSlot: dataSlotSchema.describe('대시보드와 AI가 함께 참조하는 현재 synthetic OTel 데이터 슬롯'),
  timestamp: z.string().describe('조회 시간 (ISO 8601)'),
});

/**
 * getServerMetricsAdvanced response schema
 */
export const getServerMetricsAdvancedResponseSchema = z.object({
  success: z.boolean(),
  answer: z.string().describe('⚠️ 사용자에게 이 값을 그대로 전달하세요'),
  globalSummary: z.record(z.number()).describe('전체 서버 집계: cpu_avg, cpu_max, cpu_min 등'),
  serverCount: z.number().describe('조회된 서버 수'),
  query: z.object({
    timeRange: z.string().optional(),
    metric: z.string().optional(),
    aggregation: z.string().optional(),
    sortBy: z.string().optional(),
    limit: z.number().optional(),
  }),
  servers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    location: z.string(),
    metrics: z.record(z.number()),
    dataPoints: z.number().optional(),
  })).describe('상위 5개 서버 샘플'),
  hasMore: z.boolean().describe('5개 이상일 때 true'),
  timestamp: z.string(),
});

/**
 * filterServers response schema
 */
export const filterServersResponseSchema = z.object({
  success: z.boolean(),
  condition: z.string().describe('적용된 필터 조건'),
  servers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
  }).passthrough()), // Allow additional fields
  summary: z.object({
    matched: z.number().describe('조건에 맞는 서버 수'),
    returned: z.number().describe('반환된 서버 수'),
    total: z.number().describe('전체 서버 수'),
  }),
  timestamp: z.string(),
});

/**
 * getServerByGroup response schema
 */
export const getServerByGroupAdvancedResponseSchema = z.object({
  success: z.boolean(),
  group: z.string(),
  servers: z.array(serverInfoSchema),
  summary: z.object({
    total: z.number().describe('Total servers in group before filters'),
    online: z.number().describe('Online servers after filters (before limit)'),
    warning: z.number().describe('Warning servers after filters (before limit)'),
    critical: z.number().describe('Critical servers after filters (before limit)'),
    filtered: z.number().describe('Total servers after filters (before limit)'),
    returned: z.number().describe('Actual returned servers (after limit)'),
  }),
  appliedFilters: z.object({
    cpuMin: z.number().optional(),
    cpuMax: z.number().optional(),
    memoryMin: z.number().optional(),
    memoryMax: z.number().optional(),
    status: z.string().optional(),
  }).optional(),
  appliedSort: z.object({
    by: z.string(),
    order: z.string(),
  }).optional(),
  timestamp: z.string(),
});

export const getServerByGroupResponseSchema = z.object({
  success: z.boolean(),
  group: z.string().describe('조회된 서버 그룹/타입'),
  servers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    status: z.enum(['online', 'warning', 'critical']),
    cpu: z.number(),
    memory: z.number(),
    disk: z.number(),
  })),
  summary: z.object({
    total: z.number().describe('해당 그룹 서버 총 수'),
    online: z.number().describe('온라인 상태 수'),
    warning: z.number().describe('경고 상태 수'),
    critical: z.number().describe('위험 상태 수'),
  }),
  timestamp: z.string(),
});

// Export types for external use
export type ServerInfo = z.infer<typeof serverInfoSchema>;
export type GetServerMetricsResponse = z.infer<typeof getServerMetricsResponseSchema>;
export type GetServerMetricsAdvancedResponse = z.infer<typeof getServerMetricsAdvancedResponseSchema>;
export type FilterServersResponse = z.infer<typeof filterServersResponseSchema>;
export type GetServerByGroupResponse = z.infer<typeof getServerByGroupResponseSchema>;
