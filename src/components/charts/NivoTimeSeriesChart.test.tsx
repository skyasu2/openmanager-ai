/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type AnomalyDataPoint,
  NivoTimeSeriesChart,
  type PredictionDataPoint,
} from './NivoTimeSeriesChart';
import type { MetricDataPoint } from './TimeSeriesChart';

vi.mock('@nivo/line', () => ({
  ResponsiveLine: ({
    data,
    markers,
    layers,
    enableSlices,
  }: {
    data: Array<{ id: string; data: unknown[] }>;
    markers?: Array<{ value: number; legend?: string }>;
    layers?: unknown[];
    enableSlices?: string;
  }) => (
    <div
      data-testid="nivo-responsive-line"
      data-series-count={data.length}
      data-marker-count={markers?.length ?? 0}
      data-layer-count={layers?.length ?? 0}
      data-enable-slices={enableSlices}
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
    </div>
  ),
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
      'data-layer-count',
      '7'
    );
  });

  it('데이터가 없으면 빈 상태를 렌더링한다', () => {
    render(<NivoTimeSeriesChart data={[]} metric="cpu" />);

    expect(screen.getByText('데이터가 없습니다')).toBeInTheDocument();
    expect(
      screen.queryByTestId('nivo-responsive-line')
    ).not.toBeInTheDocument();
  });
});
