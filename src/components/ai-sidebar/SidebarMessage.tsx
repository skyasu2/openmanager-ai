'use client';

import { Bot, Cpu, User } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { AnalysisBasisBadge } from '@/components/ai/AnalysisBasisBadge';
import { MessageActions } from '@/components/ai/MessageActions';
import { WebSourceCards } from '@/components/ai/WebSourceCards';
import { convertThinkingStepsToUI } from '@/hooks/ai/useAIChatCore';
import { resolveAssistantResponseView } from '@/lib/ai/utils/assistant-response-view';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { RenderMarkdownContent } from '@/utils/markdown-parser';
import { type AgentStep, InlineAgentStatus } from './InlineAgentStatus';

/**
 * ThinkingSteps를 AgentStep 형식으로 변환 (UI 표시용)
 */
export function convertToAgentSteps(
  thinkingSteps?: AIThinkingStep[]
): AgentStep[] {
  return convertThinkingStepsToUI(thinkingSteps) as AgentStep[];
}

// 🎯 메시지 컴포넌트 성능 최적화 (Cursor/Copilot 스타일)
export const MessageComponent = memo<{
  message: EnhancedChatMessage;
  onRegenerateResponse?: (messageId: string) => void;
  onFeedback?: (
    messageId: string,
    type: 'positive' | 'negative',
    traceId?: string
  ) => Promise<boolean>;
  isLastMessage?: boolean;
}>(({ message, onRegenerateResponse, onFeedback, isLastMessage }) => {
  const [isDetailExpanded, setIsDetailExpanded] = useState(false);
  const agentSteps = useMemo(
    () => convertToAgentSteps(message.thinkingSteps),
    [message.thinkingSteps]
  );
  const assistantResponseView = useMemo(() => {
    if (
      message.role !== 'assistant' ||
      !message.content ||
      message.isStreaming
    ) {
      return null;
    }
    return resolveAssistantResponseView(message.content, message.metadata);
  }, [message.content, message.metadata, message.isStreaming, message.role]);
  const isCollapsibleAssistantResponse = Boolean(
    assistantResponseView?.shouldCollapse && assistantResponseView.details
  );
  const collapsibleResponse = isCollapsibleAssistantResponse
    ? assistantResponseView
    : null;
  const analysisBasisDetails =
    !collapsibleResponse && assistantResponseView?.details
      ? assistantResponseView.details
      : null;

  // thinking 메시지일 경우 간소화된 인라인 상태 표시
  if (message.role === 'thinking' && message.thinkingSteps) {
    return (
      <InlineAgentStatus steps={agentSteps} isComplete={!message.isStreaming} />
    );
  }

  // 일반 메시지 렌더링
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
      data-testid={message.role === 'user' ? 'user-message' : 'ai-message'}
    >
      <div
        className={`flex max-w-[90%] items-start space-x-2 sm:max-w-[85%] ${
          message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
        }`}
      >
        {/* 아바타 */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-xs ${
            message.role === 'user'
              ? 'bg-blue-100 text-blue-600'
              : 'bg-linear-to-br from-purple-500 to-pink-500 text-white'
          }`}
        >
          {message.role === 'user' ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>

        {/* 메시지 콘텐츠 */}
        <div className="flex-1">
          {/* 스트리밍 중 인라인 Agent 상태 표시 */}
          {message.role === 'assistant' &&
            message.isStreaming &&
            message.thinkingSteps &&
            message.thinkingSteps.length > 0 && (
              <InlineAgentStatus steps={agentSteps} isComplete={false} />
            )}

          {/* 메시지 내용 (콘텐츠가 있을 때만 표시) */}
          {message.content && (
            <div
              className={`rounded-2xl p-4 shadow-xs ${
                message.role === 'user'
                  ? 'rounded-tr-sm bg-linear-to-br from-blue-500 to-blue-600 text-white'
                  : 'rounded-tl-sm border border-gray-100 bg-white text-gray-800'
              }`}
              data-testid={
                message.role === 'assistant' ? 'ai-response' : undefined
              }
            >
              {message.role === 'assistant' ? (
                <div className="relative">
                  {collapsibleResponse ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                        <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-indigo-500">
                          핵심 요약
                        </p>
                        <RenderMarkdownContent
                          content={collapsibleResponse.summary}
                          className="text-chat leading-relaxed break-words [overflow-wrap:anywhere]"
                        />
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <button
                          type="button"
                          aria-expanded={isDetailExpanded}
                          onClick={() =>
                            setIsDetailExpanded(
                              (previousState) => !previousState
                            )
                          }
                          className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-600 hover:text-slate-800"
                        >
                          <span>상세 분석 보기</span>
                          <span className="text-2xs text-slate-500">
                            {isDetailExpanded ? '접기' : '펼치기'}
                          </span>
                        </button>
                        {collapsibleResponse.details && isDetailExpanded && (
                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <RenderMarkdownContent
                              content={collapsibleResponse.details}
                              className="text-chat leading-relaxed break-words [overflow-wrap:anywhere]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="min-h-[44px] break-words [overflow-wrap:anywhere]">
                      <RenderMarkdownContent
                        content={message.content}
                        className="text-chat leading-relaxed break-words [overflow-wrap:anywhere]"
                      />
                    </div>
                  )}
                  {/* 🎯 스트리밍 중 타이핑 커서 */}
                  {message.isStreaming && (
                    <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-purple-500" />
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap wrap-break-word text-chat leading-relaxed">
                  {message.content}
                </div>
              )}
            </div>
          )}

          {/* 타임스탬프 & 메타데이터 */}
          <div
            className={`mt-1 flex items-center justify-between ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <p className="text-xs text-gray-500">
              {typeof message.timestamp === 'string'
                ? new Date(message.timestamp).toLocaleTimeString()
                : message.timestamp.toLocaleTimeString()}
            </p>
            {/* 처리 시간 표시 (assistant 메시지만) */}
            {message.role === 'assistant' &&
              message.metadata?.processingTime && (
                <p className="text-xs text-gray-400">
                  {message.metadata.processingTime}ms
                </p>
              )}
          </div>

          {/* 인라인 메타데이터 + 분석 근거 (assistant 메시지 + 스트리밍 완료 + analysisBasis 있을 때만) */}
          {message.role === 'assistant' &&
            !message.isStreaming &&
            message.metadata?.analysisBasis && (
              <>
                {/* 인라인 소스 메타 */}
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                  <Cpu className="h-3 w-3 text-slate-400" />
                  <span>{message.metadata.analysisBasis.engine}</span>
                  <span className="text-slate-300">&middot;</span>
                  <span>{message.metadata.analysisBasis.dataSource}</span>
                  {message.metadata.analysisBasis.ragSources &&
                    message.metadata.analysisBasis.ragSources.length > 0 && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
                        RAG
                      </span>
                    )}
                </div>
                {/* 웹 출처 카드 + 분석 근거 뱃지 */}
                <WebSourceCards
                  sources={(
                    message.metadata.analysisBasis.ragSources ?? []
                  ).filter(
                    (s): s is typeof s & { url: string } =>
                      s.sourceType === 'web' && !!s.url
                  )}
                />
                <AnalysisBasisBadge
                  basis={message.metadata.analysisBasis}
                  details={analysisBasisDetails}
                  thinkingSteps={message.thinkingSteps}
                  traceId={message.metadata?.traceId}
                  handoffHistory={message.metadata?.handoffHistory}
                  toolResultSummaries={message.metadata?.toolResultSummaries}
                />
              </>
            )}

          {/* 메시지 액션 (복사, 피드백, 재생성) */}
          {message.content && (
            <MessageActions
              messageId={message.id}
              content={message.content}
              role={message.role}
              onRegenerate={onRegenerateResponse}
              onFeedback={onFeedback}
              traceId={message.metadata?.traceId}
              showRegenerate={isLastMessage && message.role === 'assistant'}
              className="mt-2"
            />
          )}
        </div>
      </div>
    </div>
  );
});

MessageComponent.displayName = 'MessageComponent';
