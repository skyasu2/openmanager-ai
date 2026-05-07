'use client';

import type { CartesianMarkerProps } from '@nivo/core';
import type { LineSvgLayer, LineSvgProps } from '@nivo/line';
import { ResponsiveLine } from '@nivo/line';
import { memo, useMemo } from 'react';
import { ChartErrorBoundary } from '@/components/error/ChartErrorBoundary';
import type {
  AnomalyDataPoint,
  MetricDataPoint,
  PredictionDataPoint,
  TimeSeriesChartProps,
} from './time-series-chart.types';

type NivoMetricDatum = {
  x: string;
  y: number | null;
};

type NivoMetricSeries = {
  id: 'actual' | 'prediction' | 'upper' | 'lower';
  data: NivoMetricDatum[];
};

const THRESHOLD_DEFAULTS: Record<
  TimeSeriesChartProps['metric'],
  { warning: number; critical: number }
> = {
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 80, critical: 90 },
  disk: { warning: 85, critical: 95 },
  network: { warning: 70, critical: 85 },
};

const METRIC_LABELS: Record<TimeSeriesChartProps['metric'], string> = {
  cpu: 'CPU',
  memory: '메모리',
  disk: '디스크',
  network: '네트워크',
};

const ANOMALY_COLORS: Record<AnomalyDataPoint['severity'], string> = {
  low: '#fef3c7',
  medium: '#fde68a',
  high: '#fdba74',
  critical: '#fca5a5',
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function toNivoPoints(
  points: MetricDataPoint[] | PredictionDataPoint[],
  valueKey: 'value' | 'predicted' | 'upper' | 'lower'
): NivoMetricDatum[] {
  return points
    .map((point) => {
      const value = point[valueKey as keyof typeof point];
      return {
        x: point.timestamp,
        y: typeof value === 'number' && Number.isFinite(value) ? value : null,
      };
    })
    .filter((point) => point.y !== null);
}

function buildSeries(
  data: MetricDataPoint[],
  predictions: PredictionDataPoint[] | undefined,
  showPrediction: boolean
): NivoMetricSeries[] {
  const series: NivoMetricSeries[] = [
    {
      id: 'actual',
      data: toNivoPoints(data, 'value'),
    },
  ];

  if (showPrediction && predictions && predictions.length > 0) {
    series.push(
      {
        id: 'prediction',
        data: toNivoPoints(predictions, 'predicted'),
      },
      {
        id: 'upper',
        data: toNivoPoints(predictions, 'upper'),
      },
      {
        id: 'lower',
        data: toNivoPoints(predictions, 'lower'),
      }
    );
  }

  return series;
}

function buildMarkers(
  thresholds: { warning: number; critical: number },
  compact: boolean
): CartesianMarkerProps<string | number>[] {
  return [
    {
      axis: 'y',
      value: thresholds.warning,
      lineStyle: { stroke: '#f59e0b', strokeDasharray: '3 3' },
      legend: compact ? undefined : '경고',
      legendPosition: 'top-right',
      textStyle: { fill: '#f59e0b', fontSize: 10 },
    },
    {
      axis: 'y',
      value: thresholds.critical,
      lineStyle: { stroke: '#ef4444', strokeDasharray: '3 3' },
      legend: compact ? undefined : '심각',
      legendPosition: 'top-right',
      textStyle: { fill: '#ef4444', fontSize: 10 },
    },
  ];
}

function createAnomalyLayer(
  anomalies: AnomalyDataPoint[] | undefined,
  showAnomalies: boolean
): LineSvgLayer<NivoMetricSeries> {
  const AnomalyLayer: LineSvgLayer<NivoMetricSeries> = ({
    innerHeight,
    xScale,
  }) => {
    if (!showAnomalies || !anomalies || anomalies.length === 0) return null;

    return (
      <g data-testid="nivo-anomaly-layer">
        {anomalies.map((anomaly, index) => {
          const start = xScale(anomaly.startTime);
          const end = xScale(anomaly.endTime);
          if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

          const x = Math.min(start, end);
          const width = Math.max(Math.abs(end - start), 1);

          return (
            <rect
              key={`${anomaly.startTime}-${anomaly.endTime}-${index}`}
              x={x}
              y={0}
              width={width}
              height={innerHeight}
              fill={ANOMALY_COLORS[anomaly.severity]}
              fillOpacity={0.4}
              stroke={anomaly.severity === 'critical' ? '#ef4444' : '#f59e0b'}
              strokeOpacity={0.6}
            />
          );
        })}
      </g>
    );
  };

  return AnomalyLayer;
}

function toPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
    .join(' ');
}

