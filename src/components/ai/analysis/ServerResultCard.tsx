'use client';

import { ChevronDown, ChevronRight, Server } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ServerAnalysisResult } from '@/types/intelligent-monitoring.types';
import { AnomalySection } from './AnomalySection';
import { statusColors, statusLabel } from './constants';
import { InsightSection } from './InsightSection';
import { TrendSection } from './TrendSection';

interface ServerResultCardProps {
  server: ServerAnalysisResult;
  defaultExpanded?: boolean;
}

export function ServerResultCard({
  server,
  defaultExpanded = false,
}: ServerResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (defaultExpanded) {
      setIsExpanded(true);
    }
  }, [defaultExpanded]);

  const anomalyCount = useMemo(() => {
    if (!server.anomalyDetection?.hasAnomalies) {
      return 0;
    }

    return Object.values(server.anomalyDetection.results || {}).filter(
      (result) => result.isAnomaly
    ).length;
  }, [server.anomalyDetection]);

  const risingTrendCount = useMemo(() => {
    if (!server.trendPrediction?.summary?.hasRisingTrends) {
      return 0;
    }

    return Object.values(server.trendPrediction.results || {}).filter(
      (result) => result.trend === 'increasing' && result.changePercent > 5
    ).length;
  }, [server.trendPrediction]);

  return (
    <div className={`rounded-xl border ${statusColors[server.overallStatus]}`}>
      {/* 헤더 (클릭하여 접기/펴기) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 shrink-0" />
            <span className="truncate font-medium">{server.serverName}</span>
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
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {anomalyCount > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
                이상 {anomalyCount}
              </span>
            ) : (
              <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                이상 없음
              </span>
            )}
            {risingTrendCount > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700">
                상승 추세 {risingTrendCount}
              </span>
            )}
          </div>
        </div>
        <span className="ml-3 inline-flex shrink-0 items-center gap-1 text-sm font-medium">
          {isExpanded ? (
            <>
              <span>상세 분석 접기</span>
              <ChevronDown className="h-4 w-4" />
            </>
          ) : (
            <>
              <span>상세 분석 보기</span>
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </span>
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
