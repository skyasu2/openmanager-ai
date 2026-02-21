/**
 * Job Progress Indicator Component
 *
 * @description Job Queue 진행률을 시각적으로 표시하는 컴포넌트
 * - 진행률 바 (0-100%)
 * - 현재 AI 작업 단계 표시 (아이콘 + 설명)
 * - 경과 시간 표시
 *
 * @created 2025-12-30
 * @updated 2025-12-30 - 상세 작업 표시 추가
 */

'use client';

import {
  Bot,
  Brain,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Route,
  Search,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { AsyncQueryProgress } from '@/hooks/ai/useAsyncAIQuery';

// ============================================================================
// Types
// ============================================================================

interface JobProgressIndicatorProps {
  /** 진행 상태 */
  progress: AsyncQueryProgress | null;
  /** 로딩 중 여부 */
  isLoading: boolean;
  /** Job ID */
  jobId?: string | null;
  /** 취소 핸들러 */
  onCancel?: () => void;
}

// ============================================================================
// Stage Configuration (아이콘 + 기본 메시지)
// ============================================================================

interface StageConfig {
  icon: React.ReactNode;
  defaultMessage: string;
  color: string;
}

const STAGE_CONFIG: Record<string, StageConfig> = {
  init: {
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    defaultMessage: '요청 준비 중...',
    color: 'text-blue-600',
  },
  retrying: {
    icon: <RefreshCw className="h-4 w-4 animate-spin" />,
    defaultMessage: '재시도 중...',
    color: 'text-orange-600',
  },
  reconnecting: {
    icon: <Wifi className="h-4 w-4 animate-pulse" />,
    defaultMessage: '연결 복구 중...',
    color: 'text-yellow-600',
  },
  initializing: {
    icon: <Bot className="h-4 w-4 animate-pulse" />,
    defaultMessage: 'AI 에이전트 초기화 중...',
    color: 'text-purple-600',
  },
  routing: {
    icon: <Route className="h-4 w-4 animate-pulse" />,
    defaultMessage: 'Supervisor가 적절한 에이전트 선택 중...',
    color: 'text-indigo-600',
  },
  analyzing: {
    icon: <Search className="h-4 w-4 animate-pulse" />,
    defaultMessage: '쿼리 분석 중...',
    color: 'text-cyan-600',
  },
  processing: {
    icon: <Brain className="h-4 w-4 animate-pulse" />,
    defaultMessage: 'AI 에이전트가 응답 생성 중...',
    color: 'text-violet-600',
  },
  supervisor: {
    icon: <Sparkles className="h-4 w-4 animate-pulse" />,
    defaultMessage: 'Supervisor 분석 중...',
    color: 'text-amber-600',
  },
  nlq: {
    icon: <Search className="h-4 w-4 animate-pulse" />,
    defaultMessage: 'NLQ Agent가 자연어 쿼리 처리 중...',
    color: 'text-teal-600',
  },
  analyst: {
    icon: <Brain className="h-4 w-4 animate-pulse" />,
    defaultMessage: 'Analyst Agent가 패턴 분석 중...',
    color: 'text-orange-600',
  },
  reporter: {
    icon: <FileText className="h-4 w-4 animate-pulse" />,
    defaultMessage: 'Reporter Agent가 보고서 생성 중...',
    color: 'text-rose-600',
  },
  finalizing: {
    icon: <CheckCircle2 className="h-4 w-4 animate-pulse" />,
    defaultMessage: '응답 완료 처리 중...',
    color: 'text-emerald-600',
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    defaultMessage: '완료!',
    color: 'text-green-600',
  },
};

const DEFAULT_CONFIG: StageConfig = {
  icon: <Loader2 className="h-4 w-4 animate-spin" />,
  defaultMessage: '처리 중...',
  color: 'text-blue-600',
};

// ============================================================================
// Component
// ============================================================================

export const JobProgressIndicator = memo<JobProgressIndicatorProps>(
  ({ progress, isLoading, jobId, onCancel }) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    // useRef로 시작 시간 저장 — isLoading 토글 시에도 timer 유지
    const startTimeRef = useRef<number | null>(null);

    // 경과 시간 타이머 (cold start 재시도 시 리셋 방지)
    useEffect(() => {
      if (!isLoading) {
        startTimeRef.current = null;
        setElapsedTime(0);
        return;
      }

      // 이미 시작된 타이머가 있으면 유지 (재시도 시 리셋 방지)
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsedTime(
            Math.floor((Date.now() - startTimeRef.current) / 1000)
          );
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [isLoading]);

    if (!isLoading && !progress) {
      return null;
    }

    const progressPercent = progress?.progress ?? 0;
    const stage = progress?.stage ?? 'init';
    const config = STAGE_CONFIG[stage] || DEFAULT_CONFIG;

    // 서버에서 보낸 메시지가 있으면 사용, 없으면 기본 메시지
    const displayMessage = progress?.message || config.defaultMessage;

    return (
      <div className="mx-4 my-3 rounded-xl border border-blue-200 bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 shadow-sm">
        {/* Header: 현재 작업 표시 */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* 동적 아이콘 */}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ${config.color}`}
            >
              {config.icon}
            </div>

            {/* 작업 설명 */}
            <div className="flex flex-col">
              <span className={`text-sm font-medium ${config.color}`}>
                {displayMessage}
              </span>
              <span className="text-xs text-gray-500">
                {getStageDescription(stage, progressPercent)}
              </span>
            </div>
          </div>

          {/* 경과 시간 + 취소 */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-700">
                {elapsedTime}초
              </span>
              <span className="text-xs text-gray-400">경과</span>
            </div>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50"
              >
                취소
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
          {/* Shimmer effect */}
          {isLoading && progressPercent > 0 && (
            <div
              className="absolute left-0 top-0 h-full animate-shimmer bg-linear-to-r from-transparent via-white/30 to-transparent"
              style={{ width: `${progressPercent}%` }}
            />
          )}
          {/* Pulse animation when starting */}
          {progressPercent === 0 && isLoading && (
            <div className="absolute inset-0 animate-pulse bg-linear-to-r from-transparent via-blue-300/50 to-transparent" />
          )}
        </div>

        {/* Footer: 진행률 + 단계 정보 */}
        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">
              {progressPercent}% 완료
            </span>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">
              {getPhaseLabel(progressPercent)}
            </span>
          </div>
          {jobId && (
            <span className="font-mono text-gray-400">{jobId.slice(0, 8)}</span>
          )}
        </div>

        {/* AI 작업 단계 시각화 */}
        <div className="mt-3 flex items-center justify-between border-t border-blue-100 pt-3">
          {renderStepIndicators(progressPercent)}
        </div>
      </div>
    );
  }
);

JobProgressIndicator.displayName = 'JobProgressIndicator';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 단계별 상세 설명 반환
 */
function getStageDescription(_stage: string, progress: number): string {
  if (progress < 20) return '에이전트 시스템 준비 중';
  if (progress < 50) return '최적의 처리 방법 결정 중';
  if (progress < 90)
    return 'Cloud Run AI Engine 처리 중 (웜업 시 최대 1분 소요)';
  return '결과 정리 및 반환 준비';
}

/**
 * 진행률에 따른 단계 라벨
 */
function getPhaseLabel(progress: number): string {
  if (progress === 0) return '대기 중';
  if (progress < 20) return '1단계: 초기화';
  if (progress < 50) return '2단계: 라우팅';
  if (progress < 90) return '3단계: AI 처리';
  if (progress < 100) return '4단계: 완료 처리';
  return '완료';
}

/**
 * 단계 인디케이터 렌더링
 */
function renderStepIndicators(progress: number): React.ReactNode {
  const steps = [
    { label: '초기화', threshold: 10 },
    { label: '라우팅', threshold: 20 },
    { label: 'AI 처리', threshold: 50 },
    { label: '완료', threshold: 100 },
  ];

  return steps.map((step, index) => {
    const isCompleted = progress >= step.threshold;
    const isActive =
      progress >= (steps[index - 1]?.threshold ?? 0) &&
      progress < step.threshold;

    return (
      <div key={step.label} className="flex flex-col items-center gap-1">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-all ${
            isCompleted
              ? 'bg-green-500 text-white'
              : isActive
                ? 'animate-pulse bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-500'
          }`}
        >
          {isCompleted ? '✓' : index + 1}
        </div>
        <span
          className={`text-2xs ${
            isCompleted
              ? 'font-medium text-green-600'
              : isActive
                ? 'font-medium text-blue-600'
                : 'text-gray-400'
          }`}
        >
          {step.label}
        </span>
      </div>
    );
  });
}

export default JobProgressIndicator;
