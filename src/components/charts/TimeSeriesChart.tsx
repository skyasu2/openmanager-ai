/**
 * 시계열 차트 컴포넌트
 *
 * 기능:
 * - 실제값 라인 (실선)
 * - 예측값 라인 (점선 + 신뢰구간 밴드)
 * - 이상 구간 하이라이트 (빨간 영역)
 * - 임계값 라인 (warning/critical)
 * - 줌/패닝 (brush)
 * - 툴팁
 */

'use client';

import { memo, useMemo, useState } from 'react';
import {
  Area,
  Brush,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartErrorBoundary } from '@/components/error/ChartErrorBoundary';

// ============================================================================
// Types
// ============================================================================

export interface MetricDataPoint {
  timestamp: string;
  value: number;
}

export interface PredictionDataPoint {
  timestamp: string;
  predicted: number;
  upper: number; // 95% CI upper bound
  lower: number; // 95% CI lower bound
}

export interface AnomalyDataPoint {
  startTime: string;
  endTime: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

export interface TimeSeriesChartProps {
  /** 실제 메트릭 데이터 */
  data: MetricDataPoint[];
  /** 예측 데이터 (선택적) */
  predictions?: PredictionDataPoint[];
  /** 이상 탐지 구간 (선택적) */
  anomalies?: AnomalyDataPoint[];
  /** 메트릭 타입 */
  metric: 'cpu' | 'memory' | 'disk' | 'network';
  /** 시간 범위 */
  timeRange?: '1h' | '6h' | '24h' | '7d';
  /** 커스텀 임계값 */
  thresholds?: { warning: number; critical: number };
  /** 차트 높이 */
  height?: number;
  /** 예측선 표시 여부 */
  showPrediction?: boolean;
  /** 이상 구간 표시 여부 */
  showAnomalies?: boolean;
  /** 임계값 라인 표시 여부 */
  showThresholds?: boolean;
  /** Brush (시간 선택) 표시 여부 */
  showBrush?: boolean;
  /** 컴팩트 모드 */
  compact?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const THRESHOLD_DEFAULTS: Record<
  string,
  { warning: number; critical: number }
> = {
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 80, critical: 90 },
  disk: { warning: 85, critical: 95 },
  network: { warning: 70, critical: 85 },
};

const METRIC_LABELS: Record<string, string> = {
  cpu: 'CPU',
  memory: '메모리',
  disk: '디스크',
  network: '네트워크',
};

const ANOMALY_COLORS: Record<string, string> = {
  low: '#fef3c7',
  medium: '#fde68a',
  high: '#fdba74',
  critical: '#fca5a5',
};

// ============================================================================
// Utils
// ============================================================================

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return timestamp;
  }
}

function formatFullTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return timestamp;
  }
}

// ============================================================================
// Custom Tooltip Component
// ============================================================================

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  metric: string;
}

