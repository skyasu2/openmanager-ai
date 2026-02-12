'use client';

/**
 * 📊 Enhanced Server Modal Shared Components
 *
 * Reusable components for the server modal system:
 * - RealtimeChart: uPlot Canvas 기반 실시간 차트
 * - Common UI elements and visualizations
 */

import type { FC } from 'react';
import { UPlotTimeSeries } from '@/components/charts/uplot/UPlotTimeSeries';

/**
 * 📈 실시간 차트 컴포넌트 Props
 */
interface RealtimeChartProps {
  /** 차트에 표시할 데이터 배열 (0-100 범위 권장) */
  data: number[];
  /** 차트 선 및 영역 색상 (hex 코드) */
  color: string;
  /** 차트 제목/라벨 */
  label: string;
  /** 차트 높이 (픽셀 단위) */
  height?: number;
}

/**
 * 📊 실시간 차트 컴포넌트
 *
 * uPlot Canvas 기반 실시간 데이터 시각화 컴포넌트
 * - number[] → uPlot AlignedData [timestamps[], values[]] 변환
 * - 10초 간격 타임스탬프 자동 생성
 * - 기존 Props 인터페이스 100% 유지 (소비자 변경 불필요)
 */
export const RealtimeChart: FC<RealtimeChartProps> = ({
  data,
  color,
  label,
  height = 100,
}) => {
  if (data.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/40"
      >
        데이터 대기중...
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const interval = 10;
  const timestamps = data.map((_, i) => now - (data.length - 1 - i) * interval);
  const uplotData = [timestamps, data];
  const lastValue = data[data.length - 1] ?? 0;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 shadow-xs">
      <div style={{ height: `${height}px` }}>
        <UPlotTimeSeries
          data={uplotData}
          seriesLabels={[label]}
          seriesColors={[color]}
          height="h-full"
          yRange={[0, 100]}
        />
      </div>
      <div className="mt-1 text-right">
        <span className="text-sm font-bold" style={{ color }}>
          {lastValue.toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

/**
 * 💡 상태 표시 LED 컴포넌트
 */
interface StatusLEDProps {
  /** 상태 ('running' | 'stopped' | 'warning' | 'error') */
  status: 'running' | 'stopped' | 'warning' | 'error';
  /** LED 크기 (픽셀 단위) */
  size?: number;
  /** 애니메이션 활성화 여부 */
  animated?: boolean;
}

export const StatusLED: FC<StatusLEDProps> = ({
  status,
  size = 8,
  animated = true,
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-500 shadow-green-200';
      case 'stopped':
        return 'bg-red-500 shadow-red-200';
      case 'warning':
        return 'bg-yellow-500 shadow-yellow-200';
      case 'error':
        return 'bg-red-600 shadow-red-300';
      default:
        return 'bg-gray-400 shadow-gray-200';
    }
  };

  return (
    <div
      className={`rounded-full shadow-xs ${getStatusColor()} ${
        animated ? 'animate-pulse' : ''
      }`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    />
  );
};

/**
 * 📊 미니 진행률 바 컴포넌트
 */
interface MiniProgressBarProps {
  /** 진행률 (0-100) */
  value: number;
  /** 바 색상 */
  color?: string;
  /** 높이 (픽셀 단위) */
  height?: number;
  /** 배경색 */
  background?: string;
}

export const MiniProgressBar: FC<MiniProgressBarProps> = ({
  value,
  color = '#3b82f6',
  height = 8,
  background = '#e5e7eb',
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className="relative overflow-hidden rounded-full"
      style={{ height: `${height}px`, backgroundColor: background }}
    >
      <div
        className="h-full rounded-full transition-all duration-300 ease-out"
        style={{
          width: `${clampedValue}%`,
          backgroundColor: color,
        }}
      />
    </div>
  );
};

/**
 * 🏷️ 상태 배지 컴포넌트
 */
interface StatusBadgeProps {
  /** 상태 텍스트 */
  status: string;
  /** 배지 색상 타입 */
  variant?: 'success' | 'warning' | 'error' | 'info';
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: FC<StatusBadgeProps> = ({
  status,
  variant = 'info',
  size = 'sm',
}) => {
  const getVariantClasses = () => {
    const variants = {
      success: 'bg-linear-to-r from-green-100 to-green-200 text-green-800',
      warning: 'bg-linear-to-r from-yellow-100 to-yellow-200 text-yellow-800',
      error: 'bg-linear-to-r from-red-100 to-red-200 text-red-800',
      info: 'bg-linear-to-r from-blue-100 to-blue-200 text-blue-800',
    };
    return variants[variant];
  };

  const getSizeClasses = () => {
    const sizes = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    };
    return sizes[size];
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold shadow-xs ${getVariantClasses()} ${getSizeClasses()} `}
    >
      {status}
    </span>
  );
};
