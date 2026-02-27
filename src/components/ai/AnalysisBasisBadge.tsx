'use client';

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Wrench,
} from 'lucide-react';
import { type FC, useState } from 'react';
import type { AnalysisBasis } from '@/stores/useAISidebarStore';

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const TOOL_LABELS: Record<string, string> = {
  getServerMetrics: '서버 메트릭 조회',
  getServerMetricsAdvanced: '서버 메트릭 상세 조회',
  filterServers: '서버 필터링',
  getServerByGroup: '서버 그룹 조회',
  getServerLogs: '시스템 로그 조회',
  findRootCause: '근본 원인 분석',
  correlateMetrics: '메트릭 상관 분석',
  buildIncidentTimeline: '인시던트 타임라인',
  detectAnomalies: '이상 탐지',
  detectAnomaliesAllServers: '전체 서버 이상 탐지',
  predictTrends: '트렌드 예측',
  analyzePattern: '패턴 분석',
  searchKnowledgeBase: 'RAG 지식베이스 검색',
  recommendCommands: 'CLI 명령어 추천',
  searchWeb: '웹 검색',
  finalAnswer: '최종 응답',
};

function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName;
}

interface AnalysisBasisBadgeProps {
  basis: AnalysisBasis;
  className?: string;
}

/**
 * 분석 근거 뱃지 컴포넌트
 *
 * AI 응답의 투명성을 위해 분석에 사용된 근거 정보를 표시합니다.
 * - 데이터 소스
 * - AI 엔진
 * - 호출된 도구 목록
 * - RAG 참조 문서
 */
export const AnalysisBasisBadge: FC<AnalysisBasisBadgeProps> = ({
  basis,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getEngineColor = (engine: string) => {
    if (engine.includes('Cloud Run')) return 'text-green-600';
    if (engine.includes('Fallback')) return 'text-orange-500';
    if (engine.includes('Streaming')) return 'text-blue-500';
    return 'text-gray-600';
  };

  // finalAnswer 제외한 실질적 도구 호출
  const meaningfulTools = basis.toolsCalled?.filter((t) => t !== 'finalAnswer');

  return (
    <div
      className={`mt-2 rounded-lg border border-gray-200 bg-gray-50 text-sm ${className}`}
    >
      {/* 헤더 (클릭으로 토글) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-100 transition-colors rounded-lg"
        aria-expanded={isExpanded}
        aria-label="분석 근거 상세 보기"
      >
        <span className="flex items-center gap-2 text-gray-600">
          <Database className="h-4 w-4" />
          <span className="font-medium">분석 근거</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {/* 상세 정보 (확장 시) */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-200">
          {/* 데이터 소스 */}
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500">데이터:</span>
            <span className="text-gray-700">{basis.dataSource}</span>
          </div>

          {/* AI 엔진 */}
          <div className="flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-gray-500">엔진:</span>
            <span className={getEngineColor(basis.engine)}>{basis.engine}</span>
            {basis.ragUsed && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">
                RAG
              </span>
            )}
          </div>

          {/* 호출된 도구 */}
          {meaningfulTools && meaningfulTools.length > 0 && (
            <div className="flex items-start gap-2">
              <Wrench className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
              <span className="text-gray-500 shrink-0">도구:</span>
              <div className="flex flex-wrap gap-1">
                {meaningfulTools.map((tool) => (
                  <span
                    key={tool}
                    className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-xs"
                  >
                    {getToolLabel(tool)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 시간 범위 */}
          {basis.timeRange && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-500">기간:</span>
              <span className="text-gray-700">{basis.timeRange}</span>
            </div>
          )}

          {/* 서버 수 */}
          {basis.serverCount && (
            <div className="flex items-center gap-2">
              <span className="ml-5 text-gray-500">분석 서버:</span>
              <span className="text-gray-700">{basis.serverCount}개</span>
            </div>
          )}

          {/* RAG 출처 목록 */}
          {basis.ragSources && basis.ragSources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-1.5">
                <BookOpen className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-gray-600 font-medium text-xs">
                  RAG 참조 문서
                </span>
              </div>
              <div className="space-y-1 ml-5">
                {basis.ragSources.map((source, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400 shrink-0">[{idx + 1}]</span>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline truncate flex-1 min-w-0"
                        title={source.url}
                      >
                        {source.title}
                      </a>
                    ) : (
                      <span
                        className="text-gray-700 truncate flex-1 min-w-0"
                        title={source.title}
                      >
                        {source.title}
                      </span>
                    )}
                    {source.url && (
                      <ExternalLink className="h-3 w-3 shrink-0 text-blue-400" />
                    )}
                    {source.sourceType !== 'web' && (
                      <span
                        className={`px-1 py-0.5 rounded text-2xs font-medium shrink-0 ${
                          source.similarity >= 0.8
                            ? 'bg-green-100 text-green-700'
                            : source.similarity >= 0.6
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {Math.round(source.similarity * 100)}%
                      </span>
                    )}
                    <span className="px-1 py-0.5 rounded bg-purple-50 text-purple-600 text-2xs shrink-0">
                      {source.sourceType === 'web' && source.url
                        ? extractDomain(source.url)
                        : source.sourceType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalysisBasisBadge;
