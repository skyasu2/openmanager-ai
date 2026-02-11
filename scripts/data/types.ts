/**
 * Pre-compute 스크립트용 공유 타입
 *
 * src/ 모듈의 타입을 상대 경로로 re-export.
 * tsx 실행 시 path alias(@/) 사용 불가하므로 상대 경로 사용.
 *
 * @created 2026-02-04
 */

// Prometheus / Hourly Data 타입 (src/data/hourly-data/index.ts)
export type {
  PrometheusMetrics,
  PrometheusLabels,
  PrometheusNodeInfo,
  PrometheusTarget,
  HourlyDataPoint,
  ScrapeConfig,
  HourlyData,
} from '../../src/data/hourly-data/index';

// Monitoring Pipeline 타입
export type { Alert, AlertSeverity } from '../../src/services/monitoring/AlertManager';
export type { AggregatedMetrics, StatusCounts, ServerTypeStats, TopServer } from '../../src/services/monitoring/MetricsAggregator';
export type { HealthReport, HealthGrade } from '../../src/services/monitoring/HealthCalculator';

// Pre-computed Output 타입
export type {
  PrecomputedTimeSeries,
} from '../../src/types/processed-metrics';
