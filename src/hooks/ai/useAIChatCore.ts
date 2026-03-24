'use client';

/**
 * 🤖 useAIChatCore - AI 채팅 공통 로직 훅
 *
 * AISidebarV4와 AIWorkspace에서 공유하는 핵심 로직:
 * - Hybrid AI Query (Streaming + Job Queue)
 * - 세션 제한
 * - 피드백
 * - 메시지 변환
 * - 파일 첨부 재시도 지원
 *
 * @note 유틸리티는 utils/ 폴더로 분리됨
 * @updated 2026-01-28 - 재시도 시 파일 첨부 보존 (lastAttachmentsRef)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type AgentStatusEventData,
  type ClarificationOption,
  type ClarificationRequest,
  type HandoffEventData,
  type StreamDataPart,
  useHybridAIQuery,
} from '@/hooks/ai/useHybridAIQuery';
import { logger } from '@/lib/logging';
import {
  type EnhancedChatMessage,
  useAISidebarStore,
} from '@/stores/useAISidebarStore';
import type { SessionState } from '@/types/session';
import { triggerAIWarmup } from '@/utils/ai-warmup';
import { useChatFeedback } from './core/useChatFeedback';
import { useChatHistory } from './core/useChatHistory';
import { useChatQueue } from './core/useChatQueue';
import { useChatSession } from './core/useChatSession';
import { useChatSessionState } from './core/useChatSessionState';
import { useDeferredMessageMetadata } from './useDeferredMessageMetadata';
import type { FileAttachment } from './useFileAttachments';
import {
  convertThinkingStepsToUI,
  transformMessages,
} from './utils/message-helpers';
import { handleStreamDataPart } from './utils/stream-data-handler';

// Re-export for backwards compatibility
export { convertThinkingStepsToUI };
// NOTE: SessionState 타입은 './core/useChatSessionState'에서 직접 import하세요.
// Storybook vitest mock 변환기가 type 재내보내기를 런타임 값으로 취급하므로 제거

// ============================================================================
// Types
// ============================================================================

export interface UseAIChatCoreOptions {
  /** 세션 ID (외부에서 전달 시 사용) */
  sessionId?: string;
  /** 메시지 전송 콜백 */
  onMessageSend?: (message: string) => void;
  /** 세션 제한 비활성화 (전체화면에서 필요시) */
  disableSessionLimit?: boolean;
}

export interface UseAIChatCoreReturn {
  // 입력 상태
  input: string;
  setInput: (value: string) => void;

  // 메시지
  messages: EnhancedChatMessage[];
  sendQuery: (query: string) => void;

  // 로딩/진행 상태
  isLoading: boolean;
  hybridState: {
    progress?: { progress: number; stage: string; message?: string };
    jobId?: string;
    error?: string | null;
  };
  currentMode?: 'streaming' | 'job-queue';

  // 에러 상태
  error: string | null;
  clearError: () => void;

  // 세션 관리
  sessionId: string;
  sessionState: SessionState;
  handleNewSession: () => void;

  // 액션
  handleFeedback: (
    messageId: string,
    type: 'positive' | 'negative'
  ) => Promise<boolean>;
  regenerateLastResponse: () => void;
  /** 마지막 쿼리 재시도 (파일 첨부 포함) */
  retryLastQuery: () => void;
  stop: () => void;
  cancel: () => void;

  // 입력 처리 (파일 첨부 지원)
  handleSendInput: (attachments?: FileAttachment[]) => void;

  // 명확화 기능
  clarification: ClarificationRequest | null;
  selectClarification: (option: ClarificationOption) => void;
  submitCustomClarification: (customInput: string) => void;
  skipClarification: () => void;
  /** 명확화 취소 (쿼리 미실행, 상태 정리만) */
  dismissClarification: () => void;

  // 대기열 큐 상태
  queuedQueries: Array<{
    id: number;
    text: string;
    attachments?: FileAttachment[];
  }>;
  removeQueuedQuery: (index: number) => void;

  // 🎯 실시간 Agent 상태 (스트리밍 중 표시)
  currentAgentStatus: AgentStatusEventData | null;
  currentHandoff: HandoffEventData | null;

