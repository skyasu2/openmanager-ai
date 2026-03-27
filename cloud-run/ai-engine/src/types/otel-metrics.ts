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
  // --- OTel Semantic Convention standard attributes ---
  'service.name': string;
  'host.name': string;
  'host.id': string;
  'host.arch'?: string; // OTel standard: CPU architecture (e.g. "amd64")
  'os.type': string; // OTel standard: "linux" | "windows" | "darwin"
  'os.description': string;
  'cloud.region': string;
  'cloud.availability_zone': string;
  'deployment.environment.name': string;
  // --- Custom extensions (OTel Registry에 미정의) ---
  'server.role': string; // Custom: 서버 역할 (web, database, cache 등)
  'host.cpu.count'?: number; // Custom: OTel은 system.cpu.logical.count 메트릭으로 표현
  'host.memory.size'?: number; // Custom: OTel은 system.memory.limit 메트릭으로 표현
  'host.disk.size'?: number; // Custom: OTel은 system.filesystem.limit 메트릭으로 표현
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
// Metric Types (Slim: description 제거)
// ============================================================================

export type OTelMetricDataPoint = {
  asDouble: number;
  attributes: { 'host.name': string };
};

export type OTelMetric = {
  name: string;
  unit: string;
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
