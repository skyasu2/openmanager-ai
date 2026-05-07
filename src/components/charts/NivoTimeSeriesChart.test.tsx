/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NivoTimeSeriesChart } from './NivoTimeSeriesChart';
import type {
  AnomalyDataPoint,
  MetricDataPoint,
  PredictionDataPoint,
} from './time-series-chart.types';

vi.mock('@nivo/line', () => ({
  ResponsiveLine: ({
    data,
    markers,
    layers,
    enableSlices,
    useMesh,
    sliceTooltip,
  }: {
    data: Array<{
      id: string;
      data: Array<{ x: string; y: number | null }>;
    }>;
    markers?: Array<{ value: number; legend?: string }>;
    layers?: Array<
      | string
      | ((props: {
          innerHeight: number;
          xScale: ((value: string) => number) & { domain: () => string[] };
        }) => ReactNode)
    >;
    enableSlices?: string;
    useMesh?: boolean;
    sliceTooltip?: (props: {
      slice: {
        points: Array<{
          id: string;
          seriesColor: string;
          seriesId: string;
          data: { x: string; y: number | null };
        }>;
      };
    }) => ReactNode;
  }) => {
    const domain = data.flatMap((series) =>
      series.data.map((point) => point.x)
    );
    const uniqueDomain = [...new Set(domain)];
    const xScale = ((value: string) => {
      const index = uniqueDomain.indexOf(value);
      return index >= 0 ? index * 100 : Number.NaN;
    }) as ((value: string) => number) & { domain: () => string[] };
    xScale.domain = () => uniqueDomain;

    const firstActualPoint = data.find((series) => series.id === 'actual')
      ?.data[0];

    return (
      <div
        data-testid="nivo-responsive-line"
        data-series-count={data.length}
        data-marker-count={markers?.length ?? 0}
        data-layer-count={layers?.length ?? 0}
        data-enable-slices={enableSlices}
        data-use-mesh={String(useMesh ?? false)}
      >
        {data.map((series) => (
          <div
            key={series.id}
            data-testid={`nivo-series-${series.id}`}
            data-point-count={series.data.length}
          />
        ))}
        {markers?.map((marker) => (
          <div
            key={`${marker.legend}-${marker.value}`}
            data-testid={`nivo-marker-${marker.value}`}
          />
        ))}
        {layers?.map((layer, index) =>
          typeof layer === 'function' && index === 3 ? (
            <div key={index} data-testid={`nivo-layer-${index}`}>
              <svg aria-hidden="true">
                {layer({ innerHeight: 120, xScale })}
              </svg>
            </div>
          ) : null
        )}
        {sliceTooltip && firstActualPoint
          ? sliceTooltip({
              slice: {
                points: [
                  {
                    id: 'actual.0',
                    seriesColor: '#10b981',
                    seriesId: 'actual',
                    data: firstActualPoint,
                  },
                ],
              },
            })
          : null}
      </div>
    );
  },
}));

