import { Brain, ChevronDown, ChevronUp, Play, User } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { AnalysisBasisBadge } from '@/components/ai/AnalysisBasisBadge';
import { AssistantAgentBadge } from '@/components/ai/AssistantAgentBadge';
import { ProviderAttributionChip } from '@/components/ai/analysis-basis/ProviderAttributionChip';
import { getResponseLatencyLabel } from '@/lib/ai/response-latency-label';
import {
  resolveAssistantResponseView,
  splitAssistantResponseDetails,
} from '@/lib/ai/utils/assistant-response-view';
import { formatTime } from '@/lib/format-date';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { AIThinkingStep } from '@/types/ai-sidebar/ai-sidebar-types';
import { ArtifactRendererHost } from './domain-renderers/ArtifactRendererHost';
import { MarkdownRenderer } from './MarkdownRenderer';
import { MessageActions } from './MessageActions';
import { ThinkingProcessVisualizer } from './ThinkingProcessVisualizer';

const MemoizedThinkingProcessVisualizer = memo(ThinkingProcessVisualizer);

const ThinkingToggle = memo<{
  steps: AIThinkingStep[];
  isStreaming: boolean;
  defaultOpen: boolean;
}>(({ steps, isStreaming, defaultOpen }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  useEffect(() => {
    if (isStreaming) setIsOpen(true);
  }, [isStreaming]);

  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        data-testid="thinking-toggle-button"
        data-thinking-open={isOpen ? 'true' : 'false'}
        className="flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-gray-700"
      >
        {isOpen ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <Brain className="h-3 w-3" />
        <span>AI 처리 과정 ({steps.length}단계)</span>
      </button>
      {isOpen && (
        <MemoizedThinkingProcessVisualizer
          steps={steps}
          isActive={isStreaming}
          className="mt-2 rounded border border-gray-200 bg-gray-50"
        />
      )}
    </div>
  );
});
ThinkingToggle.displayName = 'ThinkingToggle';

