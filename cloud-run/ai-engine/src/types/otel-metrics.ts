/**
 * OTel Metrics Types for Cloud Run AI Engine
 *
 * Vercel의 src/types/otel-metrics.ts에서 필요한 타입만 추출.
 * 빌드 타임에 생성된 OTel JSON 데이터를 런타임에서 소비할 때 사용.
 *
 * @created 2026-02-12
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
// Metric Types (Slim: description, unit 제거)
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
// Hourly File Types
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
