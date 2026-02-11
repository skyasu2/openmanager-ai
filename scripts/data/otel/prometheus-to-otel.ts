/**
 * Prometheus → OTel Semantic Conventions 메트릭 매핑
 *
 * OTel Semantic Conventions v1.27 기준 매핑.
 * Prometheus 퍼센트(0-100) → OTel ratio(0-1) 변환 포함.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/system/system-metrics/
 * @created 2026-02-11
 */

import type { OTelMetricDataPoint, OTelMetricMapping, PrometheusMetrics } from './types';

// ============================================================================
// Metric Mapping Table
// ============================================================================

export const METRIC_MAPPINGS: OTelMetricMapping[] = [
  {
    prometheus: 'node_cpu_usage_percent',
    otel: 'system.cpu.utilization',
    description: 'CPU utilization ratio (0-1)',
    unit: '1',
    type: 'gauge',
    transform: (v) => Math.round((v / 100) * 10000) / 10000,
  },
  {
    prometheus: 'node_memory_usage_percent',
    otel: 'system.memory.utilization',
    description: 'Memory utilization ratio (0-1)',
    unit: '1',
    type: 'gauge',
    transform: (v) => Math.round((v / 100) * 10000) / 10000,
  },
  {
    prometheus: 'node_filesystem_usage_percent',
    otel: 'system.filesystem.utilization',
    description: 'Filesystem utilization ratio (0-1)',
    unit: '1',
    type: 'gauge',
    transform: (v) => Math.round((v / 100) * 10000) / 10000,
  },
  {
    prometheus: 'node_network_transmit_bytes_rate',
    otel: 'system.network.io',
    description: 'Network transmit bytes per second',
    unit: 'By/s',
    type: 'sum',
    transform: (v) => v,
  },
  {
    prometheus: 'node_load1',
    otel: 'system.cpu.load_average.1m',
    description: '1-minute CPU load average',
    unit: '{thread}',
    type: 'gauge',
    transform: (v) => v,
  },
  {
    prometheus: 'node_load5',
    otel: 'system.cpu.load_average.5m',
    description: '5-minute CPU load average',
    unit: '{thread}',
    type: 'gauge',
    transform: (v) => v,
  },
  {
    prometheus: 'node_procs_running',
    otel: 'system.processes.count',
    description: 'Number of running processes',
    unit: '{process}',
    type: 'gauge',
    transform: (v) => v,
  },
  {
    prometheus: 'node_boot_time_seconds',
    otel: 'system.uptime',
    description: 'System uptime in seconds',
    unit: 's',
    type: 'gauge',
    transform: (bootTime) => {
      const now = Date.now() / 1000;
      return Math.round(now - bootTime);
    },
  },
  {
    prometheus: 'node_http_request_duration_milliseconds',
    otel: 'http.server.request.duration',
    description: 'HTTP request duration in seconds',
    unit: 's',
    type: 'gauge',
    transform: (v) => Math.round((v / 1000) * 10000) / 10000,
  },
  {
    prometheus: 'up',
    otel: 'system.status',
    description: 'System availability status (1=up, 0=down)',
    unit: '1',
    type: 'gauge',
    transform: (v) => v,
  },
];

// Lookup map for quick access
const MAPPING_BY_PROMETHEUS = new Map(
  METRIC_MAPPINGS.map((m) => [m.prometheus, m])
);

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * Prometheus 메트릭을 OTel 데이터 포인트 배열로 변환
 */
export function convertPrometheusToOTel(
  metrics: PrometheusMetrics,
  hostname: string,
  timestampMs: number
): OTelMetricDataPoint[] {
  const timeUnixNano = timestampMs * 1_000_000;
  const dataPoints: OTelMetricDataPoint[] = [];

  for (const mapping of METRIC_MAPPINGS) {
    const rawValue = metrics[mapping.prometheus as keyof PrometheusMetrics];
    if (rawValue === undefined) continue;

    dataPoints.push({
      timeUnixNano,
      asDouble: mapping.transform(rawValue as number),
      attributes: { 'host.name': hostname },
    });
  }

  return dataPoints;
}

/**
 * OTel 이름으로 매핑 조회
 */
export function getMappingByPrometheus(prometheusName: string): OTelMetricMapping | undefined {
  return MAPPING_BY_PROMETHEUS.get(prometheusName);
}

/**
 * OTel 메트릭 이름 → legacy Prometheus 이름으로 역변환
 * (하위호환 시계열 생성용)
 */
export function otelToPrometheusName(otelName: string): string | undefined {
  const mapping = METRIC_MAPPINGS.find((m) => m.otel === otelName);
  return mapping?.prometheus;
}
