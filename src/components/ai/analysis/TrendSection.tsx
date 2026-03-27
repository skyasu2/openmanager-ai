'use client';

import { TrendingUp } from 'lucide-react';
import type { CloudRunTrendPrediction } from '@/types/intelligent-monitoring.types';
import { TrendCard } from './TrendCard';

interface TrendSectionProps {
  data: CloudRunTrendPrediction;
}

export function TrendSection({ data }: TrendSectionProps) {
  const metrics = Object.entries(data.results || {});

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-gray-800">
          {data.predictionHorizon} 후 예측
        </h3>
        {data.summary?.hasRisingTrends && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
            상승 추세 감지
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {metrics.map(([metric, result]) => (
          <TrendCard key={metric} metric={metric} data={result} />
        ))}
      </div>
      <div className="mt-2 text-xs text-gray-500">
        알고리즘: {data._algorithm}
      </div>
    </div>
  );
}
