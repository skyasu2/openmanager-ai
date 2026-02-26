'use client';

import { Bot, RefreshCw } from 'lucide-react';
import React, { memo, type RefObject, useEffect, useState } from 'react';
import { AgentHandoffBadge } from '@/components/ai/AgentHandoffBadge';
import { AgentStatusIndicator } from '@/components/ai/AgentStatusIndicator';
import type { AsyncQueryProgress } from '@/hooks/ai/useAsyncAIQuery';
import type { FileAttachment } from '@/hooks/ai/useFileAttachments';
import type {
  AgentStatusEventData,
  ClarificationOption,
  ClarificationRequest,
  HandoffEventData,
} from '@/hooks/ai/useHybridAIQuery';
import { loadChatHistory } from '@/hooks/ai/utils/chat-history-storage';
import {
  type EnhancedChatMessage,
  useAISidebarStore,
} from '@/stores/useAISidebarStore';
import type { SessionState } from '@/types/session';
import { ChatInputArea } from './ChatInputArea';
import { ChatMessageList } from './ChatMessageList';
import { ClarificationDialog } from './ClarificationDialog';
import { ColdStartErrorBanner } from './chat/ColdStartErrorBanner';
import { RestoreConversationBanner } from './chat/RestoreConversationBanner';
import { JobProgressIndicator } from './JobProgressIndicator';
import { StreamingWarmupIndicator } from './StreamingWarmupIndicator';
import { useChatActions } from './useChatActions';

/**
 * Enhanced AI Chat Props
 */
interface EnhancedAIChatProps {
  autoReportTrigger: {
    shouldGenerate: boolean;
    lastQuery?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  };
  allMessages: EnhancedChatMessage[];
  limitedMessages: EnhancedChatMessage[];
  messagesEndRef: RefObject<HTMLDivElement | null>;
  MessageComponent: React.ComponentType<{
    message: EnhancedChatMessage;
    onRegenerateResponse?: (messageId: string) => void;
    onFeedback?: (
      messageId: string,
      type: 'positive' | 'negative',
      traceId?: string
    ) => Promise<boolean>;
    isLastMessage?: boolean;
  }>;
  onFeedback?: (
    messageId: string,
    type: 'positive' | 'negative',
    traceId?: string
  ) => Promise<boolean>;
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSendInput: (attachments?: FileAttachment[]) => void;
  isGenerating: boolean;
  regenerateResponse: (messageId: string) => void;
  sessionState?: SessionState;
  onNewSession?: () => void;
  onStopGeneration?: () => void;
  jobProgress?: AsyncQueryProgress | null;
  jobId?: string | null;
  onCancelJob?: () => void;
  queryMode?: 'streaming' | 'job-queue';
  error?: string | null;
  onClearError?: () => void;
  onRetry?: () => void;
  clarification?: ClarificationRequest | null;
  onSelectClarification?: (option: ClarificationOption) => void;
  onSubmitCustomClarification?: (customInput: string) => void;
  onSkipClarification?: () => void;
  onDismissClarification?: () => void;
  currentAgentStatus?: AgentStatusEventData | null;
  currentHandoff?: HandoffEventData | null;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
  ragEnabled?: boolean;
  onToggleRAG?: () => void;
  /** Cloud Run AI Engine 웜업 중 여부 */
  warmingUp?: boolean;
  /** 웜업 예상 대기 시간 (초) */
  estimatedWaitSeconds?: number;
  queuedQueries?: Array<{
    id: number;
    text: string;
    attachments?: FileAttachment[];
  }>;
  removeQueuedQuery?: (index: number) => void;
}

/**
 * Enhanced AI Chat 컴포넌트
 */
