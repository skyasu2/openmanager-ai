'use client';

import { AlertTriangle } from 'lucide-react';
import type { CloudRunAnomalyDetection } from '@/types/intelligent-monitoring.types';
import { AnomalyCard } from './AnomalyCard';
import { getTimePatternHint } from './utils';

interface AnomalySectionProps {
  data: CloudRunAnomalyDetection;
}

export function AnomalySection({ data }: AnomalySectionProps) {
  const metrics = Object.entries(data.results || {});
  const timeHint = getTimePatternHint();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-orange-500" />
        <h3 className="font-semibold text-gray-800">현재 상태</h3>
        {data.hasAnomalies && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            {data.anomalyCount}개 이상 감지
          </span>
        )}
        {/* 시간대 패턴 힌트 */}
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${timeHint.color}`}
        >
          {timeHint.label}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map(([metric, result]) => (
          <AnomalyCard key={metric} metric={metric} data={result} />
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        알고리즘: {data._algorithm}
      </div>
    </div>
  );
}
