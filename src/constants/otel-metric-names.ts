/**
 * OTel Semantic Convention Metric Names
 *
 * 메트릭 이름 상수. otel-direct-transform, metric-transformers,
 * prometheus-to-otel 스크립트에서 공유.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/system/system-metrics/
 */

export const OTEL_METRIC = {
  CPU: 'system.cpu.utilization',
  MEMORY: 'system.memory.utilization',
  DISK: 'system.filesystem.utilization',
  NETWORK: 'system.network.io',
  LOAD_1M: 'system.linux.cpu.load_1m',
  LOAD_5M: 'system.linux.cpu.load_5m',
  /** OTel semconv standard alias for LOAD_1M (used in otel-metrics/ OTLP Standard data) */
  LOAD_1M_SEMCONV: 'system.cpu.load_average.1m',
  /** OTel semconv standard alias for LOAD_5M (used in otel-metrics/ OTLP Standard data) */
  LOAD_5M_SEMCONV: 'system.cpu.load_average.5m',
  PROCESSES: 'system.process.count',
  UPTIME: 'system.uptime',
  HTTP_DURATION: 'http.server.request.duration',
} as const;

export type OTelMetricName = (typeof OTEL_METRIC)[keyof typeof OTEL_METRIC];
