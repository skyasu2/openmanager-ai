import { useId } from 'react';
import { OTEL_METRIC } from '@/constants/otel-metric-names';
import { normalizeUtilizationPercent } from '@/services/metrics/metric-normalization';

/**
 * MetricSparkline - AI 분석 카드용 초경량 인라인 스파크라인
 *
 * 차트 라이브러리 없이 순수 SVG `<polyline>` 로 메트릭 최근 추이를 표시한다.
 * (uPlot 풀차트는 축·ResizeObserver 포함이라 채팅 카드엔 과함 → 인라인 SVG가 더 가벼움)
 *
 * - 백분율 메트릭(0~100) 가정. 값 범위는 [0,100] 고정 스케일이라 카드 간 비교 가능.
 * - 예측값(predicted)이 있으면 마지막 실측점에서 점선으로 이어 별도 마커 표시.
 * - critical/warning 임계선(threshold)은 점선 가로줄로 표시.
 * - 다크모드는 currentColor 기반이라 부모 text 색상을 따른다.
 * - 데이터가 2점 미만이면 아무것도 렌더하지 않는다(graceful).
 */

export type MetricSparklineProps = {
  /** 백분율 시계열 (오래된→최신 순, 0~100) */
  values: number[];
  /** 선택: 다음 구간 예측값 (마지막 실측점 뒤에 점선으로 연결) */
  predicted?: number | null;
  /** 추세 방향 (선 색상 결정). 없으면 currentColor */
  trend?: 'increasing' | 'decreasing' | 'stable';
  /** 선택: 임계선 (예: critical 90) */
  threshold?: number | null;
  /** SVG viewBox 너비 (px). 기본 96 */
  width?: number;
  /** SVG viewBox 높이 (px). 기본 28 */
  height?: number;
  className?: string;
  /** 접근성 라벨 */
  ariaLabel?: string;
};

const TREND_STROKE: Record<
  NonNullable<MetricSparklineProps['trend']>,
  string
> = {
  increasing: 'text-orange-500',
  decreasing: 'text-blue-500',
  stable: 'text-gray-400',
};

function clampPercent(v: number): number {
  return Math.max(0, Math.min(100, v));
}

export function MetricSparkline({
  values,
  predicted,
  trend = 'stable',
  threshold,
  width = 96,
  height = 28,
  className = '',
  ariaLabel,
}: MetricSparklineProps) {
  const gradientId = useId();

  const clean = values.filter((v) => Number.isFinite(v)).map(clampPercent);
  if (clean.length < 2) {
    return null;
  }

  const pad = 2;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  // x: 인덱스 균등 분포 / y: 0~100 → 상하 반전 (100이 위)
  const toX = (i: number, total: number) =>
    pad + (total <= 1 ? 0 : (i / (total - 1)) * innerW);
  const toY = (v: number) => pad + (1 - v / 100) * innerH;

  const points = clean.map((v, i) => `${toX(i, clean.length)},${toY(v)}`);
  const polyline = points.join(' ');

  const lastX = toX(clean.length - 1, clean.length);
  const lastY = toY(clean[clean.length - 1] ?? 0);

  const hasPredicted =
    typeof predicted === 'number' && Number.isFinite(predicted);
  const predY = hasPredicted ? toY(clampPercent(predicted as number)) : null;
  // 예측점은 마지막 실측점에서 한 스텝 뒤 (오른쪽 끝)
  const predX = width - pad;

  const strokeClass = TREND_STROKE[trend];
  const thresholdY =
    typeof threshold === 'number' && Number.isFinite(threshold)
      ? toY(clampPercent(threshold))
      : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`overflow-visible ${strokeClass} ${className}`}
      role="img"
      aria-label={ariaLabel ?? '메트릭 추이 스파크라인'}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 임계선 */}
      {thresholdY !== null && (
        <line
          x1={pad}
          y1={thresholdY}
          x2={width - pad}
          y2={thresholdY}
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeWidth="0.75"
          strokeDasharray="2 2"
          className="text-red-400"
        />
      )}

      {/* 면적 채움 */}
      <polygon
        points={`${pad},${height - pad} ${polyline} ${lastX},${height - pad}`}
        fill={`url(#${gradientId})`}
        stroke="none"
      />

      {/* 실측 라인 */}
      <polyline
        points={polyline}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 예측 점선 + 마커 */}
      {predY !== null && (
        <>
          <line
            x1={lastX}
            y1={lastY}
            x2={predX}
            y2={predY}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="2 2"
            strokeOpacity="0.7"
          />
          <circle cx={predX} cy={predY} r="1.8" fill="currentColor" />
        </>
      )}

      {/* 마지막 실측점 마커 */}
      <circle cx={lastX} cy={lastY} r="1.6" fill="currentColor" />
    </svg>
  );
}

