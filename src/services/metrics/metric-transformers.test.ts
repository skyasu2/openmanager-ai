import { describe, expect, it } from 'vitest';
import {
  AggregationTemporality,
  type ExportMetricsServiceRequest,
} from '@/types/otel-standard';
import { extractMetricsFromStandard } from './metric-transformers';

function buildDataPoints(values: number[]) {
  return values.map((value, index) => ({
    attributes: [],
    startTimeUnixNano: `${index}`,
    timeUnixNano: `${index + 1}`,
    asDouble: value,
  }));
}

function buildPayload(cpuValues: number[]): ExportMetricsServiceRequest {
  const lowValues = cpuValues.map(() => 0.1);
  const networkValues = cpuValues.map((_, idx) => idx + 1);

  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            {
              key: 'host.name',
              value: { stringValue: 'web-nginx-icn-01.openmanager.kr' },
            },
          ],
        },
        scopeMetrics: [
          {
            scope: { name: 'test', version: '1.0.0' },
            metrics: [
              {
                name: 'system.cpu.utilization',
                gauge: { dataPoints: buildDataPoints(cpuValues) },
              },
              {
                name: 'system.memory.utilization',
                gauge: { dataPoints: buildDataPoints(lowValues) },
              },
              {
                name: 'system.filesystem.utilization',
                gauge: { dataPoints: buildDataPoints(lowValues) },
              },
              {
                name: 'system.network.io',
                sum: {
                  dataPoints: buildDataPoints(networkValues),
                  aggregationTemporality:
                    AggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                  isMonotonic: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('extractMetricsFromStandard', () => {
  it('6개 datapoint(10분 슬롯)에서 분 단위를 올바른 슬롯으로 매핑한다', () => {
    const payload = buildPayload([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    const metrics = extractMetricsFromStandard(
      payload,
      '2026-02-14T21:30:00+09:00',
      21 * 60 + 30
    );

    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.cpu).toBe(40);
    expect(metrics[0]?.network).toBe(4);
  });

  it('60개 datapoint(1분 해상도)에서는 정확한 minute 인덱스를 사용한다', () => {
    const cpuValues = Array.from({ length: 60 }, (_, i) => i / 100);
    const payload = buildPayload(cpuValues);
    const metrics = extractMetricsFromStandard(
      payload,
      '2026-02-14T21:50:00+09:00',
      21 * 60 + 50
    );

    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.cpu).toBe(50);
    expect(metrics[0]?.network).toBe(51);
  });
});