export const AIWorkspaceMessage = memo<{
  message: EnhancedChatMessage;
  onRegenerateResponse?: (messageId: string) => void;
  onArtifactGuidanceCta?: (
    target: 'incident-report' | 'monitoring-analysis'
  ) => void;
  isLastMessage?: boolean;
}>(
  ({
    message,
    onRegenerateResponse,
    onArtifactGuidanceCta,
    isLastMessage = false,
  }) => {
    const hasTextContent = Boolean(message.content?.trim());
    const guidanceCta =
      message.role === 'assistant' && message.metadata?.type === 'guidance'
        ? message.metadata.guidanceCta
        : undefined;
    const assistantResponseView = useMemo(() => {
      if (message.role !== 'assistant' || message.isStreaming) {
        return null;
      }
      return resolveAssistantResponseView(message.content, message.metadata);
    }, [message.content, message.metadata, message.isStreaming, message.role]);
    const assistantResponseDetails = useMemo(
      () =>
        splitAssistantResponseDetails(assistantResponseView?.details ?? null),
      [assistantResponseView?.details]
    );
    const analysisBasis = message.metadata?.analysisBasis ?? null;
    const responseLatencyLabel = getResponseLatencyLabel(
      message.metadata?.processingTime
    );
    const showAssistantMetaChips =
      message.role === 'assistant' &&
      !message.isStreaming &&
      (Boolean(message.metadata?.handoffHistory?.length) ||
        Boolean(responseLatencyLabel));
    const userFacingAssistantDetails =
      assistantResponseDetails.processDetails ??
      (!assistantResponseDetails.debugDetails
        ? (assistantResponseView?.details ?? null)
        : null);
    const inlineAssistantDetails = assistantResponseView?.shouldCollapse
      ? userFacingAssistantDetails
      : null;
    const analysisBasisDetails =
      analysisBasis && assistantResponseView?.details && !inlineAssistantDetails
        ? userFacingAssistantDetails
        : !assistantResponseView?.shouldCollapse
          ? (assistantResponseView?.details ?? null)
          : null;
    const analysisBasisDebugDetails =
      analysisBasis && assistantResponseView?.details
        ? assistantResponseDetails.debugDetails
        : null;
    const shouldShowActionBar = hasTextContent;

    if (message.role === 'thinking' && !message.thinkingSteps?.length) {
      return null;
    }

    if (message.role === 'thinking' && message.thinkingSteps?.length) {
      return (
        <div className="my-4">
          <MemoizedThinkingProcessVisualizer
            steps={message.thinkingSteps as AIThinkingStep[]}
            isActive={message.isStreaming || false}
            className="rounded-lg border border-purple-200 bg-linear-to-r from-purple-50 to-blue-50 p-4"
          />
        </div>
      );
    }

    return (
      <div
        className={`group flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        data-testid={message.role === 'user' ? 'user-message' : 'ai-message'}
      >
        <div
          className={`flex max-w-[90%] min-w-0 items-start space-x-2 sm:max-w-[85%] ${
            message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
          }`}
        >
          <div
            data-testid={
              message.role === 'user' ? 'user-avatar' : 'assistant-avatar'
            }
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-xs ${
              message.role === 'user'
                ? 'bg-slate-100 text-slate-600'
                : 'bg-linear-to-br from-purple-500 to-pink-500 text-white'
            }`}
          >
            {message.role === 'user' ? (
              <User className="h-4 w-4" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            {hasTextContent && (
              <div
                className={`${
                  message.role === 'user'
                    ? 'overflow-hidden rounded-2xl rounded-tr-sm bg-slate-100 p-4 text-slate-900 shadow-xs'
                    : 'overflow-visible px-0 py-1 text-slate-800'
                }`}
                data-testid={
                  message.role === 'assistant' ? 'ai-response' : 'user-response'
                }
              >
                {message.role === 'assistant' ? (
                  <div className="relative">
                    {assistantResponseView?.shouldCollapse ? (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                          <p className="mb-2 text-xs font-semibold tracking-wide text-indigo-500 uppercase">
                            핵심 요약
                          </p>
                          <MarkdownRenderer
                            content={assistantResponseView.summary}
                            className="text-chat leading-relaxed [overflow-wrap:anywhere] break-words"
                          />
                        </div>
                        {inlineAssistantDetails && (
                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                              상세 분석
                            </p>
                            <MarkdownRenderer
                              content={inlineAssistantDetails}
                              className="text-chat leading-relaxed [overflow-wrap:anywhere] break-words"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <MarkdownRenderer
                        content={message.content}
                        className="text-chat leading-relaxed [overflow-wrap:anywhere] break-words"
                      />
                    )}
                    {guidanceCta && onArtifactGuidanceCta && (
                      <button
                        type="button"
                        onClick={() =>
                          onArtifactGuidanceCta(guidanceCta.target)
                        }
                        className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                      >
                        <Play className="h-4 w-4 shrink-0" />
                        <span className="truncate">{guidanceCta.label}</span>
                      </button>
                    )}
                    {message.isStreaming && (
                      <span
                        aria-label="응답 작성 중"
                        className="mt-2 inline-flex animate-pulse text-sm font-semibold text-purple-600"
                        data-testid="assistant-typing-dots"
                        role="status"
                      >
                        •••
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-chat leading-relaxed wrap-break-word whitespace-pre-wrap">
                    {message.content}
                  </div>
                )}
              </div>
            )}

            {message.role === 'assistant' && (
              <ArtifactRendererHost metadata={message.metadata} />
            )}

            <div
              className={`mt-1 flex items-center justify-between ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className="flex items-center gap-2">
                <p
                  className="text-xs text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  data-testid="message-timestamp"
                  suppressHydrationWarning
                >
                  {formatTime(message.timestamp)}
                </p>
                {showAssistantMetaChips && (
                  <>
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
                  </>
                )}
              </div>

              <div className="flex items-center gap-1">
                {shouldShowActionBar && hasTextContent && (
                  <MessageActions
                    messageId={message.id}
                    content={message.content}
                    role={message.role}
                    onRegenerate={onRegenerateResponse}
                    showRegenerate={
                      isLastMessage && message.role === 'assistant'
                    }
                  />
                )}
              </div>
            </div>

            {message.role === 'assistant' &&
              !message.isStreaming &&
              message.metadata?.provider && (
                <div className="mt-1.5 px-1">
                  <ProviderAttributionChip
                    provider={message.metadata.provider}
                    modelId={message.metadata.modelId}
                    ttfbMs={message.metadata.ttfbMs}
                    usedFallback={message.metadata.usedFallback}
                    rotationSlot={message.metadata.rotationSlot}
                  />
                </div>
              )}

            {message.role === 'assistant' &&
              !message.isStreaming &&
              analysisBasis && (
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
                  className="mt-2"
                />
              )}

            {message.role === 'assistant' &&
              message.thinkingSteps &&
              message.thinkingSteps.length > 0 &&
              !analysisBasis && (
                <ThinkingToggle
                  steps={message.thinkingSteps}
                  isStreaming={message.isStreaming || false}
                  defaultOpen={message.isStreaming || false}
                />
              )}
          </div>
        </div>
      </div>
    );
  }
);

AIWorkspaceMessage.displayName = 'AIWorkspaceMessage';
