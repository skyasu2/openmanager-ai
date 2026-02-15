/**
 * Loki Push API compatible type definitions.
 *
 * Maps 1:1 to Loki's `POST /loki/api/v1/push` payload format.
 * Used by the server data log generator to produce logs that can be
 * ingested by a real PLG stack (Promtail + Loki + Grafana) without
 * any transformation.
 *
 * @see https://grafana.com/docs/loki/latest/reference/loki-http-api/#ingest-logs
 * @see src/services/log-pipeline/otel-log-views.ts
 */

/** Loki stream labels (indexed, low-cardinality) */
export type LokiStreamLabels = {
  /** Log source process (nginx, kernel, docker, systemd, mysql, redis...) */
  job: string;
  /** Server hostname (e.g. web-nginx-icn-01) */
  hostname: string;
  /** Log severity */
  level: 'info' | 'warn' | 'error' | 'debug';
  /** Deployment environment */
  environment: string;
  /** Datacenter identifier (e.g. Seoul-ICN-AZ1) */
  datacenter: string;
  /** Server role category (web, database, cache...) */
  server_type: string;
};

/** Loki structured metadata (non-indexed, Loki 3.0+) */
export type LokiStructuredMetadata = {
  trace_id?: string;
  pid?: string;
  scenario?: string;
  instance?: string;
};

/** Single log entry (flat structure for UI consumption) */
export type LokiLogEntry = {
  /** Stream labels for this entry */
  labels: LokiStreamLabels;
  /** Unix nanoseconds as string (preserves JS precision) */
  timestampNs: string;
  /** ISO 8601 timestamp for UI display */
  timestamp: string;
  /** Raw log line (hostname excluded — lives in labels) */
  line: string;
  /** Optional structured metadata (Loki 3.0+) */
  structuredMetadata?: LokiStructuredMetadata;
};

/** Loki stream — groups entries sharing the same label set */
export type LokiStream = {
  stream: LokiStreamLabels;
  values: Array<[string, string]>; // [timestampNs, line]
};

/** Loki Push API request body */
export type LokiPushPayload = {
  streams: LokiStream[];
};
