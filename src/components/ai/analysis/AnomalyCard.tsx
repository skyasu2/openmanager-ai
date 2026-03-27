import { AlertTriangle, CheckCircle, Cpu } from 'lucide-react';
import type { MetricAnomalyResult } from '@/types/intelligent-monitoring.types';
import { metricIcons, metricLabels, severityColors } from './constants';
import { calculatePosition } from './utils';

interface AnomalyCardProps {
  metric: string;
  data: MetricAnomalyResult;
}

export function AnomalyCard({ metric, data }: AnomalyCardProps) {
  const icon = metricIcons[metric] || <Cpu className="h-5 w-5" />;
  const label = metricLabels[metric] || metric.toUpperCase();
  const colorClass = data.isAnomaly
    ? severityColors[data.severity]
    : 'text-green-600 bg-green-50 border-green-200';

  // 임계값 시각화를 위한 계산
  const hasThreshold = data.threshold?.upper !== undefined;
  const lower = data.threshold?.lower ?? 0;
  const upper = data.threshold?.upper ?? 100;
  const valuePosition = hasThreshold
    ? calculatePosition(data.currentValue, 0, 100)
    : 50;
  const lowerPosition = hasThreshold ? calculatePosition(lower, 0, 100) : 20;
  const upperPosition = hasThreshold ? calculatePosition(upper, 0, 100) : 80;

  return (
    <div className={`rounded-lg border p-3 ${colorClass}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{label}</span>
        </div>
        {data.isAnomaly ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            {data.severity}
          </span>
        ) : (
          <CheckCircle className="h-4 w-4" />
        )}
      </div>
      <div className="text-2xl font-bold">{Math.round(data.currentValue)}%</div>

      {/* 임계값 게이지 바 */}
      {hasThreshold && (
        <div className="mt-2">
          <div className="relative h-2 w-full rounded-full bg-gray-200">
            {/* 정상 범위 (녹색 영역) */}
            <div
              className="absolute h-full rounded-full bg-green-300/50"
              style={{
                left: `${lowerPosition}%`,
                width: `${upperPosition - lowerPosition}%`,
              }}
            />
            {/* 현재값 마커 */}
            <div
              className={`absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full ${
                data.isAnomaly ? 'bg-red-600' : 'bg-green-600'
              }`}
              style={{ left: `${valuePosition}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-2xs opacity-60">
            <span>{Math.round(lower)}%</span>
            <span>{Math.round(upper)}%</span>
          </div>
        </div>
      )}

      <div className="mt-1 text-xs opacity-75">
        {data.isAnomaly ? `이상 감지 (${data.severity})` : '정상 범위'}
      </div>
    </div>
  );
}
