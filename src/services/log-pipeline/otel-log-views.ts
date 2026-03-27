/**
 * OTel Log Views — OTel LogRecord to different view formats
 *
 * Transforms OTel LogRecords into:
 * - Syslog view (for Syslog tab display)
 * - Loki entries/streams (for Loki-compatible consumption)
 * - AI-friendly minimal logs (for AI context)
 *
 * @created 2026-02-15
 */

import type {
  LokiLogEntry,
  LokiStream,
  LokiStreamLabels,
  LokiStructuredMetadata,
} from '@/types/loki';
import type { OTelLogRecord } from '@/types/otel-metrics';

// ============================================================================
// Syslog View
// ============================================================================

/** LogEntry for Syslog tab display */
export type SyslogEntry = {
  timestamp: string;
  level: string;
  message: string;
  source: string;
};

/** OTel LogRecord -> Syslog view entry */
export function otelToSyslogView(log: OTelLogRecord): SyslogEntry {
  return {
    timestamp: new Date(log.timeUnixNano / 1_000_000).toISOString(),
    level: log.severityText.toLowerCase(),
    message: log.body,
    source: String(log.attributes['log.source'] ?? 'syslog'),
  };
}

// ============================================================================
// Loki View
// ============================================================================

/** Valid Loki log levels */
const VALID_LOKI_LEVELS = new Set<LokiStreamLabels['level']>([
  'info',
  'warn',
  'error',
  'debug',
]);

/** Map OTel severity to Loki level, defaulting to 'info' */
function toLokiLevel(severityText: string): LokiStreamLabels['level'] {
  const lower = severityText.toLowerCase();
  if (VALID_LOKI_LEVELS.has(lower as LokiStreamLabels['level'])) {
    return lower as LokiStreamLabels['level'];
  }
  // Map common OTel severity variants
  if (lower === 'warning') return 'warn';
  if (lower === 'critical' || lower === 'fatal') return 'error';
  if (lower === 'trace') return 'debug';
  return 'info';
}

/** OTel LogRecord -> Loki log entry */
export function otelToLokiEntry(log: OTelLogRecord): LokiLogEntry {
  const labels: LokiStreamLabels = {
    job: String(log.attributes['log.source'] ?? 'syslog'),
    hostname: log.resource,
    level: toLokiLevel(log.severityText),
    environment: String(
      log.attributes['deployment.environment.name'] ?? 'production'
    ),
    datacenter: String(log.attributes['cloud.availability_zone'] ?? 'unknown'),
    server_type: String(log.attributes['server.role'] ?? 'unknown'),
  };

  const timestampNs = `${log.timeUnixNano}`;
  const timestamp = new Date(log.timeUnixNano / 1_000_000).toISOString();

  const structuredMetadata: LokiStructuredMetadata = {
    trace_id: generateTraceId(),
    instance: `${log.resource}:9100`,
  };

  return { labels, timestampNs, timestamp, line: log.body, structuredMetadata };
}

// ============================================================================
// AI View
// ============================================================================

/** AI-friendly log shape (minimal) */
export type AILogEntry = {
  level: string;
  source: string;
  message: string;
};

/** OTel LogRecord -> AI-friendly log (minimal) */
export function otelToAILog(log: OTelLogRecord): AILogEntry {
  return {
    level: log.severityText.toLowerCase(),
    source: String(log.attributes['log.source'] ?? 'syslog'),
    message: log.body,
  };
}

// ============================================================================
// Loki Streams (grouped)
// ============================================================================

/** Group OTel logs into Loki-compatible streams */
export function groupOTelLogsIntoStreams(logs: OTelLogRecord[]): LokiStream[] {
  const streamMap = new Map<string, LokiStream>();

  for (const log of logs) {
    const entry = otelToLokiEntry(log);
    const key = labelsToKey(entry.labels);

    let stream = streamMap.get(key);
    if (!stream) {
      stream = { stream: { ...entry.labels }, values: [] };
      streamMap.set(key, stream);
    }
    stream.values.push([entry.timestampNs, entry.line]);
  }

  return Array.from(streamMap.values());
}

// ============================================================================
// LogQL Builder
// ============================================================================

/** Build LogQL query from label filters */
export function buildLogQL(filters: Partial<LokiStreamLabels>): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}="${v}"`);
  return parts.length > 0 ? `{${parts.join(', ')}}` : '{}';
}

// ============================================================================
// Internal Helpers
// ============================================================================

function labelsToKey(labels: LokiStreamLabels): string {
  return `${labels.job}|${labels.hostname}|${labels.level}|${labels.environment}|${labels.datacenter}|${labels.server_type}`;
}

function generateTraceId(): string {
  const bytes = new Array<string>(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return bytes.join('');
}
