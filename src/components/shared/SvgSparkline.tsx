'use client';

import type React from 'react';
import { useMemo } from 'react';

export interface SvgSparklineProps {
  data: number[] | Array<{ time: string; value: number }>;
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  fill?: boolean;
  showTooltip?: boolean;
  disableAnimation?: boolean;
  showLabels?: boolean;
}

interface SparklinePoint {
  index: number;
  value: number;
  time?: string;
}

function isFiniteMetricValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeData(
  data: SvgSparklineProps['data'] | undefined
): SparklinePoint[] {
  if (!data || data.length === 0) return [];

  if (typeof data[0] === 'object' && data[0] && 'value' in data[0]) {
    return (data as Array<{ time: string; value: number }>).flatMap(
      (item, index) =>
        isFiniteMetricValue(item.value)
          ? [{ index, value: item.value, time: item.time }]
          : []
    );
  }

  return (data as number[]).flatMap((value, index) =>
    isFiniteMetricValue(value) ? [{ index, value }] : []
  );
}

function toSvgPoint(
  point: SparklinePoint,
  pointIndex: number,
  pointCount: number,
  width: number,
  height: number,
  strokeWidth: number
): string {
  const chartWidth = Math.max(width - strokeWidth * 2, 1);
  const chartHeight = Math.max(height - strokeWidth * 2, 1);
  const x =
    pointCount === 1
      ? width / 2
      : strokeWidth + (pointIndex / (pointCount - 1)) * chartWidth;
  const boundedValue = Math.max(0, Math.min(100, point.value));
  const y = strokeWidth + (1 - boundedValue / 100) * chartHeight;

  return `${Number(x.toFixed(2))},${Number(y.toFixed(2))}`;
}

function buildLinePath(points: string[]): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point}`)
    .join(' ');
}

function buildAreaPath(points: string[], height: number, strokeWidth: number) {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';

  const [firstX] = first.split(',');
  const [lastX] = last.split(',');
  const baseline = Math.max(height - strokeWidth, 0);

  return `${buildLinePath(points)} L ${lastX},${baseline} L ${firstX},${baseline} Z`;
}

function buildTooltipText(points: SparklinePoint[]): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) return '';

  const firstLabel = first.time ? `${first.time} ` : '';
  const lastLabel = last.time ? `${last.time} ` : '';

  return `${firstLabel}${first.value.toFixed(1)}% -> ${lastLabel}${last.value.toFixed(1)}%`;
}

export const SvgSparkline: React.FC<SvgSparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color = '#3b82f6',
  strokeWidth = 2,
  fill = false,
  showTooltip = false,
  disableAnimation = true,
  showLabels = false,
}) => {
  const chartData = useMemo(() => normalizeData(data), [data]);

  if (chartData.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-xs text-gray-400"
      >
        --
      </div>
    );
  }

  const svgPoints = chartData.map((point, index) =>
    toSvgPoint(point, index, chartData.length, width, height, strokeWidth)
  );
  const linePath = buildLinePath(svgPoints);
  const areaPath = buildAreaPath(svgPoints, height, strokeWidth);
  const firstValue = chartData[0]?.value ?? 0;
  const lastValue = chartData[chartData.length - 1]?.value ?? 0;

  return (
    <div className="relative flex items-center gap-1">
      {showLabels && (
        <span className="text-2xs font-bold tabular-nums text-gray-500 shrink-0">
          {Math.round(firstValue)}
        </span>
      )}

      <svg
        data-testid="svg-sparkline"
        data-point-count={chartData.length}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Metric trend sparkline"
      >
        {showTooltip && <title>{buildTooltipText(chartData)}</title>}
        {fill && (
          <path
            data-testid="svg-sparkline-area"
            d={areaPath}
            fill={color}
            fillOpacity={0.15}
          />
        )}
        <path
          data-testid="svg-sparkline-line"
          d={linePath}
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          style={
            disableAnimation
              ? undefined
              : {
                  transition: 'stroke-dashoffset 300ms ease',
                }
          }
        />
      </svg>

      {showLabels && (
        <span className="text-2xs font-bold tabular-nums text-gray-500 shrink-0">
          {Math.round(lastValue)}
        </span>
      )}
    </div>
  );
};