function CustomTooltip({ active, payload, label, metric }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs text-gray-500">
        {formatFullTime(label || '')}
      </p>
      <div className="space-y-1">
        {payload.map((entry, index) => {
          if (entry.value === undefined || entry.value === null) return null;
          return (
            <div key={index} className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-gray-700">{entry.name}:</span>
              <span className="font-medium text-gray-900">
                {entry.value.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 border-t border-gray-100 pt-2 text-xs text-gray-400">
        {METRIC_LABELS[metric]}
      </p>
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

interface CombinedDataPoint {
  timestamp: string;
  value?: number;
  predicted?: number;
  upper?: number;
  lower?: number;
}

const TimeSeriesChartInner = memo(function TimeSeriesChartInner({
  data,
  predictions,
  anomalies,
  metric,
  timeRange: _timeRange = '6h', // Used for future time-based formatting
  thresholds,
  height = 300,
  showPrediction = true,
  showAnomalies = true,
  showThresholds = true,
  showBrush = false,
  compact = false,
}: TimeSeriesChartProps) {
  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>();
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>();

  const effectiveThresholds =
    thresholds ?? THRESHOLD_DEFAULTS[metric] ?? THRESHOLD_DEFAULTS.cpu;

  // Merge actual + prediction data (Map 기반 O(n+m))
  const combinedData = useMemo(() => {
    const mergedMap = new Map<string, CombinedDataPoint>();

    for (const d of data) {
      mergedMap.set(d.timestamp, { timestamp: d.timestamp, value: d.value });
    }

    if (predictions && showPrediction) {
      for (const p of predictions) {
        const existing = mergedMap.get(p.timestamp);
        if (existing) {
          existing.predicted = p.predicted;
          existing.upper = p.upper;
          existing.lower = p.lower;
        } else {
          mergedMap.set(p.timestamp, {
            timestamp: p.timestamp,
            predicted: p.predicted,
            upper: p.upper,
            lower: p.lower,
          });
        }
      }
    }

    return Array.from(mergedMap.values()).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [data, predictions, showPrediction]);

  // Handle brush change
  const handleBrushChange = (brushData: {
    startIndex?: number;
    endIndex?: number;
  }) => {
    setBrushStartIndex(brushData.startIndex);
    setBrushEndIndex(brushData.endIndex);
  };

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
    <div className="w-full">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ComposedChart
          data={combinedData}
          margin={{
            top: 10,
            right: 30,
            left: compact ? 0 : 10,
            bottom: showBrush ? 30 : 10,
          }}
        >
          {/* X축 - 시간 */}
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fontSize: compact ? 10 : 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
          />

          {/* Y축 - 퍼센트 */}
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: compact ? 10 : 12, fill: '#6b7280' }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            tickFormatter={(value) => `${value}%`}
            width={compact ? 35 : 45}
          />

          {/* 툴팁 */}
          <Tooltip content={<CustomTooltip metric={metric} />} />

          {/* 범례 (컴팩트 모드에서는 숨김) */}
          {!compact && (
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => (
                <span className="text-sm text-gray-600">{value}</span>
              )}
            />
          )}

          {/* 임계값 라인 */}
          {showThresholds && effectiveThresholds && (
            <>
              <ReferenceLine
                y={effectiveThresholds.warning}
                stroke="#f59e0b"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={
                  compact
                    ? undefined
                    : {
                        value: '경고',
                        position: 'insideTopRight',
                        fill: '#f59e0b',
                        fontSize: 10,
                      }
                }
              />
              <ReferenceLine
                y={effectiveThresholds.critical}
                stroke="#ef4444"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={
                  compact
                    ? undefined
                    : {
                        value: '심각',
                        position: 'insideTopRight',
                        fill: '#ef4444',
                        fontSize: 10,
                      }
                }
              />
            </>
          )}

          {/* 이상 구간 하이라이트 */}
          {showAnomalies &&
            anomalies?.map((anomaly, i) => (
              <ReferenceArea
                key={`anomaly-${i}`}
                x1={anomaly.startTime}
                x2={anomaly.endTime}
                fill={ANOMALY_COLORS[anomaly.severity]}
                fillOpacity={0.4}
                stroke={anomaly.severity === 'critical' ? '#ef4444' : '#f59e0b'}
                strokeWidth={1}
                strokeOpacity={0.6}
              />
            ))}

          {/* 예측 신뢰구간 (Area) */}
          {showPrediction && predictions && predictions.length > 0 && (
            <Area
              type="monotone"
              dataKey="upper"
              stroke="none"
              fill="#3b82f6"
              fillOpacity={0.1}
              name="신뢰구간 상한"
              legendType="none"
            />
          )}

          {showPrediction && predictions && predictions.length > 0 && (
            <Area
              type="monotone"
              dataKey="lower"
              stroke="none"
              fill="#ffffff"
              fillOpacity={1}
              name="신뢰구간 하한"
              legendType="none"
            />
          )}

          {/* 실제값 라인 */}
          <Line
            type="monotone"
            dataKey="value"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#10b981' }}
            name="실제값"
            connectNulls
          />

          {/* 예측값 라인 */}
          {showPrediction && predictions && predictions.length > 0 && (
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6' }}
              name="예측값"
              connectNulls
            />
          )}

          {/* 시간 범위 선택 (Brush) */}
          {showBrush && (
            <Brush
              dataKey="timestamp"
              height={30}
              stroke="#8884d8"
              tickFormatter={formatTime}
              startIndex={brushStartIndex}
              endIndex={brushEndIndex}
              onChange={handleBrushChange}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* 범례 요약 (컴팩트 모드) */}
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
});

TimeSeriesChartInner.displayName = 'TimeSeriesChartInner';

/**
 * TimeSeriesChart with Error Boundary
 * 차트 렌더링 오류를 안전하게 처리합니다.
 */
export const TimeSeriesChart = memo(function TimeSeriesChart(
  props: TimeSeriesChartProps
) {
  return (
    <ChartErrorBoundary
      height={props.height || 300}
      chartName={props.metric ? METRIC_LABELS[props.metric] : undefined}
    >
      <TimeSeriesChartInner {...props} />
    </ChartErrorBoundary>
  );
});

TimeSeriesChart.displayName = 'TimeSeriesChart';

export default TimeSeriesChart;
