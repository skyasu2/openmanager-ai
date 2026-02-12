/**
 * Prometheus HTTP API Data Format
 * @see https://prometheus.io/docs/prometheus/latest/querying/api/#expression-query-result-formats
 */

export interface PrometheusResponse<T = PrometheusData> {
  status: 'success' | 'error';
  data: T;
  errorType?: string;
  error?: string;
  warnings?: string[];
}

export type PrometheusData = ScalarData | StringData | VectorData | MatrixData;

export interface ScalarData {
  resultType: 'scalar';
  result: [number, string]; // [timestamp, "value"]
}

export interface StringData {
  resultType: 'string';
  result: [number, string];
}

export interface VectorData {
  resultType: 'vector';
  result: MetricSample[];
}

export interface MatrixData {
  resultType: 'matrix';
  result: MetricSeries[];
}

export interface MetricSample {
  metric: Record<string, string>; // Labels
  value: [number, string]; // [timestamp, "value"]
}

export interface MetricSeries {
  metric: Record<string, string>; // Labels
  values: [number, string][]; // Array of [timestamp, "value"]
}

/**
 * VIBE에서 지원할 주요 메트릭 이름 매핑
 */
export const PROMETHEUS_METRIC_NAMES = {
  CPU_USAGE: 'node_cpu_seconds_total', // 흉내내기
  MEMORY_USAGE: 'node_memory_MemTotal_bytes', // 흉내내기
  DISK_USAGE: 'node_filesystem_size_bytes',
} as const;
