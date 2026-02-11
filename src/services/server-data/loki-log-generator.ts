/**
 * Loki-compatible log generator.
 *
 * Wraps the existing `generateServerLogs()` output and transforms it
 * into Loki Push API format. The actual log content stays identical —
 * only the structure changes to match Loki's label-based stream model.
 *
 * Key differences from raw syslog:
 * - hostname is a label, not part of the log line
 * - timestamps use RFC3339Nano + nanosecond string
 * - entries are grouped into streams by label combination
 *
 * @see src/types/loki.ts — type definitions
 * @see src/services/server-data/server-data-logs.ts — upstream generator
 */

import type {
  LokiLogEntry,
  LokiPushPayload,
  LokiStream,
  LokiStreamLabels,
  LokiStructuredMetadata,
} from '@/types/loki';
import { generateServerLogs } from './server-data-logs';
import type { ServerLogEntry } from './server-data-types';

/** Context needed to populate Loki labels from server metadata */
export type ServerContext = {
  hostname: string;
  environment: string;
  datacenter: string;
  serverType: string;
};

/**
 * Convert a ServerLogEntry into a LokiLogEntry.
 *
 * Strips the hostname prefix from the log line (it becomes a label)
 * and adds nanosecond-precision timestamps.
 */
export function toLokiLogEntry(
  entry: ServerLogEntry,
  ctx: ServerContext,
  scenario?: string
): LokiLogEntry {
  const labels: LokiStreamLabels = {
    job: entry.source,
    hostname: ctx.hostname,
    level: entry.level,
    environment: ctx.environment,
    datacenter: ctx.datacenter,
    server_type: ctx.serverType,
  };

  // Strip hostname prefix from log line (e.g. "web-nginx-01 nginx[1234]: msg" → "nginx[1234]: msg")
  const line = stripHostnamePrefix(entry.message, ctx.hostname);

  // Convert ISO timestamp to nanoseconds string
  const timestampMs = new Date(entry.timestamp).getTime();
  const timestampNs = `${timestampMs}000000`; // ms → ns (zero-padded)

  // Extract PID from syslog-style message if present
  const pidMatch = line.match(/\[(\d+)\]/);

  const structuredMetadata: LokiStructuredMetadata = {
    trace_id: generateTraceId(),
    ...(pidMatch ? { pid: pidMatch[1] } : {}),
    ...(scenario ? { scenario } : {}),
    instance: `${ctx.hostname}:9100`,
  };

  return {
    labels,
    timestampNs,
    timestamp: entry.timestamp,
    line,
    structuredMetadata,
  };
}

/**
 * Generate Loki-formatted logs for a server.
 *
 * Uses the existing scenario log generator internally, then converts
 * each entry to Loki format with proper labels and timestamps.
 */
export function generateLokiLogs(
  scenario: string,
  metrics: { cpu: number; memory: number; disk: number; network: number },
  serverId: string,
  ctx: ServerContext
): LokiLogEntry[] {
  const rawLogs = generateServerLogs(scenario, metrics, serverId, {
    stripHostname: true,
    serverType: ctx.serverType,
  });

  return rawLogs.map((entry) => toLokiLogEntry(entry, ctx, scenario));
}

/**
 * Group LokiLogEntry[] into LokiStream[] by label combination.
 *
 * Entries sharing the same {job, hostname, level, environment, datacenter, server_type}
 * are grouped into a single stream — matching how Loki indexes data.
 */
export function groupIntoStreams(entries: LokiLogEntry[]): LokiStream[] {
  const streamMap = new Map<string, LokiStream>();

  for (const entry of entries) {
    const key = labelsToKey(entry.labels);

    let stream = streamMap.get(key);
    if (!stream) {
      stream = {
        stream: { ...entry.labels },
        values: [],
      };
      streamMap.set(key, stream);
    }

    stream.values.push([entry.timestampNs, entry.line]);
  }

  return Array.from(streamMap.values());
}

/**
 * Build a complete Loki Push API payload from log entries.
 */
export function buildLokiPushPayload(entries: LokiLogEntry[]): LokiPushPayload {
  return { streams: groupIntoStreams(entries) };
}

/**
 * Build a LogQL query string from a label filter map.
 *
 * @example
 * buildLogQL({ job: "nginx", level: "error" })
 * // => '{job="nginx", level="error"}'
 */
export function buildLogQL(filters: Partial<LokiStreamLabels>): string {
  const parts = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}="${v}"`);

  return parts.length > 0 ? `{${parts.join(', ')}}` : '{}';
}

// ── Internal helpers ─────────────────────────────────────────────────

/** Remove hostname prefix from a syslog-style log line. */
function stripHostnamePrefix(message: string, hostname: string): string {
  // Match "hostname " at the start of the message
  if (message.startsWith(`${hostname} `)) {
    return message.slice(hostname.length + 1);
  }
  return message;
}

/** Create a deterministic key from label values for stream grouping. */
function labelsToKey(labels: LokiStreamLabels): string {
  return `${labels.job}|${labels.hostname}|${labels.level}|${labels.environment}|${labels.datacenter}|${labels.server_type}`;
}

/** Generate a simulated trace ID (hex, 16 bytes). */
function generateTraceId(): string {
  const bytes = new Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return bytes.join('');
}