  /** Cloud Run AI Engine 웜업 중 여부 */
  warmingUp: boolean;
  /** 웜업 예상 대기 시간 (초) */
  estimatedWaitSeconds: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useAIChatCore(
  options: UseAIChatCoreOptions = {}
): UseAIChatCoreReturn {
  const {
    sessionId: propSessionId,
    onMessageSend,
    disableSessionLimit,
  } = options;

  // 입력 상태
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 🎯 실시간 Agent 상태 (스트리밍 중 표시)
  const [currentAgentStatus, setCurrentAgentStatus] =
    useState<AgentStatusEventData | null>(null);
  const [currentHandoff, setCurrentHandoff] = useState<HandoffEventData | null>(
    null
  );

  // 웹 검색 / RAG 토글 상태 (Store에서 읽기)
  const webSearchEnabled = useAISidebarStore((s) => s.webSearchEnabled);
  const ragEnabled = useAISidebarStore((s) => s.ragEnabled);

  // 🧩 Chat Queue Hook (메시지 대기열 Batching)
  const {
    queuedQueries,
    addToQueue,
    removeQueuedQuery,
    popAndSendQueue,
    clearQueue,
    sendQueryRef,
  } = useChatQueue();

  // 스트리밍 done 이벤트에서 수신한 ragSources (웹 검색 결과 등)
  const [streamRagSources, setStreamRagSources] = useState<
    Array<{
      title: string;
      similarity: number;
      sourceType: string;
      category?: string;
      url?: string;
    }>
  >([]);

  // Refs
  const lastQueryRef = useRef<string>('');
  const lastAttachmentsRef = useRef<FileAttachment[] | null>(null);
  const pendingQueryRef = useRef<string>('');

  // 🧩 Composed Hooks
  const { sessionId, sessionIdRef, refreshSessionId, setSessionId } =
    useChatSession(propSessionId);
  const { handleFeedback } = useChatFeedback(sessionIdRef);

  // ============================================================================
  // Hybrid AI Query Hook
  // ============================================================================

  // Deferred metadata handlers ref: populated after useDeferredMessageMetadata call below.
  // onData fires asynchronously (never during the first render), so the ref is always
  // populated before it's first invoked.
  const deferredHandlersRef = useRef<
    import('./useDeferredMessageMetadata').DeferredMetadataHandlers | null
  >(null);

  const {
    sendQuery,
    executeQuery,
    messages,
    setMessages,
    state: hybridState,
    isLoading: hybridIsLoading,
    stop,
    cancel,
    reset: resetHybridQuery,
    clearError: clearHybridError,
    currentMode,
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
  } = useHybridAIQuery({
    sessionId: sessionId,
    webSearchEnabled,
    ragEnabled,
    onStreamFinish: () => {
      onMessageSend?.(pendingQueryRef.current);
      setError(null);
      pendingQueryRef.current = '';
      // 🎯 스트리밍 완료 시 상태 초기화
      setCurrentAgentStatus(null);
      setCurrentHandoff(null);
    },
    onJobResult: (result) => {
      onMessageSend?.(pendingQueryRef.current);
      if (result.success) {
        setError(null);
      } else if (result.error) {
        setError(result.error);
      }
      pendingQueryRef.current = '';
      if (process.env.NODE_ENV === 'development') {
        logger.info('📦 [Job Queue] Result received:', result.success);
      }
    },
    onProgress: (progress) => {
      if (process.env.NODE_ENV === 'development') {
        logger.info(
          `📊 [Job Queue] Progress: ${progress.progress}% - ${progress.stage}`
        );
      }
    },
    // 🎯 실시간 SSE 이벤트 처리 (agent_status, handoff)
    onData: (dataPart: StreamDataPart) => {
      const dh = deferredHandlersRef.current;
      if (!dh) return;
      handleStreamDataPart(dataPart, {
        setCurrentAgentStatus,
        setCurrentHandoff,
        setMessageTraceId: dh.setMessageTraceId,
        setStreamRagSources,
        getPendingToolResults: dh.getPendingToolResults,
        setPendingToolResults: dh.setPendingToolResults,
        getPendingMessageMetadata: dh.getPendingMessageMetadata,
        setPendingMessageMetadata: dh.setPendingMessageMetadata,
        setDeferredAssistantMetadata: dh.setDeferredAssistantMetadata,
        setDeferredAssistantToolResults: dh.setDeferredAssistantToolResults,
        getMessages: () => messagesRef.current,
      });
    },
  });

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ============================================================================
  // Deferred Metadata Hook (flush effect runs inside this hook)
  // ============================================================================

  const {
    streamTraceIds,
    deferredAssistantMetadataByMessageId,
    deferredToolResultsByMessageId,
    handlers: deferredHandlers,
    resetDeferredMetadata,
  } = useDeferredMessageMetadata(messages);

  // Keep ref in sync so onData closure can always reach the latest handlers
  deferredHandlersRef.current = deferredHandlers;

  useEffect(() => {
    sendQueryRef.current = sendQuery;
  }, [sendQuery, sendQueryRef]);

  const hasQueuedQueries = queuedQueries.length > 0;

  // 🎯 대기열 쿼리 발송 Effect: 응답이 완전히 끝났을 때(hybridIsLoading false 전환 시)
  // 단, 에러가 없을 때만 발송(에러 발생 시엔 재시도 등 대비해 큐 유지/또는 별도 처리)
  useEffect(() => {
    if (!hybridIsLoading && hasQueuedQueries && !error) {
      popAndSendQueue();
    }
  }, [hybridIsLoading, hasQueuedQueries, error, popAndSendQueue]);

  // ============================================================================
  // Message Transformation
  // ============================================================================

  const enhancedMessages = useMemo<EnhancedChatMessage[]>(() => {
    return transformMessages(messages, {
      isLoading: hybridIsLoading,
      currentMode: currentMode ?? undefined,
      traceIdByMessageId: streamTraceIds,
      deferredAssistantMetadataByMessageId,
      deferredToolResultsByMessageId,
      streamRagSources:
        streamRagSources.length > 0 ? streamRagSources : undefined,
      ragEnabled,
    });
  }, [
    messages,
    hybridIsLoading,
    currentMode,
    streamTraceIds,
    deferredAssistantMetadataByMessageId,
    deferredToolResultsByMessageId,
    streamRagSources,
    ragEnabled,
  ]);

  // 🧩 History Hook (Needs messages from hybrid query)
  const { clearHistory } = useChatHistory({
    sessionId,
    isMessagesEmpty: messages.length === 0,
    enhancedMessages,
    setMessages,
    isLoading: hybridIsLoading,
    onSessionRestore: setSessionId,
  });

  // 🧩 Session State Hook
  const sessionState = useChatSessionState(
    messages.length,
    disableSessionLimit
  );

  // ============================================================================
  // Effects
  // ============================================================================

  // ⚡ Cloud Run 선제 웜업: 사이드바 마운트 시 한 번만 실행
  // 쿼리 시점이 아닌 UI 진입 시점에 wake-up하여 cold start 시간 선점
  useEffect(() => {
    void triggerAIWarmup('ai-chat-core');
  }, []);

  // 에러 동기화: hybridState.error가 변경될 때만 반영
  useEffect(() => {
    if (hybridState.error) {
      setError(hybridState.error);
    }
  }, [hybridState.error]);

  const handleNewSession = useCallback(() => {
    resetHybridQuery();
    refreshSessionId();
    setInput('');
    setError(null);
    setStreamRagSources([]);
    resetDeferredMetadata();
    setCurrentAgentStatus(null);
    setCurrentHandoff(null);
    pendingQueryRef.current = '';
    lastAttachmentsRef.current = null;
    clearHistory();
    clearQueue();
  }, [
    resetHybridQuery,
    refreshSessionId,
    resetDeferredMetadata,
    clearHistory,
    clearQueue,
  ]);

  const clearError = useCallback(() => {
    setError(null);
    clearHybridError();
  }, [clearHybridError]);

  const regenerateLastResponse = useCallback(() => {
    if (messages.length < 2) return;
    const lastUserMessageIndex = [...messages]
      .reverse()
      .findIndex((m) => m.role === 'user');
    if (lastUserMessageIndex === -1) return;
    const actualIndex = messages.length - 1 - lastUserMessageIndex;
    const lastUserMessage = messages[actualIndex];
    if (!lastUserMessage) return;

    // Extract text content from the message (null/undefined 방어 코드)
    const textPart = lastUserMessage.parts?.find(
      (p): p is { type: 'text'; text: string } => p != null && p.type === 'text'
    );
    const textContent = textPart?.text;

    if (textContent) {
      setMessages(messages.slice(0, actualIndex));
      setError(null);
      // BUG-7 fix: setMessages는 비동기 상태 업데이트이므로 sendQuery를 microtask로 지연
      queueMicrotask(() => sendQuery(textContent));
    }
  }, [messages, setMessages, sendQuery]);

  /**
   * 마지막 쿼리 재시도
   *
   * 에러 발생 후 동일한 쿼리를 다시 전송합니다.
   * 파일 첨부가 있었던 경우 함께 재전송됩니다.
   *
   * @see lastAttachmentsRef - 첨부 파일 보존용 ref
   */
  const retryLastQuery = useCallback(() => {
    if (!lastQueryRef.current) return;
    setError(null);
    // 🎯 Fix: 재시도 시 executeQuery 사용 (재분류/재명확화 건너뛰기)
    // Cold Start 타임아웃 → 자동 재시도 시 동일 쿼리에 대해 명확화가 재트리거되는 문제 방지
    executeQuery(
      lastQueryRef.current,
      lastAttachmentsRef.current || undefined,
      true
    );
  }, [executeQuery]);

  /**
   * 명확화 선택 래퍼 - lastQueryRef를 명확화된 쿼리로 업데이트
   * 재시도 시 명확화된 쿼리가 사용되도록 보장
   */
  const wrappedSelectClarification = useCallback(
    (option: ClarificationOption) => {
      // lastQueryRef를 명확화된 쿼리로 업데이트 (재시도 대비)
      lastQueryRef.current = option.suggestedQuery;
      selectClarification(option);
    },
    [selectClarification]
  );

  // ============================================================================
  // Input Handler
  // ============================================================================

  const handleSendInput = useCallback(
    (attachments?: FileAttachment[]) => {
      // 🎯 Fix: 텍스트 또는 첨부 중 하나는 있어야 전송
      const hasText = input.trim().length > 0;
      const hasAttachments = attachments && attachments.length > 0;

      if (!hasText && !hasAttachments) return;

      if (!disableSessionLimit && sessionState.isLimitReached) {
        logger.warn(
          `⚠️ [Session] Limit reached (${sessionState.count} messages)`
        );
        return;
      }

      // 🎯 Fix: 첨부만 있을 경우 기본 텍스트 설정
      const effectiveText = hasText ? input : '[이미지/파일 분석 요청]';

      // 🎯 Batching: 스트리밍 중이면 큐에 추가 (즉시 전송하지 않음)
      if (hybridIsLoading) {
        addToQueue(effectiveText, attachments);
        setInput('');
        return;
      }

      setError(null);
      setStreamRagSources([]);
      lastQueryRef.current = effectiveText;
      lastAttachmentsRef.current = attachments || null;
      pendingQueryRef.current = effectiveText;
      setInput('');

      // 🎯 파일 첨부와 함께 전송
      sendQuery(effectiveText, attachments);
    },
    [
      input,
      disableSessionLimit,
      sessionState,
      hybridIsLoading,
      sendQuery,
      addToQueue,
    ]
  );

  // ============================================================================
  // Return
  // ============================================================================

  return {
    input,
    setInput,
    messages: enhancedMessages,
    sendQuery,
    isLoading: hybridIsLoading,
    hybridState: {
      progress: hybridState.progress ?? undefined,
      jobId: hybridState.jobId ?? undefined,
      error: hybridState.error ?? undefined,
    },
    currentMode: currentMode ?? undefined,
    error,
    clearError,
    sessionId: sessionId,
    sessionState,
    handleNewSession,
    handleFeedback,
    regenerateLastResponse,
    retryLastQuery,
    stop,
    cancel,
    handleSendInput,
    clarification: hybridState.clarification ?? null,
    selectClarification: wrappedSelectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
    queuedQueries,
    removeQueuedQuery,
    // 🎯 실시간 Agent 상태
    currentAgentStatus,
    currentHandoff,

    // ⚡ Cloud Run 웜업 상태
    warmingUp: hybridState.warmingUp,
    estimatedWaitSeconds: hybridState.estimatedWaitSeconds,
  };
}

export default useAIChatCore;
