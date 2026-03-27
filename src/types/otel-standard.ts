/**
 * 🎯 OpenTelemetry OTLP JSON Metric Data Format (v1)
 *
 * @description
 * OpenTelemetry Protocol (OTLP)의 JSON 포맷 정의.
 * 실제 OTel Collector가 export하는 구조와 동일하게 정의함.
 *
 * Reference: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
 */

// ── Common Types ─────────────────────────────────────────────────────────────

/** Key-Value Pair (Attributes) */
export interface KeyValue {
  key: string;
  value: AnyValue;
}

/** Flexibile Value Type */
export interface AnyValue {
  stringValue?: string;
  boolValue?: boolean;
  intValue?: string; // JSON handles int64 as string
  doubleValue?: number;
  arrayValue?: {
    values: AnyValue[];
  };
  kvlistValue?: {
    values: KeyValue[];
  };
}

/** Resource (e.g. Host, Container, Service) */
export interface Resource {
  attributes: KeyValue[];
  droppedAttributesCount?: number;
}

/** Instrumentation Scope (e.g. library name/version) */
export interface InstrumentationScope {
  name: string;
  version?: string;
  attributes?: KeyValue[];
  droppedAttributesCount?: number;
}

// ── Metrics Data Model ───────────────────────────────────────────────────────

/**
 * Root of OTLP Metric Payload
 * @see https://opentelemetry.io/docs/specs/otlp/#metric-service
 */
export interface ExportMetricsServiceRequest {
  resourceMetrics: ResourceMetrics[];
}

/** Group of metrics by resource */
export interface ResourceMetrics {
  resource: Resource;
  scopeMetrics: ScopeMetrics[];
  schemaUrl?: string;
}

/** Group of metrics by instrumentation scope */
export interface ScopeMetrics {
  scope: InstrumentationScope;
  metrics: Metric[];
  schemaUrl?: string;
}

/** Single Metric Definition */
export interface Metric {
  name: string;
  description?: string;
  unit?: string;
  // One of the following data types must be present:
  gauge?: Gauge;
  sum?: Sum;
  histogram?: Histogram;
  summary?: Summary;
  metadata?: KeyValue[];
}

/** Gauge (Instantaneous value) */
export interface Gauge {
  dataPoints: NumberDataPoint[];
}

/** Sum (Cumulative value) */
export interface Sum {
  dataPoints: NumberDataPoint[];
  aggregationTemporality: AggregationTemporality;
  isMonotonic: boolean;
}

/** Histogram (Distribution) */
export interface Histogram {
  dataPoints: HistogramDataPoint[];
  aggregationTemporality: AggregationTemporality;
}

/** Summary (Quantiles) */
export interface Summary {
  dataPoints: SummaryDataPoint[];
}

// ── Data Points ──────────────────────────────────────────────────────────────

/** Numeric Data Point (Gauge, Sum) */
export interface NumberDataPoint {
  attributes: KeyValue[];
  startTimeUnixNano: string; // uint64 string
  timeUnixNano: string; // uint64 string
  asDouble?: number;
  asInt?: string; // int64 string
  flags?: number; // uint32
}

/** Histogram Data Point */
export interface HistogramDataPoint {
  attributes: KeyValue[];
  startTimeUnixNano: string;
  timeUnixNano: string;
  count: string; // uint64 string
  sum?: number;
  bucketCounts: string[]; // uint64 string array
  explicitBounds: number[];
  flags?: number;
  min?: number;
  max?: number;
}

/** Summary Data Point */
export interface SummaryDataPoint {
  attributes: KeyValue[];
  startTimeUnixNano: string;
  timeUnixNano: string;
  count: string; // uint64 string
  sum: number;
  quantileValues: ValueAtQuantile[];
  flags?: number;
}

export interface ValueAtQuantile {
  quantile: number;
  value: number;
}

/** Aggregation Temporality Enum */
export enum AggregationTemporality {
  AGGREGATION_TEMPORALITY_UNSPECIFIED = 0,
  AGGREGATION_TEMPORALITY_DELTA = 1,
  AGGREGATION_TEMPORALITY_CUMULATIVE = 2,
}
