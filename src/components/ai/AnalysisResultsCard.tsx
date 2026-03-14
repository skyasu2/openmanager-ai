/**
 * 이상감지/예측 분석 결과 카드 v2.1
 *
 * Cloud Run /api/ai/analyze-server 응답을 시각화
 * - 현재 상태 (이상 탐지): CPU/Memory/Disk 메트릭별 상태
 * - 예측 (트렌드): 1시간 후 예측값과 변화율
 * - AI 인사이트: 패턴 분석 권장사항
 *
 * v2.1 변경사항 (2026-01-12):
 * - 서브 컴포넌트 분리 (analysis/ 폴더)
 * - 667줄 → 130줄 리팩토링
 */

'use client';

import { RefreshCw, Server, TrendingUp, XCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/format-date';
import type {
  AnalysisResponse,
  CloudRunAnalysisResponse,
  MultiServerAnalysisResponse,
} from '@/types/intelligent-monitoring.types';
import { isMultiServerResponse } from '@/types/intelligent-monitoring.types';
import {
  AnomalySection,
  InsightSection,
  ServerResultCard,
  SystemSummarySection,
  TrendSection,
} from './analysis';

interface AnalysisResultsCardProps {
  result: AnalysisResponse | null;
  isLoading: boolean;
  error: string | null;
  onRetry?: () => void;
}

// 다중 서버 결과 표시
function MultiServerResults({ data }: { data: MultiServerAnalysisResponse }) {
  return (
    <div className="space-y-4">
      {/* 종합 요약 */}
      <SystemSummarySection summary={data.summary} />

      {/* 개별 서버 결과 */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-800">
          <Server className="h-5 w-5 text-blue-500" />
          서버별 상세 분석 ({data.servers.length}개)
        </h3>
        <div className="space-y-2">
          {data.servers.map((server) => (
            <ServerResultCard key={server.serverId} server={server} />
          ))}
        </div>
      </div>

      {/* 메타 정보 */}
      <div
        className="text-center text-xs text-gray-400"
        suppressHydrationWarning
      >
        분석 시간: {formatDateTime(data.timestamp)}
      </div>
    </div>
  );
}

// 단일 서버 결과 표시
function SingleServerResults({ data }: { data: CloudRunAnalysisResponse }) {
  return (
    <div className="space-y-4">
      {data.anomalyDetection && <AnomalySection data={data.anomalyDetection} />}
      {data.trendPrediction && <TrendSection data={data.trendPrediction} />}
      {data.patternAnalysis && <InsightSection data={data.patternAnalysis} />}

      <div
        className="text-center text-xs text-gray-400"
        suppressHydrationWarning
      >
        분석 시간: {formatDateTime(data.timestamp)}
      </div>
    </div>
  );
}

// 메인 컴포넌트
export default function AnalysisResultsCard({
  result,
  isLoading,
  error,
  onRetry,
}: AnalysisResultsCardProps) {
  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-3 text-sm text-gray-600">분석 중...</p>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    const isLoginRequired = error.includes('로그인이 필요합니다');
    return (
      <div
        className={`rounded-xl border p-4 ${isLoginRequired ? 'border-blue-200 bg-blue-50' : 'border-red-200 bg-red-50'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle
              className={`h-5 w-5 ${isLoginRequired ? 'text-blue-600' : 'text-red-600'}`}
            />
            <span
              className={`font-medium ${isLoginRequired ? 'text-blue-800' : 'text-red-800'}`}
            >
              {isLoginRequired ? '로그인이 필요합니다' : '분석 실패'}
            </span>
          </div>
          {isLoginRequired ? (
            <a
              href="/login"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              로그인하기
            </a>
          ) : onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200"
            >
              다시 시도
            </button>
          ) : null}
        </div>
        <p
          className={`mt-2 text-sm ${isLoginRequired ? 'text-blue-700' : 'text-red-700'}`}
        >
          {error}
        </p>
      </div>
    );
  }

  // 결과 없음 (초기 상태)
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8">
        <TrendingUp className="h-10 w-10 text-gray-400" />
        <p className="mt-3 text-gray-600">
          &quot;분석 시작&quot; 버튼을 클릭하여 서버 상태를 분석하세요
        </p>
      </div>
    );
  }

  // 다중 서버 결과 vs 단일 서버 결과
  if (isMultiServerResponse(result)) {
    return <MultiServerResults data={result} />;
  }

  return <SingleServerResults data={result} />;
}
