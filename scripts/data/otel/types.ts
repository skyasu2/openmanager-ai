/**
 * OTel Pre-compute 빌드 타임 전용 타입
 *
 * 빌드 스크립트에서만 사용 (@opentelemetry/* 의존 허용).
 * 런타임 타입은 src/types/otel-metrics.ts에 별도 정의.
 *
 * @created 2026-02-11
 */

// 기존 pipeline 타입 re-export
export type {
  HourlyData,
  HourlyDataPoint,
  PrometheusLabels,
  PrometheusMetrics,
  PrometheusNodeInfo,
  PrometheusTarget,
  ScrapeConfig,
} from '../../../src/data/hourly-data/index';

export type {
  AggregatedMetrics,
  ServerTypeStats,
  StatusCounts,
  TopServer,
} from '../../../src/services/monitoring/MetricsAggregator';
export type { Alert, AlertSeverity } from '../../../src/services/monitoring/AlertManager';
export type { HealthGrade, HealthReport } from '../../../src/services/monitoring/HealthCalculator';

// ============================================================================
// OTel Metric Mapping Config
// ============================================================================

export type OTelMetricMapping = {
  prometheus: string;
  otel: string;
  description: string;
  unit: string;
  type: 'gauge' | 'sum';
  transform: (value: number) => number;
};

// ============================================================================
// OTel Output Types (빌드 타임 → JSON 출력)
// ============================================================================

export type OTelResourceAttributes = {
  'service.name': string;
  'host.name': string;
  'host.id': string;
  'host.type': string;
  'os.type': string;
  'os.description': string;
  'cloud.region': string;
  'cloud.availability_zone': string;
  'deployment.environment': string;
  'host.cpu.count'?: number;
  'host.memory.size'?: number;
  'host.disk.size'?: number;
};

export type OTelResourceCatalog = {
  schemaVersion: string;
  generatedAt: string;
  resources: Record<string, OTelResourceAttributes>;
};

export type OTelLogRecord = {
  timeUnixNano: number;
  severityNumber: number;
  severityText: string;
  body: string;
  attributes: Record<string, string | number>;
  resource: string;
};

export type OTelMetricDataPoint = {
  timeUnixNano: number;
  asDouble: number;
  attributes: { 'host.name': string };
};

export type OTelMetric = {
  name: string;
  description: string;
  unit: string;
  type: 'gauge' | 'sum';
  dataPoints: OTelMetricDataPoint[];
};

export type OTelHourlySlot = {
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  metrics: OTelMetric[];
  logs: OTelLogRecord[];
};

export type OTelHourlyFile = {
  schemaVersion: string;
  hour: number;
  scope: { name: string; version: string };
  slots: OTelHourlySlot[];
  aggregated: AggregatedMetrics;
  alerts: Alert[];
  health: HealthReport;
  aiContext: string;
};

export type OTelTimeSeries = {
  schemaVersion: string;
  generatedAt: string;
  serverIds: string[];
  timestamps: number[];
  metrics: Record<string, number[][]>;
};
