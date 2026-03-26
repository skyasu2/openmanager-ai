'use client';

import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';
import { type FC, memo } from 'react';

/**
 * Agent 처리 단계 정의
 */
export interface AgentStep {
  id: string;
  agent: 'supervisor' | 'nlq' | 'analyst' | 'reporter';
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface InlineAgentStatusProps {
  /** 현재 처리 중인 Agent 단계들 */
  steps: AgentStep[];
  /** 전체 처리 완료 여부 */
  isComplete?: boolean;
}

/**
 * Agent 이름을 사용자 친화적으로 변환
 */
function getAgentDisplayName(agent: AgentStep['agent']): string {
  const names: Record<AgentStep['agent'], string> = {
    supervisor: '라우팅',
    nlq: '서버 조회',
    analyst: '패턴 분석',
    reporter: '보고서 생성',
  };
  return names[agent];
}

/**
 * 상태 아이콘 컴포넌트
 */
const StatusIcon: FC<{ status: AgentStep['status'] }> = ({ status }) => {
  switch (status) {
    case 'pending':
      return <Clock className="h-3 w-3 text-gray-400" />;
    case 'processing':
      return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    case 'error':
      return <XCircle className="h-3 w-3 text-red-500" />;
  }
};

/**
 * 인라인 Agent 상태 표시 컴포넌트 (Cursor/Copilot 스타일)
 *
 * @description
 * - AI 처리 과정을 인라인으로 표시
 * - 각 Agent 단계별 상태 시각화
 */
export const InlineAgentStatus: FC<InlineAgentStatusProps> = memo(
  ({ steps, isComplete }) => {
    const currentStep = steps.find((s) => s.status === 'processing');
    const hasError = steps.some((s) => s.status === 'error');

    // 완료 상태면 아무것도 표시하지 않음 (응답 내용만 보여줌)
    if (isComplete) {
      return null;
    }

    return (
      <div className="my-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
        {/* 현재 처리 상태 */}
        {currentStep && (
          <div className="mb-2 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-sm text-gray-700">
              {getAgentDisplayName(currentStep.agent)}
              {currentStep.message && ` - ${currentStep.message}`}
            </span>
          </div>
        )}

        {/* Agent 단계 미니 인디케이터 */}
        <div className="flex items-center gap-1.5">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-1">
              <div
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  step.status === 'processing'
                    ? 'bg-blue-100 text-blue-700'
                    : step.status === 'completed'
                      ? 'bg-green-50 text-green-700'
                      : step.status === 'error'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-500'
                }`}
              >
                <StatusIcon status={step.status} />
                <span>{getAgentDisplayName(step.agent)}</span>
              </div>
              {index < steps.length - 1 && (
                <span className="text-gray-300">→</span>
              )}
            </div>
          ))}
        </div>

        {/* 에러 상태 */}
        {hasError && (
          <div className="mt-2 text-xs text-red-600">
            처리 중 오류가 발생했습니다. 다시 시도해주세요.
          </div>
        )}
      </div>
    );
  }
);

InlineAgentStatus.displayName = 'InlineAgentStatus';
