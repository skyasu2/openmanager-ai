// ============================================================================
// MetricsProvider Types (from MetricsProvider.ts SRP split, 2026-02-10)
// ============================================================================

import type {
  OTelLogRecord,
  OTelResourceAttributes,
} from '@/types/otel-metrics';

/**
 * 서버 메트릭 (API 응답용)
 * MetricsProvider에서 Prometheus 데이터를 변환한 결과 타입
 */
export interface ApiServerMetrics {
  serverId: string;
  serverType: string;
  location: string;
  timestamp: string; // ISO 8601
  minuteOfDay: number;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  logs: string[];
  status: 'online' | 'warning' | 'critical' | 'offline';
  /** nodeInfo - Prometheus target에서 추출한 하드웨어 정보 */
  nodeInfo?: {
    cpuCores: number;
    memoryTotalBytes: number;
    diskTotalBytes: number;
  };

  // Prometheus 확장 필드 (optional - 하위호환)
  hostname?: string;
  environment?: string;
  os?: string;
  osVersion?: string;
  loadAvg1?: number;
  loadAvg5?: number;
  bootTimeSeconds?: number;
  procsRunning?: number;
  responseTimeMs?: number;

  // OTel 확장 필드 (optional - 사전 계산된 OTel 데이터 사용 시)
  otelResource?: OTelResourceAttributes;
  structuredLogs?: OTelLogRecord[];
}

/** Backward-compatible alias */
export type ServerMetrics = ApiServerMetrics;

/**
 * 전체 시스템 요약
 */
export interface SystemSummary {
  timestamp: string;
  minuteOfDay: number;
  totalServers: number;
  onlineServers: number;
  warningServers: number;
  criticalServers: number;
  offlineServers: number;
  averageCpu: number;
  averageMemory: number;
  averageDisk: number;
  averageNetwork: number;
}

/**
 * 시간 비교 결과 (현재 vs N분 전)
 */
export interface TimeComparisonResult {
  current: {
    timestamp: string;
    date: string;
    metrics: ApiServerMetrics;
  };
  past: {
    timestamp: string;
    date: string;
    metrics: ApiServerMetrics;
  };
  delta: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}