export const EnhancedAIChat = memo(function EnhancedAIChat({
  autoReportTrigger,
  allMessages,
  limitedMessages,
  messagesEndRef,
  MessageComponent,
  inputValue,
  setInputValue,
  handleSendInput,
  isGenerating,
  regenerateResponse,
  sessionState,
  onNewSession,
  onStopGeneration,
  onFeedback,
  jobProgress,
  jobId,
  onCancelJob,
  queryMode,
  error,
  onClearError,
  onRetry,
  clarification,
  onSelectClarification,
  onSubmitCustomClarification,
  onSkipClarification,
  onDismissClarification,
  currentAgentStatus,
  currentHandoff,
  webSearchEnabled,
  onToggleWebSearch,
  ragEnabled,
  onToggleRAG,
  warmingUp,
  estimatedWaitSeconds,
  queuedQueries,
  removeQueuedQuery,
}: EnhancedAIChatProps) {
  const {
    scrollContainerRef,
    textareaRef,
    fileInputRef,
    attachments,
    isDragging,
    fileErrors,
    removeFile,
    clearFileErrors,
    dragHandlers,
    canAddMore,
    previewImage,
    handleSendWithAttachments,
    openFileDialog,
    handleFileSelect,
    handleImageClick,
    closePreviewModal,
    handlePaste,
  } = useChatActions({
    setInputValue,
    handleSendInput,
    isGenerating,
    isLimitReached: sessionState?.isLimitReached,
    messagesEndRef,
    limitedMessagesLength: limitedMessages.length,
  });

  // 대화 복원 배너 상태 — Zustand Store로 영속화 (탭 전환 시 재노출 방지)
  const restoreBannerDismissed = useAISidebarStore(
    (state) => state.restoreBannerDismissed
  );
  const dismissRestoreBanner = useAISidebarStore(
    (state) => state.dismissRestoreBanner
  );

  const [hasPersistedHistory, setHasPersistedHistory] = useState(false);

  const hasRestored = restoreBannerDismissed || allMessages.length === 0;

  useEffect(() => {
    const history = loadChatHistory();
    const hasHistory = Boolean(history?.messages?.length);
    setHasPersistedHistory(hasHistory);
    if (!hasHistory) {
      dismissRestoreBanner();
    }
  }, [dismissRestoreBanner]);

  // If user is actively generating, skip restore prompt and continue with live flow.
  useEffect(() => {
    if (isGenerating) {
      dismissRestoreBanner();
    }
  }, [isGenerating, dismissRestoreBanner]);

  const handleRestore = () => {
    dismissRestoreBanner();
    setHasPersistedHistory(false);
  };
  const handleNewSessionAndRestore = () => {
    onNewSession?.();
    dismissRestoreBanner();
    setHasPersistedHistory(false);
  };

  return (
    <div className="flex h-full flex-col bg-linear-to-br from-slate-50 to-blue-50">
      {/* 헤더 */}
      <div className="border-b border-gray-200 bg-white/80 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-r from-purple-500 to-blue-600">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">AI Chat</h3>
              <p className="text-xs text-gray-600">AI 기반 대화형 인터페이스</p>
            </div>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      {!hasRestored && hasPersistedHistory && allMessages.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
          <RestoreConversationBanner
            messageCount={allMessages.length}
            onRestore={handleRestore}
            onNewSession={handleNewSessionAndRestore}
          />
        </div>
      ) : (
        <ChatMessageList
          scrollContainerRef={scrollContainerRef}
          autoReportTrigger={autoReportTrigger}
          allMessages={allMessages}
          limitedMessages={limitedMessages}
          messagesEndRef={messagesEndRef}
          MessageComponent={MessageComponent}
          onFeedback={onFeedback}
          isGenerating={isGenerating}
          regenerateResponse={regenerateResponse}
          setInputValue={setInputValue}
        />
      )}

      {/* 명확화 다이얼로그 */}
      {clarification &&
        onSelectClarification &&
        onSubmitCustomClarification &&
        onSkipClarification && (
          <ClarificationDialog
            clarification={clarification}
            onSelectOption={onSelectClarification}
            onSubmitCustom={onSubmitCustomClarification}
            onSkip={onSkipClarification}
            onDismiss={onDismissClarification}
          />
        )}

      {/* Streaming 모드 웜업 인디케이터 */}
      {queryMode === 'streaming' && warmingUp && isGenerating && (
        <StreamingWarmupIndicator
          estimatedWaitSeconds={estimatedWaitSeconds ?? 60}
        />
      )}

      {/* Job Queue 진행률 */}
      {queryMode === 'job-queue' && isGenerating && (
        <JobProgressIndicator
          progress={jobProgress ?? null}
          isLoading={isGenerating}
          jobId={jobId}
          onCancel={onCancelJob}
        />
      )}

      {/* 실시간 Agent 상태 */}
      {queryMode === 'streaming' &&
        isGenerating &&
        (currentAgentStatus || currentHandoff) && (
          <div className="border-t border-blue-100 bg-linear-to-r from-blue-50/80 to-indigo-50/50 px-4 py-2.5">
            <div className="mx-auto flex max-w-3xl items-center gap-2">
              {currentAgentStatus && (
                <AgentStatusIndicator
                  agent={currentAgentStatus.agent}
                  status={currentAgentStatus.status}
                  compact
                />
              )}
              {currentHandoff && (
                <AgentHandoffBadge
                  from={currentHandoff.from}
                  to={currentHandoff.to}
                  reason={currentHandoff.reason}
                  compact
                />
              )}
            </div>
          </div>
        )}

      {/* 에러 표시 - warmup 중에는 숨김 (warmup indicator가 우선) */}
      {error && !(queryMode === 'streaming' && warmingUp && isGenerating) && (
        <ColdStartErrorBanner
          error={error}
          onRetry={onRetry}
          onClearError={onClearError}
        />
      )}

      {/* 세션 제한 안내 */}
      {sessionState?.isLimitReached && (
        <div className="border-t border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  대화가 길어졌습니다
                </p>
                <p className="text-xs text-blue-600">
                  더 정확한 AI 응답을 위해 새 대화를 시작해주세요
                </p>
              </div>
            </div>
            {onNewSession && (
              <button
                type="button"
                onClick={onNewSession}
                className="flex items-center space-x-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <RefreshCw className="h-4 w-4" />
                <span>새 대화</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 세션 경고 */}
      {sessionState?.isWarning && !sessionState.isLimitReached && (
        <div className="border-t border-slate-200 bg-linear-to-r from-slate-50 to-gray-50 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500">
                💬 대화 {sessionState.count}/20
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">
                새 주제는 새 대화에서 더 정확해요
              </span>
            </div>
            {onNewSession && (
              <button
                type="button"
                onClick={onNewSession}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
              >
                새 대화
              </button>
            )}
          </div>
        </div>
      )}

      {/* 대기 중인 메시지 표시 영역 */}
      {queuedQueries && queuedQueries.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-blue-100 bg-linear-to-r from-blue-50/30 to-indigo-50/30 px-4 py-3 pb-0">
          <div className="mb-1 flex items-center text-xs font-semibold text-blue-600">
            <Bot className="mr-1 h-3 w-3" /> 답변 완료 시 자동 전송됩니다
          </div>
          <div className="scrollbar-thin flex max-h-36 flex-col gap-2 overflow-y-auto">
            {queuedQueries.map((q, idx) => (
              <div
                key={q.id}
                className="flex justify-end opacity-70 transition-all"
              >
                <div className="text-chat relative max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-indigo-100 bg-indigo-50 px-3 py-2 pr-7 text-indigo-900 shadow-xs wrap-break-word">
                  {removeQueuedQuery && (
                    <button
                      type="button"
                      onClick={() => removeQueuedQuery(idx)}
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-indigo-400 transition-colors hover:bg-indigo-200 hover:text-indigo-700"
                      aria-label="대기열에서 제거"
                    >
                      &times;
                    </button>
                  )}
                  {q.attachments && q.attachments.length > 0 && (
                    <div className="mb-1 flex items-center text-xs text-indigo-500">
                      첨부 {q.attachments.length}개
                    </div>
                  )}
                  {q.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <ChatInputArea
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        inputValue={inputValue}
        setInputValue={setInputValue}
        isGenerating={isGenerating}
        sessionState={sessionState}
        attachments={attachments}
        isDragging={isDragging}
        fileErrors={fileErrors}
        canAddMore={canAddMore}
        previewImage={previewImage}
        dragHandlers={dragHandlers}
        onSendWithAttachments={handleSendWithAttachments}
        onOpenFileDialog={openFileDialog}
        onFileSelect={handleFileSelect}
        onImageClick={handleImageClick}
        onClosePreviewModal={closePreviewModal}
        onRemoveFile={removeFile}
        onClearFileErrors={clearFileErrors}
        onPaste={handlePaste}
        onStopGeneration={onStopGeneration}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={onToggleWebSearch}
        ragEnabled={ragEnabled}
        onToggleRAG={onToggleRAG}
      />
    </div>
  );
});

EnhancedAIChat.displayName = 'EnhancedAIChat';
