'use client';

import { Lightbulb } from 'lucide-react';
import type { CloudRunPatternAnalysis } from '@/types/intelligent-monitoring.types';

interface InsightSectionProps {
  data: CloudRunPatternAnalysis;
}

export function InsightSection({ data }: InsightSectionProps) {
  if (!data.analysisResults || data.analysisResults.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-purple-500" />
        <h3 className="font-semibold text-gray-800">AI 인사이트</h3>
      </div>
      <div className="space-y-2">
        {data.analysisResults.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-2 rounded-lg bg-purple-50 p-3"
          >
            <span className="mt-0.5 text-purple-400">•</span>
            <div>
              <span className="text-sm text-purple-800">{item.insights}</span>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-600">
                  {item.pattern}
                </span>
                <span className="text-xs text-purple-400">
                  신뢰도 {Math.round(item.confidence * 100)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
