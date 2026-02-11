/**
 * Pre-computed Metrics Type Definitions
 *
 * hourly-data (Prometheus format) -> otel-precompute pipeline -> processed-metrics
 * - Dashboard (uPlot): PrecomputedTimeSeries
 *
 * @created 2026-02-04
 * @updated 2026-02-11 - PrecomputedHourly, MetricsMetadata 제거 (레거시 파이프라인 삭제)
 */

// ============================================================================
// uPlot Time Series (24h full timeline)
// ============================================================================

/**
 * 전체 24시간 시계열 데이터 (uPlot 소비용)
 *
 * - timestamps: Unix seconds (uPlot 표준), 144개 = 24h x 6슬롯(10분간격)
 * - metrics: [serverIndex][timeIndex] 2D 배열
 */
export type PrecomputedTimeSeries = {
  serverIds: string[];
  timestamps: number[];
  metrics: {
    cpu: number[][];
    memory: number[][];
    disk: number[][];
    network: number[][];
    up: (0 | 1)[][];
  };
};

// ============================================================================
// PromQL Result Types (Internal Query Layer)
// ============================================================================

/**
 * PromQL 쿼리 결과 - instant vector
 */
export type PromQLSample = {
  labels: Record<string, string>;
  value: number;
};

/**
 * PromQL 쿼리 결과 - range vector
 */
export type PromQLRangeSample = {
  labels: Record<string, string>;
  values: Array<[number, number]>;
};

export type PromQLResult = {
  resultType: 'vector' | 'scalar';
  result: PromQLSample[];
};
