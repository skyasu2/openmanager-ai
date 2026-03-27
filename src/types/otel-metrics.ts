/**
 * OTel Metrics Runtime Types (Slim)
 *
 * @opentelemetry/* 패키지에 의존하지 않는 순수 TypeScript 타입.
 * 빌드 타임에 생성된 OTel JSON 데이터를 런타임에서 소비할 때 사용.
 *
 * Slim 포맷: timeUnixNano, description, aggregated/alerts/health/aiContext 제거
 * → 번들 사이즈 ~45% 절감 (196KB → ~110KB/파일)
 *
 * @created 2026-02-11
 * @updated 2026-02-11 - JSON 다이어트 (불필요 필드 제거)
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
  timeUnixNano: number; // OTel standard
  severityNumber: number; // OTel standard (1-24)
  severityText: string; // OTel standard
  body: string; // OTel standard
  attributes: Record<string, string | number>; // log.source: Custom (syslog appname 대응)
  resource: string; // Slim: host.id 참조 (표준은 Resource 객체)
};

// ============================================================================
// Metric Types (Slim: timeUnixNano, description 제거)
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
