'use client';

/**
 * UPlotTimeSeries - uPlot React 래퍼 컴포넌트
 *
 * Grafana가 사용하는 동일한 시계열 엔진(uPlot)으로 메트릭 시각화
 * - ResizeObserver 기반 자동 리사이즈
 * - 다크모드 대응
 * - 색상 코딩: CPU=빨강, Memory=파랑, Disk=보라, Network=녹색
 *
 * @created 2026-02-04
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

// ============================================================================
// Types
// ============================================================================

export type MetricColorKey = 'cpu' | 'memory' | 'disk' | 'network';

/** number[][] 호환 데이터 형식 (uPlot 생성 시 as uPlot.AlignedData 캐스팅) */
type UPlotData = Array<number[] | (number | null | undefined)[]>;

export type UPlotTimeSeriesProps = {
  /** uPlot AlignedData: [timestamps, ...series] */
  data: UPlotData;
  /** 시리즈 라벨 목록 (timestamps 제외) */
  seriesLabels: string[];
  /** 메트릭 타입별 색상 키 */
  colorKey?: MetricColorKey;
  /** 커스텀 시리즈 색상 (colorKey 보다 우선) */
  seriesColors?: string[];
  /** 컨테이너 높이 CSS 클래스 */
  height?: string;
  /** 추가 CSS 클래스 */
  className?: string;
  /** Y축 단위 라벨 */
  yAxisLabel?: string;
  /** Y축 범위 고정 */
  yRange?: [number, number];
  /** 차트 제목 */
  title?: string;
};

// ============================================================================
// Color Palette
// ============================================================================

const METRIC_COLORS: Record<MetricColorKey, string> = {
  cpu: '#ef4444', // red-500
  memory: '#3b82f6', // blue-500
  disk: '#8b5cf6', // violet-500
  network: '#22c55e', // green-500
};

const DEFAULT_PALETTE = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
  '#14b8a6',
  '#6366f1',
  '#84cc16',
  '#e11d48',
  '#0ea5e9',
  '#a855f7',
  '#10b981',
];

// ============================================================================
// Component
// ============================================================================

export function UPlotTimeSeries({
  data,
  seriesLabels,
  colorKey,
  seriesColors,
  height = 'h-64',
  className = '',
  yAxisLabel,
  yRange,
  title,
}: UPlotTimeSeriesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Resolve colors
  const resolveColors = useCallback((): string[] => {
    if (seriesColors) return seriesColors;
    if (colorKey) {
      return [METRIC_COLORS[colorKey]];
    }
    return DEFAULT_PALETTE;
  }, [seriesColors, colorKey]);

  // Build uPlot options
  const buildOpts = useCallback(
    (width: number, chartHeight: number): uPlot.Options => {
      const colors = resolveColors();
      const textColor = isDark ? '#9ca3af' : '#6b7280';
      const gridColor = isDark ? 'rgba(75,85,99,0.3)' : 'rgba(209,213,219,0.5)';

      const series: uPlot.Series[] = [
        {}, // x-axis (timestamps)
        ...seriesLabels.map((label, i) => ({
          label,
          stroke: colors[i % colors.length],
          width: 1.5,
          fill: `${colors[i % colors.length]}18`,
        })),
      ];

      return {
        width,
        height: chartHeight,
        title: title,
        cursor: {
          drag: { x: true, y: false },
        },
        scales: {
          x: { time: true },
          y: yRange
            ? { range: () => yRange }
            : {
                range: (_u: uPlot, min: number, max: number) => {
                  const pad = (max - min) * 0.1 || 5;
                  return [Math.max(0, min - pad), max + pad];
                },
              },
        },
        axes: [
          {
            stroke: textColor,
            grid: { stroke: gridColor },
            ticks: { stroke: gridColor },
            values: (_u: uPlot, vals: number[]) =>
              vals.map((v) => {
                const d = new Date(v * 1000);
                return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
              }),
          },
          {
            stroke: textColor,
            grid: { stroke: gridColor },
            ticks: { stroke: gridColor },
            label: yAxisLabel,
            size: 60,
          },
        ],
        series,
      };
    },
    [seriesLabels, resolveColors, isDark, yAxisLabel, yRange, title]
  );

  // Create/update chart
  useEffect(() => {
    const container = containerRef.current;
    if (!container || data[0]?.length === 0) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;

    // Destroy previous instance
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const chartHeight = rect.height - 8; // small padding
    const opts = buildOpts(rect.width, chartHeight > 0 ? chartHeight : 200);

    chartRef.current = new uPlot(opts, data as uPlot.AlignedData, container);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, buildOpts]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;

      const { width, height: h } = entry.contentRect;
      if (width > 0 && h > 0) {
        chartRef.current.setSize({ width, height: h - 8 });
      }
    });

    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${height} ${className} w-full overflow-hidden`}
    />
  );
}
