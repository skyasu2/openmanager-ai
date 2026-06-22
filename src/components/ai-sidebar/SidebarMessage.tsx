'use client';

import { Bot, Cpu, User } from 'lucide-react';
import { memo, useMemo } from 'react';
import { AnalysisBasisBadge } from '@/components/ai/AnalysisBasisBadge';
import { AssistantAgentBadge } from '@/components/ai/AssistantAgentBadge';
import { ArtifactRendererHost } from '@/components/ai/domain-renderers/ArtifactRendererHost';
import { MessageActions } from '@/components/ai/MessageActions';
import { WebSourceCards } from '@/components/ai/WebSourceCards';
import { convertThinkingStepsToUI } from '@/hooks/ai/useAIChatCore';
import { getResponseLatencyLabel } from '@/lib/ai/response-latency-label';
import {
  resolveAssistantResponseView,
  splitAssistantResponseDetails,
} from '@/lib/ai/utils/assistant-response-view';
import {
  buildAnalysisFeatureStatus,
  buildVisibleFeatureStatusBadges,
} from '@/lib/ai/utils/retrieval-status';
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
  isLastMessage?: boolean;
  regenerateDisabled?: boolean;
  regenerateDisabledReason?: string;
}>(
  ({
    message,
    onRegenerateResponse,
    isLastMessage,
    regenerateDisabled,
    regenerateDisabledReason,
  }) => {
    const hasTextContent = Boolean(message.content?.trim());
    const agentSteps = useMemo(
      () => convertToAgentSteps(message.thinkingSteps),
      [message.thinkingSteps]
    );
    const assistantResponseView = useMemo(() => {
      if (message.role !== 'assistant' || message.isStreaming) {
        return null;
      }
      return resolveAssistantResponseView(message.content, message.metadata);
    }, [message.content, message.metadata, message.isStreaming, message.role]);
    const analysisBasis = message.metadata?.analysisBasis ?? null;
    const analysisSources = analysisBasis?.ragSources ?? [];
    const analysisEvidenceCards = analysisBasis?.evidenceCards ?? [];
    const hasRagEvidence =
      analysisSources.some((source) => source.sourceType !== 'web') ||
      analysisEvidenceCards.some((card) => card.sourceType !== 'web');
    const hasWebEvidence =
      analysisSources.some((source) => source.sourceType === 'web') ||
      analysisEvidenceCards.some((card) => card.sourceType === 'web');
    const hasLegacyRagEvidence =
      Boolean(analysisBasis?.ragUsed) && !hasRagEvidence && !hasWebEvidence;
    const featureStatus =
      analysisBasis?.featureStatus ??
      (analysisBasis
        ? buildAnalysisFeatureStatus({
            retrieval: analysisBasis.retrieval,
            hasKnowledgeEvidence: hasRagEvidence || hasLegacyRagEvidence,
            hasWebEvidence,
          })
        : undefined);
    const featureBadges = buildVisibleFeatureStatusBadges(featureStatus);
    const assistantResponseDetails = useMemo(
      () =>
        splitAssistantResponseDetails(assistantResponseView?.details ?? null),
      [assistantResponseView?.details]
    );
    const shouldShowActionBar = hasTextContent;
    const responseLatencyLabel = getResponseLatencyLabel(
      message.metadata?.processingTime
    );
    const showAssistantMetaChips =
      message.role === 'assistant' &&
      !message.isStreaming &&
      (Boolean(message.metadata?.handoffHistory?.length) ||
        Boolean(responseLatencyLabel));
    const isCollapsibleAssistantResponse = Boolean(
      assistantResponseView?.shouldCollapse
    );
    const collapsibleResponse = isCollapsibleAssistantResponse
      ? assistantResponseView
      : null;
    const userFacingAssistantDetails =
      assistantResponseDetails.processDetails ??
      (!assistantResponseDetails.debugDetails
        ? (collapsibleResponse?.details ?? null)
        : null);
    const inlineAssistantDetails = collapsibleResponse
      ? userFacingAssistantDetails
      : null;
    const analysisBasisDetails =
      analysisBasis && assistantResponseView?.details && !inlineAssistantDetails
        ? userFacingAssistantDetails
        : null;
    const analysisBasisDebugDetails =
      analysisBasis && assistantResponseView?.details
        ? assistantResponseDetails.debugDetails
        : null;

    // thinking 메시지일 경우 간소화된 인라인 상태 표시
    if (message.role === 'thinking' && message.thinkingSteps) {
      return (
        <InlineAgentStatus
          steps={agentSteps}
          isComplete={!message.isStreaming}
        />
      );
    }

    // 일반 메시지 렌더링
    return (
      <div
        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        data-testid={message.role === 'user' ? 'user-message' : 'ai-message'}
      >
        <div
          className={`flex max-w-[90%] min-w-0 items-start space-x-2 sm:max-w-[85%] ${
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
          <div className="min-w-0 flex-1">
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
                className={`overflow-hidden rounded-2xl p-4 shadow-xs ${
                  message.role === 'user'
                    ? 'rounded-tr-sm bg-linear-to-br from-blue-500 to-blue-600 text-white'
                    : 'rounded-tl-sm border border-slate-200 bg-gradient-to-br from-slate-50 to-white text-slate-800'
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
                          <p className="mb-2 text-xs font-semibold tracking-wide text-indigo-500 uppercase">
                            핵심 요약
                          </p>
                          <RenderMarkdownContent
                            content={collapsibleResponse.summary}
                            className="text-chat leading-relaxed [overflow-wrap:anywhere] break-words break-keep"
                          />
                        </div>
                        {inlineAssistantDetails && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                              상세 분석
                            </p>
                            <RenderMarkdownContent
                              content={inlineAssistantDetails}
                              className="text-chat leading-relaxed [overflow-wrap:anywhere] break-words break-keep"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="min-h-[44px] [overflow-wrap:anywhere] break-words break-keep">
                        <RenderMarkdownContent
                          content={message.content}
                          className="text-chat leading-relaxed [overflow-wrap:anywhere] break-words break-keep"
                        />
                      </div>
                    )}
                    {/* 🎯 스트리밍 중 타이핑 커서 */}
                    {message.isStreaming && (
                      <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse bg-purple-500" />
                    )}
                  </div>
                ) : (
                  <div className="text-chat leading-relaxed wrap-break-word whitespace-pre-wrap break-keep">
                    {message.content}
                  </div>
                )}
              </div>
            )}

            {message.role === 'assistant' && (
              <ArtifactRendererHost metadata={message.metadata} />
            )}

            {/* 타임스탬프 & 메타데이터 */}
            <div
              className={`mt-1 flex items-center justify-between gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <p className="text-xs text-gray-500">
                {typeof message.timestamp === 'string'
                  ? new Date(message.timestamp).toLocaleTimeString()
                  : message.timestamp.toLocaleTimeString()}
              </p>
              {showAssistantMetaChips && (
                <div className="flex min-w-0 items-center gap-1.5">
                  <AssistantAgentBadge
                    handoffHistory={message.metadata?.handoffHistory}
                  />
                  {responseLatencyLabel && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${responseLatencyLabel.className}`}
                      title={responseLatencyLabel.title}
                    >
                      {responseLatencyLabel.label}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 인라인 메타데이터 + 분석 근거 (assistant 메시지 + 스트리밍 완료 + analysisBasis 있을 때만) */}
            {message.role === 'assistant' &&
              !message.isStreaming &&
              analysisBasis && (
                <>
                  {/* 인라인 소스 메타 */}
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <Cpu className="h-3 w-3 text-slate-400" />
                    <span>{analysisBasis.engine}</span>
                    <span className="text-slate-300">&middot;</span>
                    <span>{analysisBasis.dataSource}</span>
                    {featureBadges.map((badge) => (
                      <span
                        key={badge.feature}
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${badge.className}`}
                        title={badge.state.reason}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  {/* 웹 출처 카드 + 분석 근거 뱃지 */}
                  <WebSourceCards
                    sources={
                      analysisEvidenceCards.length > 0
                        ? analysisEvidenceCards
                            .filter(
                              (card): card is typeof card & { url: string } =>
                                card.sourceType === 'web' && !!card.url
                            )
                            .map((card) => ({
                              title: card.title,
                              similarity: card.score,
                              sourceType: card.sourceType,
                              category: card.category,
                              url: card.url,
                            }))
                        : (analysisBasis.ragSources ?? []).filter(
                            (s): s is typeof s & { url: string } =>
                              s.sourceType === 'web' && !!s.url
                          )
                    }
                  />
                  <AnalysisBasisBadge
                    basis={analysisBasis}
                    details={analysisBasisDetails}
                    debugDetails={analysisBasisDebugDetails}
                    thinkingSteps={message.thinkingSteps}
                    traceId={message.metadata?.traceId}
                    processingTime={message.metadata?.processingTime}
                    latencyTier={message.metadata?.latencyTier}
                    resolvedMode={message.metadata?.resolvedMode}
                    modeSelectionSource={message.metadata?.modeSelectionSource}
                    provider={message.metadata?.provider}
                    modelId={message.metadata?.modelId}
                    providerAttempts={message.metadata?.providerAttempts}
                    usedFallback={message.metadata?.usedFallback}
                    fallbackReason={message.metadata?.fallbackReason}
                    ttfbMs={message.metadata?.ttfbMs}
                    handoffHistory={message.metadata?.handoffHistory}
                    toolResultSummaries={message.metadata?.toolResultSummaries}
                  />
                </>
              )}

            {/* 메시지 액션 (복사, 재생성) */}
            {shouldShowActionBar && (
              <div className="mt-2 flex items-center gap-1">
                {hasTextContent && (
                  <MessageActions
                    messageId={message.id}
                    content={message.content}
                    role={message.role}
                    onRegenerate={onRegenerateResponse}
                    showRegenerate={
                      isLastMessage && message.role === 'assistant'
                    }
                    regenerateDisabled={regenerateDisabled}
                    regenerateDisabledReason={regenerateDisabledReason}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

MessageComponent.displayName = 'MessageComponent';
