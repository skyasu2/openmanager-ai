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
import { useChatFeedback } from './core/useChatFeedback';
import { useChatHistory } from './core/useChatHistory';
import { useChatSession } from './core/useChatSession';
import {
  type SessionState,
  useChatSessionState,
} from './core/useChatSessionState';
import type { FileAttachment } from './useFileAttachments';
import {
  convertThinkingStepsToUI,
  transformMessages,
} from './utils/message-helpers';

// Re-export for backwards compatibility
export { convertThinkingStepsToUI };
export type { SessionState };

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

  // 🎯 실시간 Agent 상태 (스트리밍 중 표시)
  currentAgentStatus: AgentStatusEventData | null;
  currentHandoff: HandoffEventData | null;
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

  // 웹 검색 토글 상태 (Store에서 읽기)
  const webSearchEnabled = useAISidebarStore((s) => s.webSearchEnabled);

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
      // AI SDK v6: custom data parts는 'data-' prefix 포함 (data-agent-status, data-done 등)
      const partType = dataPart.type;
      if (partType === 'data-agent-status' && dataPart.data) {
        const agentStatus = dataPart.data as AgentStatusEventData;
        setCurrentAgentStatus(agentStatus);
        if (process.env.NODE_ENV === 'development') {
          logger.info(
            `🤖 [Agent Status] ${agentStatus.agent}: ${agentStatus.status}`
          );
        }
      } else if (partType === 'data-handoff' && dataPart.data) {
        const handoff = dataPart.data as HandoffEventData;
        setCurrentHandoff(handoff);
        if (process.env.NODE_ENV === 'development') {
          logger.info(`🔄 [Handoff] ${handoff.from} → ${handoff.to}`);
        }
      } else if (partType === 'data-done') {
        // 완료 시 상태 초기화
        setCurrentAgentStatus(null);
        setCurrentHandoff(null);

        // done 이벤트에서 ragSources 추출 (스트리밍 모드 웹 검색 결과)
        const doneData = dataPart.data as Record<string, unknown> | undefined;
        if (doneData?.ragSources && Array.isArray(doneData.ragSources)) {
          setStreamRagSources(doneData.ragSources as typeof streamRagSources);
        }
      }
    },
  });

  // ============================================================================
  // Message Transformation
  // ============================================================================

  const enhancedMessages = useMemo<EnhancedChatMessage[]>(() => {
    return transformMessages(messages, {
      isLoading: hybridIsLoading,
      currentMode: currentMode ?? undefined,
      streamRagSources:
        streamRagSources.length > 0 ? streamRagSources : undefined,
    });
  }, [messages, hybridIsLoading, currentMode, streamRagSources]);

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

  // 에러 동기화
  useEffect(() => {
    if (hybridState.error && !error) {
      setError(hybridState.error);
    }
  }, [hybridState.error, error]);

  const handleNewSession = useCallback(() => {
    resetHybridQuery();
    refreshSessionId();
    setInput('');
    setError(null);
    setStreamRagSources([]);
    setCurrentAgentStatus(null);
    setCurrentHandoff(null);
    pendingQueryRef.current = '';
    lastAttachmentsRef.current = null;
    clearHistory();
  }, [resetHybridQuery, refreshSessionId, clearHistory]);

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
      sendQuery(textContent);
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

      setError(null);
      setStreamRagSources([]);
      // 🎯 Fix: 첨부만 있을 경우 기본 텍스트 설정
      const effectiveText = hasText ? input : '[이미지/파일 분석 요청]';
      lastQueryRef.current = effectiveText;
      lastAttachmentsRef.current = attachments || null;
      pendingQueryRef.current = effectiveText;
      setInput('');

      // 🎯 파일 첨부와 함께 전송
      sendQuery(effectiveText, attachments);
    },
    [input, disableSessionLimit, sessionState, sendQuery]
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
    // 🎯 실시간 Agent 상태
    currentAgentStatus,
    currentHandoff,
  };
}

export default useAIChatCore;