describe('NivoTimeSeriesChart', () => {
  const data: MetricDataPoint[] = [
    { timestamp: '2026-05-07T00:00:00.000Z', value: 45 },
    { timestamp: '2026-05-07T00:05:00.000Z', value: 52 },
  ];

  const predictions: PredictionDataPoint[] = [
    {
      timestamp: '2026-05-07T00:10:00.000Z',
      predicted: 58,
      upper: 66,
      lower: 49,
    },
  ];

  const anomalies: AnomalyDataPoint[] = [
    {
      startTime: '2026-05-07T00:00:00.000Z',
      endTime: '2026-05-07T00:05:00.000Z',
      severity: 'high',
    },
  ];

  it('실제값과 예측값을 Nivo series로 전달한다', () => {
    render(
      <NivoTimeSeriesChart
        data={data}
        predictions={predictions}
        metric="cpu"
        showPrediction
      />
    );

    expect(screen.getByTestId('nivo-responsive-line')).toHaveAttribute(
      'data-series-count',
      '4'
    );
    expect(screen.getByTestId('nivo-series-actual')).toHaveAttribute(
      'data-point-count',
      '2'
    );
    expect(screen.getByTestId('nivo-series-prediction')).toHaveAttribute(
      'data-point-count',
      '1'
    );
  });

  it('임계값을 Nivo markers로 전달한다', () => {
    render(
      <NivoTimeSeriesChart data={data} metric="disk" showThresholds={true} />
    );

    expect(screen.getByTestId('nivo-marker-85')).toBeInTheDocument();
    expect(screen.getByTestId('nivo-marker-95')).toBeInTheDocument();
  });

  it('이상 구간과 tooltip slice layer를 활성화한다', () => {
    render(
      <NivoTimeSeriesChart
        data={data}
        anomalies={anomalies}
        metric="cpu"
        showAnomalies
      />
    );

    expect(screen.getByTestId('nivo-responsive-line')).toHaveAttribute(
      'data-enable-slices',
      'x'
    );
    expect(screen.getByTestId('nivo-responsive-line')).toHaveAttribute(
      'data-use-mesh',
      'false'
    );
    expect(screen.getByTestId('nivo-responsive-line')).toHaveAttribute(
      'data-layer-count',
      '7'
    );
  });

  it('sliceTooltip을 실제값 포인트로 렌더링한다', () => {
    render(<NivoTimeSeriesChart data={data} metric="cpu" />);

    expect(screen.getByTestId('nivo-slice-tooltip')).toBeInTheDocument();
    expect(screen.getByText('실제값:')).toBeInTheDocument();
    expect(screen.getByText('45.0%')).toBeInTheDocument();
  });

  it('동일한 시작/종료 시각의 이상 구간도 최소 너비로 표시한다', () => {
    render(
      <NivoTimeSeriesChart
        data={data}
        anomalies={[
          {
            startTime: '2026-05-07T00:00:00.000Z',
            endTime: '2026-05-07T00:00:00.000Z',
            severity: 'critical',
          },
        ]}
        metric="cpu"
        showAnomalies
      />
    );

    expect(screen.getByTestId('nivo-anomaly-layer')).toBeInTheDocument();
    expect(screen.getByTestId('nivo-anomaly-rect-0')).toHaveAttribute(
      'width',
      '4'
    );
  });

  it('데이터 포인트 사이의 이상 구간 시간을 보간해서 표시한다', () => {
    render(
      <NivoTimeSeriesChart
        data={data}
        anomalies={[
          {
            startTime: '2026-05-07T00:02:30.000Z',
            endTime: '2026-05-07T00:05:00.000Z',
            severity: 'high',
          },
        ]}
        metric="cpu"
        showAnomalies
      />
    );

    expect(screen.getByTestId('nivo-anomaly-rect-0')).toHaveAttribute(
      'x',
      '50'
    );
    expect(screen.getByTestId('nivo-anomaly-rect-0')).toHaveAttribute(
      'width',
      '50'
    );
  });

  it('xScale 범위 밖 이상 구간은 렌더링하지 않는다', () => {
    render(
      <NivoTimeSeriesChart
        data={data}
        anomalies={[
          {
            startTime: '2026-05-06T00:00:00.000Z',
            endTime: '2026-05-06T00:05:00.000Z',
            severity: 'high',
          },
        ]}
        metric="cpu"
        showAnomalies
      />
    );

    expect(screen.getByTestId('nivo-anomaly-layer')).toBeInTheDocument();
    expect(screen.queryByTestId('nivo-anomaly-rect-0')).not.toBeInTheDocument();
  });

  it('데이터가 없으면 빈 상태를 렌더링한다', () => {
    render(<NivoTimeSeriesChart data={[]} metric="cpu" />);

    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument();
    expect(
      screen.queryByTestId('nivo-responsive-line')
    ).not.toBeInTheDocument();
  });
});
