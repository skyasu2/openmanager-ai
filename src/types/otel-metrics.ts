/**
 * OTel Metrics Runtime Types (Slim)
 *
 * @opentelemetry/* 패키지에 의존하지 않는 순수 TypeScript 타입.
 * 빌드 타임에 생성된 OTel JSON 데이터를 런타임에서 소비할 때 사용.
 *
 * Slim 포맷: timeUnixNano, description, unit, aggregated/alerts/health/aiContext 제거
 * → 번들 사이즈 ~45% 절감 (196KB → ~110KB/파일)
 *
 * @created 2026-02-11
 * @updated 2026-02-11 - JSON 다이어트 (불필요 필드 제거)
 */

// ============================================================================
// Resource Types
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

// ============================================================================
// Log Types
// ============================================================================

export type OTelLogRecord = {
  timeUnixNano: number;
  severityNumber: number;
  severityText: string;
  body: string;
  attributes: Record<string, string | number>;
  resource: string;
};

// ============================================================================
// Metric Types (Slim: timeUnixNano, description, unit 제거)
// ============================================================================

export type OTelMetricDataPoint = {
  asDouble: number;
  attributes: { 'host.name': string };
};

export type OTelMetric = {
  name: string;
  type: 'gauge' | 'sum';
  dataPoints: OTelMetricDataPoint[];
};

// ============================================================================
// Hourly File Types (Slim: aggregated/alerts/health/aiContext 제거)
// ============================================================================

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
};

// ============================================================================
// TimeSeries Types
// ============================================================================

export type OTelTimeSeries = {
  schemaVersion: string;
  generatedAt: string;
  serverIds: string[];
  timestamps: number[];
  metrics: Record<string, number[][]>;
};