function createSeriesLayer(): LineSvgLayer<NivoMetricSeries> {
  const SeriesLayer: LineSvgLayer<NivoMetricSeries> = ({
    series,
    lineGenerator,
  }) => {
    const actual = series.find((item) => item.id === 'actual');
    const prediction = series.find((item) => item.id === 'prediction');
    const upper = series.find((item) => item.id === 'upper');
    const lower = series.find((item) => item.id === 'lower');

    const actualPath = actual
      ? lineGenerator(actual.data.map((point) => point.position))
      : null;
    const predictionPath = prediction
      ? lineGenerator(prediction.data.map((point) => point.position))
      : null;
    const bandPath =
      upper && lower && upper.data.length > 1 && lower.data.length > 1
        ? `${toPath(upper.data.map((point) => point.position))} L ${toPath(
            [...lower.data].reverse().map((point) => point.position)
          ).replace(/^M /, '')} Z`
        : null;

    return (
      <g data-testid="nivo-custom-series-layer">
        {bandPath && (
          <path d={bandPath} fill="#3b82f6" fillOpacity={0.1} stroke="none" />
        )}
        {actualPath && (
          <path
            d={actualPath}
            fill="none"
            stroke="#10b981"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        )}
        {predictionPath && (
          <path
            d={predictionPath}
            fill="none"
            stroke="#3b82f6"
            strokeDasharray="5 5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        )}
      </g>
    );
  };

  return SeriesLayer;
}

function buildLayers(
  anomalies: AnomalyDataPoint[] | undefined,
  showAnomalies: boolean
): LineSvgLayer<NivoMetricSeries>[] {
  return [
    'grid',
    'markers',
    'axes',
    createAnomalyLayer(anomalies, showAnomalies),
    createSeriesLayer(),
    'slices',
    'legends',
  ];
}

function getBoundaryResetKey(props: TimeSeriesChartProps): string {
  const lastData = props.data[props.data.length - 1];
  const firstPrediction = props.predictions?.[0];
  const lastPrediction = props.predictions?.[props.predictions.length - 1];
  const firstAnomaly = props.anomalies?.[0];
  const lastAnomaly = props.anomalies?.[props.anomalies.length - 1];

  return [
    props.metric,
    props.height ?? 300,
    props.compact ? 'compact' : 'full',
    props.showPrediction ?? true,
    props.showAnomalies ?? true,
    props.showThresholds ?? true,
    props.showBrush ?? false,
    props.data.length,
    props.data[0]?.timestamp ?? '',
    lastData?.timestamp ?? '',
    props.predictions?.length ?? 0,
    firstPrediction?.timestamp ?? '',
    lastPrediction?.timestamp ?? '',
    props.anomalies?.length ?? 0,
    firstAnomaly?.startTime ?? '',
    lastAnomaly?.endTime ?? '',
  ].join('|');
}

const chartColors = ['#10b981', '#3b82f6', '#93c5fd', '#ffffff'];

function NivoTimeSeriesChartInner({
  data,
  predictions,
  anomalies,
  metric,
  thresholds,
  height = 300,
  showPrediction = true,
  showAnomalies = true,
  showThresholds = true,
  compact = false,
}: TimeSeriesChartProps) {
  const effectiveThresholds =
    thresholds ?? THRESHOLD_DEFAULTS[metric] ?? THRESHOLD_DEFAULTS.cpu;

  const series = useMemo(
    () => buildSeries(data, predictions, showPrediction),
    [data, predictions, showPrediction]
  );

  const markers = useMemo(
    () => (showThresholds ? buildMarkers(effectiveThresholds, compact) : []),
    [compact, effectiveThresholds, showThresholds]
  );

  const layers = useMemo(
    () => buildLayers(anomalies, showAnomalies),
    [anomalies, showAnomalies]
  );

  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50"
        style={{ height }}
      >
        <span className="text-sm text-gray-500">데이터가 없습니다</span>
      </div>
    );
  }

  const chartHeight = compact ? Math.min(height, 200) : height;

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveLine<NivoMetricSeries>
        data={series}
        margin={{
          top: compact ? 10 : 36,
          right: 30,
          bottom: 40,
          left: compact ? 36 : 48,
        }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 0, max: 100, stacked: false }}
        yFormat=" >-.1f"
        curve="monotoneX"
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 0,
          tickPadding: 8,
          tickRotation: 0,
          format: (value) => formatTime(String(value)),
        }}
        axisLeft={{
          tickSize: 0,
          tickPadding: 8,
          tickValues: compact ? [0, 50, 100] : [0, 25, 50, 75, 100],
          format: (value) => `${value}%`,
        }}
        colors={chartColors}
        lineWidth={2}
        enablePoints={false}
        enableGridX={false}
        enableGridY
        enableSlices="x"
        useMesh
        layers={layers}
        markers={markers}
        legends={
          compact
            ? []
            : [
                {
                  anchor: 'top-left',
                  direction: 'row',
                  translateY: -28,
                  itemWidth: 80,
                  itemHeight: 16,
                  symbolSize: 10,
                },
              ]
        }
        theme={
          {
            axis: {
              ticks: {
                text: {
                  fill: '#6b7280',
                  fontSize: compact ? 10 : 12,
                },
              },
            },
            grid: {
              line: {
                stroke: '#e5e7eb',
                strokeWidth: 1,
              },
            },
            legends: {
              text: {
                fill: '#4b5563',
                fontSize: 12,
              },
            },
          } satisfies LineSvgProps<NivoMetricSeries>['theme']
        }
        sliceTooltip={({ slice }) => (
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <p className="mb-2 text-xs text-gray-500">
              {formatTime(String(slice.points[0]?.data.x ?? ''))}
            </p>
            <div className="space-y-1">
              {slice.points.map((point) => (
                <div key={point.id} className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: point.seriesColor }}
                  />
                  <span className="text-sm text-gray-700">
                    {point.seriesId === 'actual'
                      ? '실제값'
                      : point.seriesId === 'prediction'
                        ? '예측값'
                        : point.seriesId === 'upper'
                          ? '신뢰구간 상한'
                          : '신뢰구간 하한'}
                    :
                  </span>
                  <span className="font-medium text-gray-900">
                    {Number(point.data.y).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-400">
              {METRIC_LABELS[metric]}
            </p>
          </div>
        )}
        ariaLabel={`${METRIC_LABELS[metric]} time series chart`}
      />
      {compact && (
        <div className="mt-2 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-2 w-4 rounded bg-emerald-500" />
            <span className="text-gray-600">실제값</span>
          </div>
          {showPrediction && predictions && predictions.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="h-0.5 w-4 border-t-2 border-dashed border-blue-500" />
              <span className="text-gray-600">예측</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const NivoTimeSeriesChart = memo(function NivoTimeSeriesChart(
  props: TimeSeriesChartProps
) {
  return (
    <ChartErrorBoundary
      height={props.height || 300}
      chartName={props.metric ? METRIC_LABELS[props.metric] : undefined}
      resetKey={getBoundaryResetKey(props)}
    >
      <NivoTimeSeriesChartInner {...props} />
    </ChartErrorBoundary>
  );
});
