import fs from 'fs';
import path from 'path';
import {
  AggregationTemporality,
  type ExportMetricsServiceRequest,
  type KeyValue,
  type Metric,
  type NumberDataPoint,
  type ResourceMetrics,
  type ScopeMetrics,
} from '@/types/otel-standard';
import type { OTelHourlyFile } from '@/types/otel-metrics';

// Paths
const INPUT_DIR = path.resolve(__dirname, '../../src/data/otel-processed/hourly');
const OUTPUT_DIR = path.resolve(__dirname, '../../src/data/otel-metrics/hourly'); // New standard dir

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * 🎯 Transform VIBE Custom OTel JSON to OTLP Standard JSON
 */
async function transformToStandard() {
  console.log('🚀 Starting OTLP Standardization...');

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const inputPath = path.join(INPUT_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);

    console.log(`Processing ${file}...`);

    const vibeData: OTelHourlyFile = JSON.parse(
      fs.readFileSync(inputPath, 'utf-8')
    );

    // VIBE Data Structure:
    // { slots: [ { startTimeUnixNano, metrics: [ { name, type, dataPoints: [ { asDouble, attributes } ] } ] } ] }

    // OTLP Standard Structure (Goal):
    // { resourceMetrics: [ { resource, scopeMetrics: [ { metrics: [ ... ] } ] } ] }

    // Transformation Strategy:
    // 1. VIBE 'slots' -> flattened time series
    // 2. Group by Resource (attributes['host.name']) is key for OTLP
    // 3. Create ResourceMetrics for each host

    const resourceMetricsMap = new Map<string, ResourceMetrics>();

    // Iterate through all slots and metrics to regroup by Resource
    vibeData.slots.forEach((slot) => {
      const timeUnixNano = slot.endTimeUnixNano.toString();
      const startTimeUnixNano = slot.startTimeUnixNano.toString();

      slot.metrics.forEach((vibeMetric) => {
        vibeMetric.dataPoints.forEach((dp) => {
          // Identify Resource (Host)
          const hostName = dp.attributes['host.name'];
          if (!hostName) return;

          // Get or Create ResourceMetrics Group
          let resGroup = resourceMetricsMap.get(hostName);
          if (!resGroup) {
            resGroup = {
              resource: {
                attributes: [
                  { key: 'host.name', value: { stringValue: hostName } },
                  { key: 'service.name', value: { stringValue: 'node-exporter' } }, // Default
                ],
              },
              scopeMetrics: [
                {
                  scope: {
                    name: 'openmanager-vibe-otel-pipeline',
                    version: '1.0.0',
                  },
                  metrics: [],
                },
              ],
            };
            resourceMetricsMap.set(hostName, resGroup);
          }

          // Find or Create Metric Definition in Scope
          const scope = resGroup.scopeMetrics[0];
          let metricDef = scope.metrics.find((m) => m.name === vibeMetric.name);
          if (!metricDef) {
            metricDef = createMetricDefinition(vibeMetric.name, vibeMetric.type);
            scope.metrics.push(metricDef);
          }

          // Create OTLP DataPoint
          const otlpDataPoint: NumberDataPoint = {
            attributes: convertToKeyValue(dp.attributes, ['host.name']), // host.name is already in Resource
            startTimeUnixNano,
            timeUnixNano,
            asDouble: dp.asDouble,
          };

          // Append DataPoint to Metric
          if (metricDef.gauge) {
            metricDef.gauge.dataPoints.push(otlpDataPoint);
          } else if (metricDef.sum) {
            metricDef.sum.dataPoints.push(otlpDataPoint);
          }
        });
      });
    });

    // Construct Final Payload
    const otlpPayload: ExportMetricsServiceRequest = {
      resourceMetrics: Array.from(resourceMetricsMap.values()),
    };

    // Save
    fs.writeFileSync(outputPath, JSON.stringify(otlpPayload, null, 2));
    console.log(`✅ Converted ${file} -> ${path.relative(process.cwd(), outputPath)}`);
  }

  console.log('🎉 Standardization Complete!');
}

// Helper: Convert object attributes to KeyValue array, excluding specific keys
function convertToKeyValue(
  attrs: Record<string, string>,
  excludeKeys: string[] = []
): KeyValue[] {
  return Object.entries(attrs)
    .filter(([k]) => !excludeKeys.includes(k))
    .map(([k, v]) => ({
      key: k,
      value: { stringValue: v },
    }));
}

// Helper: Create Metric Skeleton
function createMetricDefinition(name: string, type: string): Metric {
  const isSum = type === 'sum' || name.includes('counter') || name.includes('io'); // Simple heuristic
  
  if (isSum) {
    return {
      name,
      sum: {
        dataPoints: [],
        aggregationTemporality: AggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
        isMonotonic: true, // Assuming mostly counters
      },
    };
  }
  
  // Default to Gauge
  return {
    name,
    gauge: {
      dataPoints: [],
    },
  };
}

transformToStandard().catch(console.error);
