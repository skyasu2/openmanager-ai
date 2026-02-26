'use client';

import { ChevronDown, ChevronRight, Server } from 'lucide-react';
import { useState } from 'react';
import type { ServerAnalysisResult } from '@/types/intelligent-monitoring.types';
import { AnomalySection } from './AnomalySection';
import { statusColors, statusLabel } from './constants';
import { InsightSection } from './InsightSection';
import { TrendSection } from './TrendSection';

interface ServerResultCardProps {
  server: ServerAnalysisResult;
}

export function ServerResultCard({ server }: ServerResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`rounded-xl border ${statusColors[server.overallStatus]}`}>
      {/* 헤더 (클릭하여 접기/펴기) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4" />
          <span className="font-medium">{server.serverName}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              server.overallStatus === 'online'
                ? 'bg-green-200 text-green-700'
                : server.overallStatus === 'warning'
                  ? 'bg-yellow-200 text-yellow-700'
                  : 'bg-red-200 text-red-700'
            }`}
          >
            {statusLabel[server.overallStatus]}
          </span>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {/* 상세 내용 */}
      {isExpanded && (
        <div className="space-y-3 border-t border-current/10 p-3">
          {server.anomalyDetection && (
            <AnomalySection data={server.anomalyDetection} />
          )}
          {server.trendPrediction && (
            <TrendSection data={server.trendPrediction} />
          )}
          {server.patternAnalysis && (
            <InsightSection data={server.patternAnalysis} />
          )}
          {!server.anomalyDetection &&
            !server.trendPrediction &&
            !server.patternAnalysis && (
              <p className="text-center text-xs text-gray-400">
                상세 분석 데이터가 없습니다. AI 엔진이 일시적으로 폴백 상태일 수
                있습니다.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
