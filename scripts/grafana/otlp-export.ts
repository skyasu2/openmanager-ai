#!/usr/bin/env tsx
/**
 * OTel Data -> OTLP Export Format Converter
 *
 * Converts OTel-native SSOT data into OTLP HTTP JSON format
 * compatible with Grafana Cloud, self-hosted Grafana, or any OTLP receiver.
 *
 * Usage:
 *   npx tsx scripts/grafana/otlp-export.ts --hour 0      # Single hour
 *   npx tsx scripts/grafana/otlp-export.ts --all          # All 24 hours
 *   npx tsx scripts/grafana/otlp-export.ts --push         # Push to configured endpoint
 *
 * Environment variables (for --push mode):
 *   GRAFANA_OTLP_ENDPOINT  - OTLP endpoint URL
 *   GRAFANA_INSTANCE_ID    - Instance ID for Basic Auth
 *   GRAFANA_API_TOKEN      - API token for Basic Auth
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// Source Data Types (matches src/data/otel-data/ JSON structure)
// ============================================================================

type SourceResourceAttributes = {
  'service.name': string;
  'host.name': string;
  'host.id': string;
  'server.role': string;
  'os.type': string;
  'os.description': string;
  'cloud.region': string;
  'cloud.availability_zone': string;
  'deployment.environment': string;
  'host.cpu.count'?: number;
  'host.memory.size'?: number;
  'host.disk.size'?: number;
};

type SourceResourceCatalog = {
  schemaVersion: string;
  generatedAt: string;
  resources: Record<string, SourceResourceAttributes>;
};

type SourceMetricDataPoint = {
  asDouble: number;
  attributes: { 'host.name': string };
};

type SourceMetric = {
  name: string;
  unit: string;
  type: 'gauge' | 'sum';
  dataPoints: SourceMetricDataPoint[];
};

type SourceLogRecord = {
  timeUnixNano: number;
  severityNumber: number;
  severityText: string;
  body: string;
  attributes: Record<string, string | number>;
  resource: string;
};

type SourceHourlySlot = {
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  metrics: SourceMetric[];
  logs: SourceLogRecord[];
};

type SourceHourlyFile = {
  schemaVersion: string;
  hour: number;
  scope: { name: string; version: string };
  slots: SourceHourlySlot[];
};

// ============================================================================
// OTLP Export Types (ExportMetricsServiceRequest / ExportLogsServiceRequest)
// ============================================================================

type OtlpAttributeValue = {
  stringValue?: string;
  intValue?: number;
};

type OtlpAttribute = {
  key: string;
  value: OtlpAttributeValue;
};

type OtlpGaugeDataPoint = {
  asDouble: number;
  timeUnixNano: string;
  attributes: OtlpAttribute[];
};

type OtlpMetric = {
  name: string;
  unit: string;
  gauge?: { dataPoints: OtlpGaugeDataPoint[] };
  sum?: { dataPoints: OtlpGaugeDataPoint[]; isMonotonic: boolean; aggregationTemporality: number };
};

type OtlpScopeMetrics = {
  scope: { name: string; version: string };
  metrics: OtlpMetric[];
};

type OtlpResourceMetrics = {
  resource: { attributes: OtlpAttribute[] };
  scopeMetrics: OtlpScopeMetrics[];
};

type ExportMetricsServiceRequest = {
  resourceMetrics: OtlpResourceMetrics[];
};

type OtlpLogRecord = {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: OtlpAttribute[];
};

type OtlpScopeLogs = {
  scope: { name: string; version: string };
  logRecords: OtlpLogRecord[];
};

type OtlpResourceLogs = {
  resource: { attributes: OtlpAttribute[] };
  scopeLogs: OtlpScopeLogs[];
};

type ExportLogsServiceRequest = {
  resourceLogs: OtlpResourceLogs[];
};

// ============================================================================
// Paths
// ============================================================================

const DATA_DIR = path.resolve(__dirname, '../../src/data/otel-data');
const OUTPUT_DIR = path.resolve(__dirname, 'output');

// ============================================================================
// Data Loading
// ============================================================================

function loadCatalog(): SourceResourceCatalog {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'resource-catalog.json'), 'utf-8');
  return JSON.parse(raw) as SourceResourceCatalog;
}

function loadHourly(hour: number): SourceHourlyFile {
  const padded = String(hour).padStart(2, '0');
  const raw = fs.readFileSync(path.join(DATA_DIR, `hourly/hour-${padded}.json`), 'utf-8');
  return JSON.parse(raw) as SourceHourlyFile;
}

// ============================================================================
// Attribute Helpers
// ============================================================================

function resourceAttrsToOtlp(attrs: SourceResourceAttributes): OtlpAttribute[] {
  const result: OtlpAttribute[] = [];
  for (const [key, val] of Object.entries(attrs)) {
    if (typeof val === 'number') {
      result.push({ key, value: { intValue: val } });
    } else {
      result.push({ key, value: { stringValue: val } });
    }
  }
  return result;
}

function hostNameToServerId(
  hostName: string,
  catalog: SourceResourceCatalog,
): string | undefined {
  for (const [id, attrs] of Object.entries(catalog.resources)) {
    if (attrs['host.name'] === hostName) return id;
  }
  return undefined;
}

// ============================================================================
// Core Converters
// ============================================================================

function buildResourceMetrics(
  slots: SourceHourlySlot[],
  catalog: SourceResourceCatalog,
): OtlpResourceMetrics[] {
  // Group metrics per host -> per slot
  const byHost = new Map<string, { attrs: SourceResourceAttributes; metrics: OtlpMetric[] }>();

  for (const slot of slots) {
    const timestamp = String(slot.startTimeUnixNano);

    for (const metric of slot.metrics) {
      for (const dp of metric.dataPoints) {
        const hostName = dp.attributes['host.name'];
        const serverId = hostNameToServerId(hostName, catalog);
        if (!serverId) continue;

        if (!byHost.has(serverId)) {
          byHost.set(serverId, {
            attrs: catalog.resources[serverId],
            metrics: [],
          });
        }

        const entry = byHost.get(serverId)!;
        const otlpDp: OtlpGaugeDataPoint = {
          asDouble: dp.asDouble,
          timeUnixNano: timestamp,
          attributes: [{ key: 'host.name', value: { stringValue: hostName } }],
        };

        // Find or create the metric entry for this host
        let existingMetric = entry.metrics.find((m) => m.name === metric.name);
        if (!existingMetric) {
          existingMetric = { name: metric.name, unit: metric.unit };
          if (metric.type === 'gauge') {
            existingMetric.gauge = { dataPoints: [] };
          } else {
            existingMetric.sum = {
              dataPoints: [],
              isMonotonic: false,
              aggregationTemporality: 2, // AGGREGATION_TEMPORALITY_CUMULATIVE
            };
          }
          entry.metrics.push(existingMetric);
        }

        if (existingMetric.gauge) {
          existingMetric.gauge.dataPoints.push(otlpDp);
        } else if (existingMetric.sum) {
          existingMetric.sum.dataPoints.push(otlpDp);
        }
      }
    }
  }

  // Build OTLP ResourceMetrics
  const resourceMetrics: OtlpResourceMetrics[] = [];
  for (const [, entry] of byHost) {
    resourceMetrics.push({
      resource: { attributes: resourceAttrsToOtlp(entry.attrs) },
      scopeMetrics: [
        {
          scope: { name: 'openmanager-ai-otel-pipeline', version: '1.0.0' },
          metrics: entry.metrics,
        },
      ],
    });
  }

  return resourceMetrics;
}

function buildResourceLogs(
  slots: SourceHourlySlot[],
  catalog: SourceResourceCatalog,
): OtlpResourceLogs[] {
  const byHost = new Map<string, { attrs: SourceResourceAttributes; logs: OtlpLogRecord[] }>();

  for (const slot of slots) {
    for (const log of slot.logs) {
      const serverId = log.resource;
      const resource = catalog.resources[serverId];
      if (!resource) continue;

      if (!byHost.has(serverId)) {
        byHost.set(serverId, { attrs: resource, logs: [] });
      }

      const otlpAttrs: OtlpAttribute[] = Object.entries(log.attributes).map(([key, val]) => ({
        key,
        value: typeof val === 'number' ? { intValue: val } : { stringValue: String(val) },
      }));

      byHost.get(serverId)!.logs.push({
        timeUnixNano: String(log.timeUnixNano),
        severityNumber: log.severityNumber,
        severityText: log.severityText,
        body: { stringValue: log.body },
        attributes: otlpAttrs,
      });
    }
  }

  const resourceLogs: OtlpResourceLogs[] = [];
  for (const [, entry] of byHost) {
    resourceLogs.push({
      resource: { attributes: resourceAttrsToOtlp(entry.attrs) },
      scopeLogs: [
        {
          scope: { name: 'openmanager-ai-otel-pipeline', version: '1.0.0' },
          logRecords: entry.logs,
        },
      ],
    });
  }

  return resourceLogs;
}

// ============================================================================
// Export Functions
// ============================================================================

function exportMetrics(hour: number, catalog: SourceResourceCatalog): ExportMetricsServiceRequest {
  const hourly = loadHourly(hour);
  return { resourceMetrics: buildResourceMetrics(hourly.slots, catalog) };
}

function exportLogs(hour: number, catalog: SourceResourceCatalog): ExportLogsServiceRequest {
  const hourly = loadHourly(hour);
  return { resourceLogs: buildResourceLogs(hourly.slots, catalog) };
}

// ============================================================================
// Push to OTLP Endpoint
// ============================================================================

async function pushToEndpoint(
  url: string,
  data: ExportMetricsServiceRequest | ExportLogsServiceRequest,
  auth: { instanceId: string; token: string },
): Promise<{ status: number; statusText: string }> {
  const credentials = Buffer.from(`${auth.instanceId}:${auth.token}`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify(data),
  });

  return { status: response.status, statusText: response.statusText };
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): { hours: number[]; push: boolean } {
  const args = process.argv.slice(2);
  let hours: number[] = [];
  let push = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') {
      hours = Array.from({ length: 24 }, (_, k) => k);
    } else if (arg === '--hour') {
      const next = args[i + 1];
      if (next === undefined || next.startsWith('--')) {
        console.error('Error: --hour requires a number argument (0-23)');
        process.exit(1);
      }
      const h = Number.parseInt(next, 10);
      if (Number.isNaN(h) || h < 0 || h > 23) {
        console.error(`Error: Invalid hour "${next}". Must be 0-23.`);
        process.exit(1);
      }
      hours.push(h);
      i++;
    } else if (arg === '--push') {
      push = true;
    }
  }

  if (hours.length === 0) {
    console.error('Usage: otlp-export.ts [--hour N | --all] [--push]');
    process.exit(1);
  }

  return { hours, push };
}

async function main(): Promise<void> {
  const { hours, push } = parseArgs();
  const catalog = loadCatalog();

  console.log(`[otlp-export] Converting ${hours.length} hour(s) to OTLP format...`);

  if (!push) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const endpoint = process.env.GRAFANA_OTLP_ENDPOINT ?? '';
  const instanceId = process.env.GRAFANA_INSTANCE_ID ?? '';
  const token = process.env.GRAFANA_API_TOKEN ?? '';

  if (push && (!endpoint || !instanceId || !token)) {
    console.error(
      'Error: --push requires GRAFANA_OTLP_ENDPOINT, GRAFANA_INSTANCE_ID, GRAFANA_API_TOKEN',
    );
    process.exit(1);
  }

  for (const hour of hours) {
    const padded = String(hour).padStart(2, '0');
    const metricsRequest = exportMetrics(hour, catalog);
    const logsRequest = exportLogs(hour, catalog);

    const metricPointCount = metricsRequest.resourceMetrics.reduce(
      (sum, rm) =>
        sum +
        rm.scopeMetrics.reduce(
          (s, sm) =>
            s +
            sm.metrics.reduce((ms, m) => {
              const pts = m.gauge?.dataPoints.length ?? m.sum?.dataPoints.length ?? 0;
              return ms + pts;
            }, 0),
          0,
        ),
      0,
    );

    const logRecordCount = logsRequest.resourceLogs.reduce(
      (sum, rl) => sum + rl.scopeLogs.reduce((s, sl) => s + sl.logRecords.length, 0),
      0,
    );

    if (push) {
      const auth = { instanceId, token };
      const metricsUrl = `${endpoint}/v1/metrics`;
      const logsUrl = `${endpoint}/v1/logs`;

      const mRes = await pushToEndpoint(metricsUrl, metricsRequest, auth);
      const lRes = await pushToEndpoint(logsUrl, logsRequest, auth);

      console.log(
        `  hour-${padded}: metrics=${metricPointCount} (${mRes.status}), ` +
          `logs=${logRecordCount} (${lRes.status})`,
      );
    } else {
      const metricsPath = path.join(OUTPUT_DIR, `hour-${padded}-metrics.json`);
      const logsPath = path.join(OUTPUT_DIR, `hour-${padded}-logs.json`);

      fs.writeFileSync(metricsPath, JSON.stringify(metricsRequest, null, 2));
      fs.writeFileSync(logsPath, JSON.stringify(logsRequest, null, 2));

      console.log(
        `  hour-${padded}: metrics=${metricPointCount} -> ${path.basename(metricsPath)}, ` +
          `logs=${logRecordCount} -> ${path.basename(logsPath)}`,
      );
    }
  }

  if (!push) {
    console.log(`\n[otlp-export] Output written to ${OUTPUT_DIR}`);
  }

  console.log('[otlp-export] Done.');
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
