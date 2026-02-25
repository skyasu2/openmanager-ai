import { ArrowRight, Cpu } from 'lucide-react';
import type { MetricTrendResult } from '@/types/intelligent-monitoring.types';
import { metricIcons, metricLabels } from './constants';
import { TrendIcon } from './TrendIcon';

interface TrendCardProps {
  metric: string;
  data: MetricTrendResult;
}

export function TrendCard({ metric, data }: TrendCardProps) {
  const icon = metricIcons[metric] || <Cpu className="h-5 w-5" />;
  const label = metricLabels[metric] || metric.toUpperCase();
  const isRising = data.trend === 'increasing';
  const isDecreasing = data.trend === 'decreasing';
  const bgColor = isRising
    ? 'bg-orange-50 border-orange-200'
    : isDecreasing
      ? 'bg-blue-50 border-blue-200'
      : 'bg-gray-50 border-gray-200';
  const textColor = isRising
    ? 'text-orange-700'
    : isDecreasing
      ? 'text-blue-700'
      : 'text-gray-700';

  // 변화율 바 너비 계산 (최대 ±30%를 100%로)
  const changeBarWidth = Math.min(Math.abs(data.changePercent) / 30, 1) * 100;

  return (
    <div className={`rounded-lg border p-3 ${bgColor}`}>
      <div className={`mb-2 flex items-center justify-between ${textColor}`}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        <TrendIcon trend={data.trend} />
      </div>

      {/* 현재값 → 예측값 시각화 */}
      <div className="flex items-center gap-2">
        <span className="text-sm tabular-nums text-gray-500">
          {Math.round(data.currentValue)}%
        </span>
        <ArrowRight className="h-3 w-3 text-gray-400" />
        <span className={`text-2xl font-bold tabular-nums ${textColor}`}>
          {Math.min(100, Math.max(0, Math.round(data.predictedValue)))}%
        </span>
      </div>

      {/* 변화율 미니 바 */}
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 rounded-full bg-gray-200">
            {data.changePercent !== 0 && (
              <div
                className={`absolute h-full rounded-full ${
                  data.changePercent > 0 ? 'bg-red-400' : 'bg-green-400'
                }`}
                style={{
                  width: `${changeBarWidth}%`,
                  left: data.changePercent < 0 ? 'auto' : '50%',
                  right: data.changePercent < 0 ? '50%' : 'auto',
                }}
              />
            )}
            {/* 중앙 기준선 */}
            <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-gray-400" />
          </div>
          <span
            className={`min-w-[3rem] text-right text-xs font-medium tabular-nums ${
              data.changePercent > 0
                ? 'text-red-500'
                : data.changePercent < 0
                  ? 'text-green-500'
                  : 'text-gray-400'
            }`}
          >
            {data.changePercent > 0 ? '+' : ''}
            {data.changePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="mt-1 text-xs opacity-75">
        {data.trend === 'increasing'
          ? '상승 추세'
          : data.trend === 'decreasing'
            ? '하락 추세'
            : '안정'}
        {data.confidence && (
          <span className="ml-1 opacity-60">
            (신뢰도 {Math.round(data.confidence * 100)}%)
          </span>
        )}
      </div>
      {data.thresholdBreach?.humanReadable && data.thresholdBreach.humanReadable !== '✅ 24시간 내 임계값 도달 예상 없음' && (
        <div className="mt-1 rounded bg-white/60 px-1.5 py-0.5 text-xs text-orange-600">
          {data.thresholdBreach.humanReadable}
        </div>
      )}
      {data.recovery?.humanReadable && (
        <div className="mt-1 rounded bg-white/60 px-1.5 py-0.5 text-xs text-blue-600">
          {data.recovery.humanReadable}
        </div>
      )}
    </div>
  );
}
