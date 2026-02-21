'use client';

import { Bot, RefreshCw } from 'lucide-react';
import React, { memo, type RefObject } from 'react';
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
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { SessionState } from '@/types/session';
import { ChatInputArea } from './ChatInputArea';
import { ChatMessageList } from './ChatMessageList';
import { ClarificationDialog } from './ClarificationDialog';
import { ColdStartErrorBanner } from './chat/ColdStartErrorBanner';
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
  /** Cloud Run AI Engine 웜업 중 여부 */
  warmingUp?: boolean;
  /** 웜업 예상 대기 시간 (초) */
  estimatedWaitSeconds?: number;
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
  warmingUp,
  estimatedWaitSeconds,
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

      {/* 에러 표시 */}
      {error && (
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
      />
    </div>
  );
});

EnhancedAIChat.displayName = 'EnhancedAIChat';