// ============================================================================
// 📈 As-of TimeSeries Slice Helpers
// ============================================================================

import type { JobDataSlot } from '@/types/ai-jobs';
import type { OTelTimeSeries } from '@/types/otel-metrics';

const TIME_SERIES_METRIC_BY_ANALYSIS_METRIC: Record<string, string> = {
  cpu: OTEL_METRIC.CPU,
  memory: OTEL_METRIC.MEMORY,
  disk: OTEL_METRIC.DISK,
  network: OTEL_METRIC.NETWORK,
  load1: OTEL_METRIC.LOAD_1M,
  load5: OTEL_METRIC.LOAD_5M,
};

const PERCENT_ANALYSIS_METRICS = new Set(['cpu', 'memory', 'disk', 'network']);

/**
 * 타임스탬프에서 KST(UTC+9) 기준 slotIndex (0~143) 추출
 */
export function getSlotIndexFromTimestamp(timestamp: number): number {
  const ms = timestamp > 1e11 ? timestamp : timestamp * 1000;
  const kstDate = new Date(ms + 9 * 60 * 60 * 1000);
  const minutes = kstDate.getUTCHours() * 60 + kstDate.getUTCMinutes();
  return Math.floor(minutes / 10);
}

/**
 * getTimeSeries() 시계열 매트릭스에서 queryAsOfDataSlot 앵커 시점 기준 최근 N포인트 값을 추출한다.
 */
export function sliceTimeSeriesForAsOf(
  timeSeries: OTelTimeSeries,
  serverId: string,
  metric: string,
  dataSlot: JobDataSlot | undefined,
  limit: number = 12
): number[] {
  const serverIdx = timeSeries.serverIds.indexOf(serverId);
  if (serverIdx === -1) return [];

  const metricName = TIME_SERIES_METRIC_BY_ANALYSIS_METRIC[metric] ?? metric;
  const metricMatrix = timeSeries.metrics[metricName];
  if (!metricMatrix) return [];
  const fullValues = metricMatrix[serverIdx];
  if (!fullValues) return [];

  const normalizeValues = (values: number[]) =>
    PERCENT_ANALYSIS_METRICS.has(metric)
      ? values.map((value) => normalizeUtilizationPercent(value))
      : values;

  if (!dataSlot) {
    return normalizeValues(fullValues.slice(-limit));
  }

  // 앵커 인덱스(slotIndex 일치 지점) 탐색
  let anchorIdx = -1;
  for (let i = 0; i < timeSeries.timestamps.length; i++) {
    const ts = timeSeries.timestamps[i];
    if (
      ts !== undefined &&
      getSlotIndexFromTimestamp(ts) === dataSlot.slotIndex
    ) {
      anchorIdx = i;
      break;
    }
  }

  // 정확한 매칭이 없을 경우, 앵커 슬롯 이하의 가장 최근 포인트 매칭
  if (anchorIdx === -1) {
    for (let i = timeSeries.timestamps.length - 1; i >= 0; i--) {
      const ts = timeSeries.timestamps[i];
      if (
        ts !== undefined &&
        getSlotIndexFromTimestamp(ts) <= dataSlot.slotIndex
      ) {
        anchorIdx = i;
        break;
      }
    }
  }

  if (anchorIdx === -1) {
    return normalizeValues(fullValues.slice(-limit));
  }

  const start = Math.max(0, anchorIdx - limit + 1);
  return normalizeValues(fullValues.slice(start, anchorIdx + 1));
}
