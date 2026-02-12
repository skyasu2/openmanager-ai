#!/usr/bin/env tsx
/**
 * OTel Pre-compute Pipeline
 *
 * hourly-data/*.json (Prometheus) → OTel Semantic Conventions → otel-processed/ JSON
 *
 * 출력:
 *   src/data/otel-processed/
 *   ├── resource-catalog.json         # 15 서버 OTel Resource 속성
 *   ├── timeseries.json               # 24h 시계열 (OTel + legacy 이름)
 *   └── hourly/hour-{00..23}.json     # 시간별 OTel 메트릭 + 로그 + 집계
 *
 * 사용법:
 *   npx tsx scripts/data/otel-precompute.ts
 *
 * @created 2026-02-11
 */

import fs from 'fs';
import path from 'path';

import {
  aggregateMetrics,
  buildAIContext,
  calculateHealth,
  evaluateAlerts,
  extractServerId,
  targetsToSimpleMetrics,
} from './pipeline-helpers';
import { METRIC_MAPPINGS, convertPrometheusToOTel } from './otel/prometheus-to-otel';
import { processServerLogs } from './otel/otel-log-processor';
import { buildResourceCatalog } from './otel/otel-resource-builder';
import type {
  HourlyData,
  OTelHourlySlot,
  OTelMetric,
  OTelTimeSeries,
  PrometheusTarget,
} from './otel/types';

// ============================================================================
// Constants
// ============================================================================

const SCHEMA_VERSION = '1.0.0';
const SCOPE_NAME = 'openmanager-ai-otel-pipeline';
const SCOPE_VERSION = '1.0.0';

// ============================================================================
// Helper: targets → OTel metrics (grouped by metric name)
// ============================================================================

function targetsToOTelMetrics(
  targets: Record<string, PrometheusTarget>,
  timestampMs: number
): OTelMetric[] {
  const metricsMap = new Map<string, OTelMetric>();

  // Initialize metric containers from METRIC_MAPPINGS
  for (const mapping of METRIC_MAPPINGS) {
    metricsMap.set(mapping.otel, {
      name: mapping.otel,
      description: mapping.description,
      unit: mapping.unit,
      type: mapping.type,
      dataPoints: [],
    });
  }

  // Fill data points from each target
  for (const [instanceKey, target] of Object.entries(targets)) {
    const hostname = target.labels.hostname;
    const dataPoints = convertPrometheusToOTel(
      target.metrics,
      hostname,
      timestampMs
    );

    // Each data point corresponds to a mapping (same order as METRIC_MAPPINGS)
    for (let i = 0; i < METRIC_MAPPINGS.length && i < dataPoints.length; i++) {
      const mapping = METRIC_MAPPINGS[i]!;
      const dp = dataPoints[i]!;
      const metric = metricsMap.get(mapping.otel);
      if (metric) {
        metric.dataPoints.push(dp);
      }
    }
  }

  return Array.from(metricsMap.values());
}

// ============================================================================
// Main Pipeline
// ============================================================================

