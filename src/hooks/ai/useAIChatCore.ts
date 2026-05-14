'use client';

/**
 * 🤖 useAIChatCore - AI 채팅 공통 로직 훅
 *
 * AISidebarV4와 AIWorkspace에서 공유하는 핵심 로직:
 * - Hybrid AI Query (Streaming + Job Queue)
 * - 세션 제한
 * - 메시지 변환
 * - 파일 첨부 재시도 지원
 *
 * @note 유틸리티는 utils/ 폴더로 분리됨
 * @updated 2026-01-28 - 재시도 시 파일 첨부 보존 (lastAttachmentsRef)
 */

import type { UIMessage } from '@ai-sdk/react';
import {
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  type AgentStatusEventData,
  type ClarificationOption,
  type HandoffEventData,
  useHybridAIQuery,
} from '@/hooks/ai/useHybridAIQuery';
import {
  classifyChatArtifactIntent,
  fetchLLMChatArtifactIntent,
  shouldUseLLMChatArtifactIntent,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import type { DeveloperPanelData } from '@/lib/ai/developer-panel';
import { logger } from '@/lib/logging';
import { useAISidebarStore } from '@/stores/useAISidebarStore';
import { triggerAIWarmup } from '@/utils/ai-warmup';
import { startChatArtifactGeneration } from './core/chat-artifact-execution';
import { createArtifactGuidanceMessages } from './core/chat-artifact-metadata';
import {
  createDebugRoutingMessages,
  createQAAssistantMessages,
  isDebugRoutingPrompt,
  isQAThinkingVisualizerPrompt,
} from './core/routing-debug-messages';
import { useChatHistory } from './core/useChatHistory';
import { useChatQueue } from './core/useChatQueue';
import { useChatSession } from './core/useChatSession';
import { useChatSessionState } from './core/useChatSessionState';
import type { StreamRagSource } from './types/stream-rag.types';
import type {
  UseAIChatCoreOptions as UseAIChatCoreOptionsBase,
  UseAIChatCoreReturn as UseAIChatCoreReturnBase,
} from './useAIChatCore.types';
import { useAIChatHybridCallbacks } from './useAIChatHybridCallbacks';
import { useDeferredMessageMetadata } from './useDeferredMessageMetadata';
import { useEnhancedChatMessages } from './useEnhancedChatMessages';
import type { FileAttachment } from './useFileAttachments';
import { convertThinkingStepsToUI } from './utils/message-helpers';

// Re-export for backwards compatibility
export { convertThinkingStepsToUI };
// NOTE: SessionState 타입은 './core/useChatSessionState'에서 직접 import하세요.
// Storybook vitest mock 변환기가 type 재내보내기를 런타임 값으로 취급하므로 제거

export interface UseAIChatCoreOptions extends UseAIChatCoreOptionsBase {}
export interface UseAIChatCoreReturn extends UseAIChatCoreReturnBase {}

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
    queryAsOfDataSlot,
  } = options;

  // 입력 상태
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [artifactIsLoading, setArtifactIsLoading] = useState(false);

  // 🎯 실시간 Agent 상태 (스트리밍 중 표시)
  const [currentAgentStatus, setCurrentAgentStatus] =
    useState<AgentStatusEventData | null>(null);
  const [currentHandoff, setCurrentHandoff] = useState<HandoffEventData | null>(
    null
  );

  // 웹 검색 UI 상태와 내부 RAG override 상태 (Store에서 읽기)
  const webSearchEnabled = useAISidebarStore((s) => s.webSearchEnabled);
  const ragEnabled = useAISidebarStore((s) => s.ragEnabled);
  const analysisMode = useAISidebarStore((s) => s.analysisMode);
  const persistedSidebarMessages = useAISidebarStore((s) => s.messages);
  const persistedSidebarSessionId = useAISidebarStore((s) => s.sessionId);
  const syncChatSnapshot = useAISidebarStore((s) => s.syncChatSnapshot);

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
  const [streamRagSources, setStreamRagSources] = useState<StreamRagSource[]>(
    []
  );
  const [developerPanelData, setDeveloperPanelData] =
    useState<DeveloperPanelData | null>(null);
  const developerPanelDataRef = useRef<DeveloperPanelData | null>(null);

  // Refs
  const lastQueryRef = useRef<string>('');
  const lastAttachmentsRef = useRef<FileAttachment[] | null>(null);
  const pendingQueryRef = useRef<string>('');
  const artifactIntentInFlightRef = useRef(false);
  const artifactInFlightRef = useRef(false);
  const artifactRequestIdRef = useRef<string | null>(null);
  const artifactAbortControllerRef = useRef<AbortController | null>(null);

  // 🧩 Composed Hooks
  const { sessionId, refreshSessionId, setSessionId } =
    useChatSession(propSessionId);

  // ============================================================================
  // Hybrid AI Query Hook
  // ============================================================================

  // Deferred metadata handlers ref: populated after useDeferredMessageMetadata call below.
  // onData fires asynchronously (never during the first render), so the ref is always
  // populated before it's first invoked.
  const deferredHandlersRef = useRef<
    import('./useDeferredMessageMetadata').DeferredMetadataHandlers | null
  >(null);

  const messagesRef = useRef<UIMessage[]>([]);
  const getPendingQuery = useCallback(() => pendingQueryRef.current, []);
  const clearPendingQuery = useCallback(() => {
    pendingQueryRef.current = '';
  }, []);
  const getDeferredHandlers = useCallback(
    () => deferredHandlersRef.current,
    []
  );
  const getMessages = useCallback(() => messagesRef.current, []);
  const getDeveloperPanelData = useCallback(
    () => developerPanelDataRef.current,
    []
  );
  const updateDeveloperPanelData = useCallback(
    (next: SetStateAction<DeveloperPanelData | null>) => {
      const resolved =
        typeof next === 'function' ? next(developerPanelDataRef.current) : next;
      developerPanelDataRef.current = resolved;
      setDeveloperPanelData(resolved);
    },
    []
  );

  const hybridCallbacks = useAIChatHybridCallbacks({
    onMessageSend,
    getPendingQuery,
    clearPendingQuery,
    getDeferredHandlers,
    getMessages,
    setError,
    setCurrentAgentStatus,
    setCurrentHandoff,
    setStreamRagSources,
    getDeveloperPanelData,
    setDeveloperPanelData: updateDeveloperPanelData,
  });

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
    streamStatus,
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
  } = useHybridAIQuery({
    sessionId,
    webSearchEnabled,
    ragEnabled,
    analysisMode,
    queryAsOfDataSlot,
    ...hybridCallbacks,
  });
  const isGenerating = hybridIsLoading || artifactIsLoading;

  const {
    streamTraceIds,
    deferredAssistantMetadataByMessageId,
    deferredToolResultsByMessageId,
    handlers: deferredHandlers,
    resetDeferredMetadata,
  } = useDeferredMessageMetadata(messages);

  useEffect(() => {
    sendQueryRef.current = sendQuery;
  }, [sendQuery, sendQueryRef]);

  // Keep imperative refs aligned before async stream callbacks observe them.
  useLayoutEffect(() => {
    messagesRef.current = messages;
    deferredHandlersRef.current = deferredHandlers;
    developerPanelDataRef.current = developerPanelData;
  }, [messages, deferredHandlers, developerPanelData]);

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

  const enhancedMessages = useEnhancedChatMessages({
    messages,
    isLoading: isGenerating,
    currentMode: currentMode ?? undefined,
    traceIdByMessageId: streamTraceIds,
    deferredAssistantMetadataByMessageId,
    deferredToolResultsByMessageId,
    streamRagSources:
      streamRagSources.length > 0 ? streamRagSources : undefined,
    ragEnabled,
  });

  // 🧩 History Hook (Needs messages from hybrid query)
  const handleMetadataRestore = useCallback(
    (
      metadataByMessageId: Record<
        string,
        { toolsCalled?: string[]; ragSources?: unknown[] }
      >
    ) => {
      for (const [messageId, meta] of Object.entries(metadataByMessageId)) {
        deferredHandlers.setDeferredAssistantMetadata(
          messageId,
          meta as Record<string, unknown>
        );
      }
    },
    [deferredHandlers]
  );

  const { clearHistory } = useChatHistory({
    sessionId,
    isMessagesEmpty: messages.length === 0,
    enhancedMessages,
    seedMessages: persistedSidebarMessages,
    seedSessionId: persistedSidebarSessionId,
    setMessages,
    isLoading: isGenerating,
    onSessionRestore: setSessionId,
    onMetadataRestore: handleMetadataRestore,
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

  // 에러 동기화: retry 경로가 로컬 에러를 먼저 지우지 않도록 정렬했으므로
  // 메시지 변경 기준으로만 동기화한다.
  useEffect(() => {
    setError(hybridState.error ?? null);
  }, [hybridState.error]);

  // 새 쿼리 시작 시 이전 스트림 RAG 출처를 초기화해 혼합 표시를 방지한다.
  useEffect(() => {
    if (hybridIsLoading) {
      setStreamRagSources([]);
    }
  }, [hybridIsLoading]);

  useEffect(() => {
    if (enhancedMessages.length === 0) return;
    syncChatSnapshot(enhancedMessages, sessionId);
  }, [enhancedMessages, sessionId, syncChatSnapshot]);

  const handleNewSession = useCallback(() => {
    resetHybridQuery();
    updateDeveloperPanelData(null);
    const nextSessionId = refreshSessionId();
    setInput('');
    setError(null);
    setStreamRagSources([]);
    resetDeferredMetadata();
    setCurrentAgentStatus(null);
    setCurrentHandoff(null);
    pendingQueryRef.current = '';
    lastAttachmentsRef.current = null;
    artifactAbortControllerRef.current?.abort();
    artifactAbortControllerRef.current = null;
    artifactRequestIdRef.current = null;
    artifactIntentInFlightRef.current = false;
    artifactInFlightRef.current = false;
    setArtifactIsLoading(false);
    clearHistory();
    clearQueue();
    syncChatSnapshot([], nextSessionId);
  }, [
    resetHybridQuery,
    refreshSessionId,
    resetDeferredMetadata,
    clearHistory,
    clearQueue,
    syncChatSnapshot,
    updateDeveloperPanelData,
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
    async (attachments?: FileAttachment[], overrideText?: string) => {
      // 🎯 Fix: 텍스트 또는 첨부 중 하나는 있어야 전송
      const textInput = overrideText ?? input;
      const hasText = textInput.trim().length > 0;
      const hasAttachments = attachments && attachments.length > 0;

      if (!hasText && !hasAttachments) return;

      if (!disableSessionLimit && sessionState.isLimitReached) {
        logger.warn(
          `⚠️ [Session] Limit reached (${sessionState.count} messages)`
        );
        return;
      }

      // 🎯 Fix: 첨부만 있을 경우 기본 텍스트 설정
      const effectiveText = hasText ? textInput : '[이미지/파일 분석 요청]';

      // 🎯 Batching: 스트리밍 중이면 큐에 추가 (즉시 전송하지 않음)
      if (hybridIsLoading) {
        addToQueue(effectiveText, attachments);
        setInput('');
        return;
      }

      if (artifactInFlightRef.current || artifactIntentInFlightRef.current) {
        setError(
          '아티팩트 생성이 진행 중입니다. 완료 후 다음 요청을 보내주세요.'
        );
        return;
      }

      if (isQAThinkingVisualizerPrompt(effectiveText)) {
        setError(null);
        setStreamRagSources([]);
        lastQueryRef.current = effectiveText;
        lastAttachmentsRef.current = attachments || null;
        pendingQueryRef.current = '';
        setInput('');
        const [qaUserMessage, qaAssistantMessage] =
          createQAAssistantMessages(effectiveText);
        setMessages([...messages, qaUserMessage, qaAssistantMessage]);
        return;
      }

      if (isDebugRoutingPrompt(effectiveText)) {
        setError(null);
        setStreamRagSources([]);
        lastQueryRef.current = effectiveText;
        lastAttachmentsRef.current = attachments || null;
        pendingQueryRef.current = '';
        setInput('');
        const [dbgUserMsg, dbgAssistantMsg] = createDebugRoutingMessages(
          effectiveText,
          analysisMode
        );
        setMessages([...messages, dbgUserMsg, dbgAssistantMsg]);
        return;
      }

      const regexIntent = classifyChatArtifactIntent(effectiveText);
      let artifactIntent = regexIntent;
      if (
        regexIntent.kind === 'none' &&
        shouldUseLLMChatArtifactIntent(effectiveText)
      ) {
        const intentAbortController = new AbortController();
        artifactIntentInFlightRef.current = true;
        artifactAbortControllerRef.current = intentAbortController;
        try {
          artifactIntent = await fetchLLMChatArtifactIntent(
            effectiveText,
            intentAbortController.signal
          );
        } finally {
          artifactIntentInFlightRef.current = false;
          if (artifactAbortControllerRef.current === intentAbortController) {
            artifactAbortControllerRef.current = null;
          }
        }

        // fetchLLMChatArtifactIntent intentionally degrades failures to none.
        // On an explicit abort, stop here so cancellation does not fall through
        // into the normal Supervisor chat path.
        if (intentAbortController.signal.aborted) {
          return;
        }
      }
      if (artifactIntent.kind === 'guidance') {
        setError(null);
        setStreamRagSources([]);
        lastQueryRef.current = effectiveText;
        lastAttachmentsRef.current = attachments || null;
        pendingQueryRef.current = '';
        setInput('');
        const [guidanceUserMessage, guidanceAssistantMessage] =
          createArtifactGuidanceMessages({
            query: effectiveText,
            target: artifactIntent.target,
            reason: artifactIntent.reason,
          });
        setMessages([
          ...messages,
          guidanceUserMessage,
          guidanceAssistantMessage,
        ]);
        return;
      }

      if (
        artifactIntent.kind === 'incident-report' ||
        artifactIntent.kind === 'monitoring-analysis' ||
        artifactIntent.kind === 'server-monitoring-analysis' ||
        artifactIntent.kind === 'server-snapshot' ||
        artifactIntent.kind === 'ops-procedure'
      ) {
        setError(null);
        setStreamRagSources([]);
        lastQueryRef.current = effectiveText;
        lastAttachmentsRef.current = attachments || null;
        pendingQueryRef.current = '';
        setInput('');

        startChatArtifactGeneration({
          artifactIntent,
          query: effectiveText,
          sessionId,
          queryAsOfDataSlot,
          messages,
          messagesRef,
          setMessages,
          setError,
          setArtifactIsLoading,
          artifactRequestIdRef,
          artifactAbortControllerRef,
          artifactInFlightRef,
        });
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
      messages,
      setMessages,
      analysisMode,
      sessionId,
      queryAsOfDataSlot,
    ]
  );

  const stopGeneration = useCallback(() => {
    if (artifactInFlightRef.current || artifactIntentInFlightRef.current) {
      artifactAbortControllerRef.current?.abort();
      return;
    }

    stop();
  }, [stop]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    input,
    setInput,
    messages: enhancedMessages,
    sendQuery,
    isLoading: isGenerating,
    hybridState: {
      progress: hybridState.progress ?? undefined,
      jobId: hybridState.jobId ?? undefined,
      error: hybridState.error ?? undefined,
      errorDetails: hybridState.errorDetails ?? undefined,
    },
    currentMode: currentMode ?? undefined,
    streamStatus,
    error,
    clearError,
    sessionId: sessionId,
    sessionState,
    handleNewSession,
    regenerateLastResponse,
    retryLastQuery,
    stop: stopGeneration,
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
    developerPanelData,

    // ⚡ Cloud Run 웜업 상태
    warmingUp: hybridState.warmingUp,
    estimatedWaitSeconds: hybridState.estimatedWaitSeconds,
  };
}
