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
  const networkValues = cpuValues.map((_, idx) => (idx + 1) / 100);

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

  it('모든 메트릭이 0이면 offline으로 판별한다', () => {
    const payload = buildPayload([0, 0, 0, 0, 0, 0]);
    // memory/disk도 0으로 세팅
    const rm = payload.resourceMetrics[0]!;
    const scope = rm.scopeMetrics[0]!;
    scope.metrics = [
      {
        name: 'system.cpu.utilization',
        gauge: { dataPoints: buildDataPoints([0, 0, 0, 0, 0, 0]) },
      },
      {
        name: 'system.memory.utilization',
        gauge: { dataPoints: buildDataPoints([0, 0, 0, 0, 0, 0]) },
      },
      {
        name: 'system.filesystem.utilization',
        gauge: { dataPoints: buildDataPoints([0, 0, 0, 0, 0, 0]) },
      },
      {
        name: 'system.network.io',
        sum: {
          dataPoints: buildDataPoints([0, 0, 0, 0, 0, 0]),
          aggregationTemporality:
            AggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
          isMonotonic: true,
        },
      },
    ];

    const metrics = extractMetricsFromStandard(
      payload,
      '2026-02-14T21:00:00+09:00',
      21 * 60
    );
    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.status).toBe('offline');
  });

  it('빈 resourceMetrics → 빈 결과', () => {
    const payload: ExportMetricsServiceRequest = { resourceMetrics: [] };
    const metrics = extractMetricsFromStandard(
      payload,
      '2026-02-14T21:00:00+09:00',
      21 * 60
    );
    expect(metrics).toHaveLength(0);
  });

  it('다중 서버 리소스를 개별 변환한다', () => {
    const payload = buildPayload([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    // 두 번째 서버 추가
    payload.resourceMetrics.push({
      resource: {
        attributes: [
          {
            key: 'host.name',
            value: { stringValue: 'db-postgres-icn-01.openmanager.kr' },
          },
        ],
      },
      scopeMetrics: [
        {
          scope: { name: 'test', version: '1.0.0' },
          metrics: [
            {
              name: 'system.cpu.utilization',
              gauge: {
                dataPoints: buildDataPoints([0.8, 0.8, 0.8, 0.8, 0.8, 0.8]),
              },
            },
            {
              name: 'system.memory.utilization',
              gauge: {
                dataPoints: buildDataPoints([0.3, 0.3, 0.3, 0.3, 0.3, 0.3]),
              },
            },
            {
              name: 'system.filesystem.utilization',
              gauge: {
                dataPoints: buildDataPoints([0.2, 0.2, 0.2, 0.2, 0.2, 0.2]),
              },
            },
            {
              name: 'system.network.io',
              sum: {
                dataPoints: buildDataPoints([0.1, 0.1, 0.1, 0.1, 0.1, 0.1]),
                aggregationTemporality:
                  AggregationTemporality.AGGREGATION_TEMPORALITY_CUMULATIVE,
                isMonotonic: true,
              },
            },
          ],
        },
      ],
    });

    const metrics = extractMetricsFromStandard(
      payload,
      '2026-02-14T21:00:00+09:00',
      21 * 60
    );
    expect(metrics).toHaveLength(2);
    const ids = metrics.map((m) => m.serverId).sort();
    expect(ids).toEqual(['db-postgres-icn-01', 'web-nginx-icn-01']);
  });

  it('빈 dataPoints 메트릭은 건너뛴다', () => {
    const payload: ExportMetricsServiceRequest = {
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
                { name: 'system.cpu.utilization', gauge: { dataPoints: [] } },
                {
                  name: 'system.memory.utilization',
                  gauge: { dataPoints: buildDataPoints([0.5]) },
                },
                {
                  name: 'system.filesystem.utilization',
                  gauge: { dataPoints: buildDataPoints([0.3]) },
                },
                {
                  name: 'system.network.io',
                  sum: {
                    dataPoints: buildDataPoints([0.05]),
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

    const metrics = extractMetricsFromStandard(
      payload,
      '2026-02-14T21:00:00+09:00',
      21 * 60
    );
    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.cpu).toBe(0); // CPU dataPoints 비어서 기본값 0
  });

  it('host.name 없는 리소스는 건너뛴다', () => {
    const payload: ExportMetricsServiceRequest = {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'some-service' } },
            ],
          },
          scopeMetrics: [
            {
              scope: { name: 'test', version: '1.0.0' },
              metrics: [
                {
                  name: 'system.cpu.utilization',
                  gauge: { dataPoints: buildDataPoints([0.5]) },
                },
              ],
            },
          ],
        },
      ],
    };

    const metrics = extractMetricsFromStandard(
      payload,
      '2026-02-14T21:00:00+09:00',
      21 * 60
    );
    expect(metrics).toHaveLength(0);
  });
});