function main(): void {
  const projectRoot = path.resolve(__dirname, '../..');
  const hourlyDataDir = path.join(projectRoot, 'src/data/hourly-data');
  const outputDir = path.join(projectRoot, 'src/data/otel-processed');
  const hourlyOutputDir = path.join(outputDir, 'hourly');

  console.log('=== OTel Pre-compute Pipeline ===\n');
  console.log(`  Input: src/data/hourly-data/*.json`);
  console.log(`  Output: src/data/otel-processed/ + public/processed-metrics/timeseries.json\n`);

  // Output directories
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(hourlyOutputDir, { recursive: true });

  // Load all 24 hourly files
  const allHourlyData: HourlyData[] = [];
  for (let h = 0; h < 24; h++) {
    const filename = `hour-${h.toString().padStart(2, '0')}.json`;
    const filepath = path.join(hourlyDataDir, filename);

    if (!fs.existsSync(filepath)) {
      console.error(`  Missing: ${filename}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(filepath, 'utf-8');
    const data = JSON.parse(raw) as HourlyData;
    allHourlyData.push(data);
  }
  console.log(`  Loaded: ${allHourlyData.length} hourly files\n`);

  // ====================================================================
  // Step 1: Build Resource Catalog
  // ====================================================================
  console.log('[1/4] Building resource-catalog.json...');

  const firstTargets = allHourlyData[0]!.dataPoints[0]!.targets;
  const resourceCatalog = buildResourceCatalog(firstTargets);

  const catalogPath = path.join(outputDir, 'resource-catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(resourceCatalog, null, 2));
  const catalogSize = (fs.statSync(catalogPath).size / 1024).toFixed(1);
  const serverCount = Object.keys(resourceCatalog.resources).length;
  console.log(`  -> resource-catalog.json (${serverCount} servers, ${catalogSize}KB)\n`);

  // ====================================================================
  // Step 2: Build OTel Hourly Files
  // ====================================================================
  console.log('[2/4] Building OTel hourly files...');

  const serverIds = Object.keys(firstTargets).map(extractServerId).sort();
  let totalDataPoints = 0;

  for (const hourlyData of allHourlyData) {
    const hour = hourlyData.hour;

    const slots: OTelHourlySlot[] = [];

    for (let slotIdx = 0; slotIdx < hourlyData.dataPoints.length; slotIdx++) {
      const dp = hourlyData.dataPoints[slotIdx]!;

      // OTel metrics
      const otelMetrics = targetsToOTelMetrics(dp.targets, dp.timestampMs);
      totalDataPoints += otelMetrics.reduce((sum, m) => sum + m.dataPoints.length, 0);

      // OTel logs (all servers)
      const allLogs = Object.entries(dp.targets).flatMap(([instanceKey, target]) => {
        const serverId = extractServerId(instanceKey);
        return processServerLogs(target.logs || [], serverId, dp.timestampMs);
      });

      const slotDurationMs = 10 * 60 * 1000; // 10 minutes
      slots.push({
        startTimeUnixNano: dp.timestampMs * 1_000_000,
        endTimeUnixNano: (dp.timestampMs + slotDurationMs) * 1_000_000,
        metrics: otelMetrics,
        logs: allLogs,
      });
    }

    // Aggregated metrics (reuse pipeline-helpers, same as precompute-metrics.ts)
    const repIndex = Math.min(3, hourlyData.dataPoints.length - 1);
    const repDataPoint = hourlyData.dataPoints[repIndex]!;
    const alerts = evaluateAlerts(repDataPoint.targets, hour, repIndex);
    const simpleMetrics = targetsToSimpleMetrics(repDataPoint.targets);
    const aggregated = aggregateMetrics(simpleMetrics);
    const health = calculateHealth(aggregated, alerts);
    const aiContext = buildAIContext(hour, health, aggregated, alerts);

    // Slim 출력: 런타임에서 미사용 필드 제거 (aggregated/alerts/health/aiContext)
    // 또한 dataPoint에서 timeUnixNano, metric에서 description/unit 제거
    const slimHourlyFile = {
      schemaVersion: SCHEMA_VERSION,
      hour,
      scope: { name: SCOPE_NAME, version: SCOPE_VERSION },
      slots: slots.map((slot) => ({
        startTimeUnixNano: slot.startTimeUnixNano,
        endTimeUnixNano: slot.endTimeUnixNano,
        metrics: slot.metrics.map((m) => ({
          name: m.name,
          type: m.type,
          dataPoints: m.dataPoints.map((dp) => ({
            asDouble: dp.asDouble,
            attributes: dp.attributes,
          })),
        })),
        logs: slot.logs,
      })),
    };

    const hourFilename = `hour-${hour.toString().padStart(2, '0')}.json`;
    const hourPath = path.join(hourlyOutputDir, hourFilename);
    fs.writeFileSync(hourPath, JSON.stringify(slimHourlyFile));

    const hourSize = (fs.statSync(hourPath).size / 1024).toFixed(1);
    const icon = health.grade === 'A' ? '  ' : health.grade <= 'B' ? '  ' : '  ';
    console.log(`${icon} ${hourFilename} - Health ${health.score}/${health.grade}, ${slots.length} slots, ${hourSize}KB`);
  }
  console.log('');

  // ====================================================================
  // Step 3: Build TimeSeries (OTel metric names + legacy names)
  // ====================================================================
  console.log('[3/4] Building timeseries.json...');

  const timestamps: number[] = [];
  // OTel named series
  const otelSeriesMap: Record<string, number[][]> = {};
  for (const mapping of METRIC_MAPPINGS) {
    // Exclude uptime (computed value varies), boot_time, processes
    if (['system.uptime', 'system.processes.count'].includes(mapping.otel)) continue;
    otelSeriesMap[mapping.otel] = serverIds.map(() => []);
  }
  // Legacy named series (for backward compat)
  const legacySeriesMap: Record<string, number[][]> = {
    cpu: serverIds.map(() => []),
    memory: serverIds.map(() => []),
    disk: serverIds.map(() => []),
    network: serverIds.map(() => []),
    up: serverIds.map(() => []),
  };

  const serverIndexMap = new Map<string, number>();
  serverIds.forEach((id, idx) => serverIndexMap.set(id, idx));

  for (const hourlyData of allHourlyData) {
    for (const dp of hourlyData.dataPoints) {
      timestamps.push(Math.floor(dp.timestampMs / 1000));

      for (const serverId of serverIds) {
        const idx = serverIndexMap.get(serverId)!;
        const target = dp.targets[`${serverId}:9100`];

        if (target) {
          // Legacy series (original Prometheus values)
          legacySeriesMap['cpu']![idx]!.push(target.metrics.node_cpu_usage_percent);
          legacySeriesMap['memory']![idx]!.push(target.metrics.node_memory_usage_percent);
          legacySeriesMap['disk']![idx]!.push(target.metrics.node_filesystem_usage_percent);
          legacySeriesMap['network']![idx]!.push(target.metrics.node_network_transmit_bytes_rate);
          legacySeriesMap['up']![idx]!.push(target.metrics.up);

          // OTel series (transformed values)
          for (const mapping of METRIC_MAPPINGS) {
            if (!otelSeriesMap[mapping.otel]) continue;
            const rawValue = target.metrics[mapping.prometheus as keyof typeof target.metrics];
            if (rawValue !== undefined) {
              otelSeriesMap[mapping.otel]![idx]!.push(mapping.transform(rawValue as number));
            } else {
              otelSeriesMap[mapping.otel]![idx]!.push(0);
            }
          }
        } else {
          // Missing target - fill with 0
          for (const key of Object.keys(legacySeriesMap)) {
            legacySeriesMap[key]![idx]!.push(0);
          }
          for (const key of Object.keys(otelSeriesMap)) {
            otelSeriesMap[key]![idx]!.push(0);
          }
        }
      }
    }
  }

  const timeseries: OTelTimeSeries = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    serverIds,
    timestamps,
    metrics: {
      ...otelSeriesMap,
      ...legacySeriesMap,
    },
  };

  const tsPath = path.join(outputDir, 'timeseries.json');
  fs.writeFileSync(tsPath, JSON.stringify(timeseries));
  const tsSize = (fs.statSync(tsPath).size / 1024).toFixed(1);
  console.log(`  -> timeseries.json (${timestamps.length} points x ${serverIds.length} servers, ${tsSize}KB)`);
  console.log(`  -> OTel metrics: ${Object.keys(otelSeriesMap).length}, Legacy metrics: ${Object.keys(legacySeriesMap).length}\n`);

  // ====================================================================
  // Step 3b: Output legacy timeseries to public/processed-metrics/
  // (Replaces precompute-metrics.ts timeseries output)
  // ====================================================================
  console.log('[3b/4] Writing legacy timeseries to public/processed-metrics/...');

  const legacyTimeseries = {
    serverIds,
    timestamps,
    metrics: {
      cpu: legacySeriesMap['cpu'],
      memory: legacySeriesMap['memory'],
      disk: legacySeriesMap['disk'],
      network: legacySeriesMap['network'],
      up: legacySeriesMap['up'],
    },
  };
  const legacyTsDir = path.join(projectRoot, 'public/processed-metrics');
  fs.mkdirSync(legacyTsDir, { recursive: true });
  const legacyTsPath = path.join(legacyTsDir, 'timeseries.json');
  fs.writeFileSync(legacyTsPath, JSON.stringify(legacyTimeseries));
  const legacyTsSize = (fs.statSync(legacyTsPath).size / 1024).toFixed(1);
  console.log(`  -> public/processed-metrics/timeseries.json (${legacyTsSize}KB)\n`);

  // (Step 4: Verify was removed — legacy processed-metrics/hourly/ no longer exists)

  // ====================================================================
  // Summary
  // ====================================================================
  let totalSize = fs.statSync(catalogPath).size + fs.statSync(tsPath).size;
  for (let h = 0; h < 24; h++) {
    const hourPath = path.join(hourlyOutputDir, `hour-${h.toString().padStart(2, '0')}.json`);
    totalSize += fs.statSync(hourPath).size;
  }
  const legacySize = fs.statSync(legacyTsPath).size;

  console.log('=== Summary ===');
  console.log(`  Output: src/data/otel-processed/ + public/processed-metrics/timeseries.json`);
  console.log(`  Files: 1 resource-catalog + 24 hourly + 1 timeseries (OTel) + 1 timeseries (legacy) = 27 files`);
  console.log(`  Total: ${((totalSize + legacySize) / 1024).toFixed(1)}KB`);
  console.log(`  Servers: ${serverCount}`);
  console.log(`  Data points: ${totalDataPoints}`);
  console.log(`  Time points: ${timestamps.length} (${timestamps.length / 6}h x 6 slots)`);
  console.log('\nDone.');
}

main();
