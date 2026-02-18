/**
 * useHybridAIQuery Hook
 *
 * @description 쿼리 복잡도에 따라 자동으로 최적의 방식을 선택하는 하이브리드 AI 쿼리 훅
 *
 * 라우팅 전략:
 * - simple (score ≤ 20): useChat (빠른 스트리밍)
 * - moderate (20 < score ≤ 45): useChat (표준 스트리밍)
 * - complex/very_complex (score > 45): Job Queue (진행률 표시 + 타임아웃 회피)
 *
 * Architecture (split into sub-hooks):
 * - core/useQueryExecution.ts: executeQuery + sendQuery routing
 * - core/useQueryControls.ts: stop, cancel, reset, previewComplexity
 * - core/useClarificationHandlers.ts: clarification flow
 *
 * @example
 * ```tsx
 * const { sendQuery, messages, isLoading, progress, mode } = useHybridAIQuery({
 *   sessionId: 'session_123',
 * });
 *
 * const handleSubmit = () => {
 *   sendQuery(userInput);
 * };
 * ```
 *
 * @created 2025-12-30
 * @updated 2026-02-10 - Split into sub-hooks (876 → ~590 lines)
 */

import type { UIMessage } from '@ai-sdk/react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateRetryDelay,
  generateTraceId,
  generateTraceparent,
  getComplexityThreshold,
  getObservabilityConfig,
  getStreamRetryConfig,
  isRetryableError,
  TRACEPARENT_HEADER,
} from '@/config/ai-proxy.config';
import { extractStreamError } from '@/lib/ai/constants/stream-errors';
import { logger } from '@/lib/logging';
import { useClarificationHandlers } from './core/useClarificationHandlers';
import { useQueryControls } from './core/useQueryControls';
import { useQueryExecution } from './core/useQueryExecution';
import { useAsyncAIQuery } from './useAsyncAIQuery';
import { generateMessageId } from './utils/hybrid-query-utils';

// ============================================================================
// Types (extracted to types/hybrid-query.types.ts)
// ============================================================================
export type {
  AgentStatus,
  AgentStatusEventData,
  ClarificationOption,
  ClarificationRequest,
  HandoffEventData,
  HybridQueryState,
  QueryMode,
  RedirectEventData,
  StreamDataPart,
  StreamEventType,
  UseHybridAIQueryOptions,
  UseHybridAIQueryReturn,
  WarningEventData,
} from './types/hybrid-query.types';

// ============================================================================
// Error Detection Constants (SSOT)
// ============================================================================
import {
  COLD_START_ERROR_PATTERNS,
  isColdStartRelatedError,
  STREAM_ERROR_MARKER,
  STREAM_ERROR_REGEX,
} from '@/lib/ai/constants/stream-errors';
import type {
  HybridQueryState,
  RedirectEventData,
  StreamDataPart,
  UseHybridAIQueryOptions,
  UseHybridAIQueryReturn,
  WarningEventData,
} from './types/hybrid-query.types';
import type { FileAttachment } from './useFileAttachments';

// Re-export for consumers
export {
  STREAM_ERROR_MARKER,
  COLD_START_ERROR_PATTERNS,
  STREAM_ERROR_REGEX,
  extractStreamError,
  isColdStartRelatedError,
};

// ============================================================================
// Constants (moved to config/ai-proxy.config.ts)
// ============================================================================
// Note: DEFAULT_COMPLEXITY_THRESHOLD has been moved to ai-proxy.config.ts
// Use getComplexityThreshold() to access the configurable value

// ============================================================================
// Hook Implementation
// ============================================================================

export function useHybridAIQuery(
  options: UseHybridAIQueryOptions = {}
): UseHybridAIQueryReturn {
  const {
    sessionId: initialSessionId,
    apiEndpoint: customEndpoint,
    complexityThreshold = getComplexityThreshold(),
    onStreamFinish,
    onJobResult,
    onProgress,
    onData,
    webSearchEnabled,
  } = options;

  // 🎯 P1: Trace ID for observability
  const traceIdRef = useRef<string>(generateTraceId());
  const observabilityConfig = getObservabilityConfig();

  // 🎯 P1: Stream retry state
  const retryCountRef = useRef<number>(0);
  const streamRetryConfig = getStreamRetryConfig();

  // webSearchEnabled를 ref로 추적: DefaultChatTransport의 body는 ChatStore 생성 시
  // readonly로 고정되므로, Resolvable<object> 함수를 사용해 호출 시점의 최신 값을 반환
  const webSearchEnabledRef = useRef(webSearchEnabled ?? false);
  useEffect(() => {
    webSearchEnabledRef.current = webSearchEnabled ?? false;
  }, [webSearchEnabled]);

  // Determine API endpoint (v2 only - v1 deprecated and removed)
  const apiEndpoint = customEndpoint ?? '/api/ai/supervisor/stream/v2';

  // Session ID with stable initial value
  const sessionIdRef = useRef<string>(
    initialSessionId || generateMessageId('session')
  );

  // State
  const [resumeEnabled, setResumeEnabled] = useState(true);
  const [state, setState] = useState<HybridQueryState>({
    mode: 'streaming',
    complexity: null,
    progress: null,
    jobId: null,
    isLoading: false,
    error: null,
    clarification: null,
    warning: null,
    processingTime: 0,
  });

  // 명확화 건너뛰기 시 원본 쿼리 저장
  const pendingQueryRef = useRef<string | null>(null);
  // 파일 첨부 저장 (명확화 플로우에서 사용)
  const pendingAttachmentsRef = useRef<FileAttachment[] | null>(null);
  // Redirect 이벤트 처리를 위한 쿼리 저장
  const currentQueryRef = useRef<string | null>(null);
  // 🔒 Error Race Condition 방지
  const errorHandledRef = useRef<boolean>(false);
  // AbortController for graceful request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Retry setTimeout ID for cleanup on unmount
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================================
  // useChat Hook (Streaming Mode) - AI SDK v6
  // ============================================================================
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        headers: () => ({
          [TRACEPARENT_HEADER]: generateTraceparent(traceIdRef.current),
          [observabilityConfig.traceIdHeader]: traceIdRef.current,
        }),
        body: () => ({ enableWebSearch: webSearchEnabledRef.current }),
        prepareReconnectToStreamRequest: ({ id }) => ({
          api: `${apiEndpoint}?sessionId=${id}`,
        }),
      }),
    [apiEndpoint, observabilityConfig.traceIdHeader]
  );

  const {
    messages,
    sendMessage,
    status: chatStatus,
    setMessages,
    stop: stopChat,
  } = useChat({
    id: sessionIdRef.current,
    transport,
    // Abort/stop 사용 후에는 현재 스트림 재연결을 비활성화하고,
    // 새 쿼리 시작 시에만 다시 활성화해 resume+abort 충돌 가능성을 줄인다.
    resume: resumeEnabled,
    onFinish: ({ message }) => {
      // 🔒 Race Condition 방지: onError가 이미 에러를 처리했으면 스킵
      if (errorHandledRef.current) {
        logger.debug(
          '[HybridAI] onFinish skipped (error already handled by onError)'
        );
        setState((prev) => ({ ...prev, isLoading: false }));
        onStreamFinish?.();
        return;
      }

      // 스트림 완료 후 에러 패턴 감지
      const parts = message.parts ?? [];
      const content = parts
        .filter(
          (p): p is { type: 'text'; text: string } =>
            p != null && p.type === 'text'
        )
        .map((p) => p.text)
        .join('');

      const streamError = extractStreamError(content);

      if (streamError) {
        logger.warn(
          `[HybridAI] Stream error detected (trace: ${traceIdRef.current}): ${streamError}`
        );
        errorHandledRef.current = true;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: streamError,
        }));
      } else {
        retryCountRef.current = 0;
        if (observabilityConfig.verboseLogging) {
          logger.info(
            `[HybridAI] Stream completed successfully (trace: ${traceIdRef.current})`
          );
        }
        setState((prev) => ({ ...prev, isLoading: false }));
      }
      onStreamFinish?.();
    },
    onData: (dataPart) => {
      const part = dataPart as StreamDataPart;

      // Warning 이벤트 처리
      if (part.type === 'data-warning' && part.data) {
        const warningData = part.data as WarningEventData;

        if (warningData.code === 'SLOW_PROCESSING') {
          logger.warn(
            `⚠️ [HybridAI] Slow processing: ${warningData.message} (${warningData.elapsed}ms)`
          );
          setState((prev) => {
            if (prev.warning) return prev;
            return {
              ...prev,
              warning: warningData.message,
              processingTime: warningData.elapsed,
            };
          });
        } else {
          logger.warn(`⚠️ [HybridAI] Stream error: ${warningData.message}`);
          setState((prev) => {
            if (prev.warning) return prev;
            return {
              ...prev,
              warning: warningData.message,
            };
          });
        }
        return;
      }

      // Redirect 이벤트 내부 처리 (Job Queue 모드 전환)
      if (part.type === 'data-redirect' && part.data) {
        const redirectData = part.data as RedirectEventData;
        logger.info(
          `🔀 [HybridAI] Redirect received: switching to job-queue (${redirectData.complexity})`
        );

        setState((prev) => ({
          ...prev,
          mode: 'job-queue',
          complexity: redirectData.complexity,
          isLoading: true,
        }));

        // resume + stop 조합 충돌을 피하기 위해 redirect 전환 시 현재 스트림 resume 비활성화
        setResumeEnabled(false);
        stopChat();

        const query = currentQueryRef.current;
        if (query) {
          abortControllerRef.current?.abort();
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const currentQuery = query;

          queueMicrotask(() => {
            if (controller.signal.aborted) {
              logger.debug('[HybridAI] Job Queue redirect aborted');
              return;
            }
            // P1-10: ref를 통해 최신 asyncQuery 참조 (stale closure 방지)
            asyncQueryRef.current
              .sendQuery(currentQuery)
              .then(() => {
                if (!controller.signal.aborted) {
                  logger.debug('[HybridAI] Job Queue redirect completed');
                }
              })
              .catch((error) => {
                if (!controller.signal.aborted) {
                  logger.error('[HybridAI] Job Queue redirect failed:', error);
                  setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error:
                      error instanceof Error
                        ? error.message
                        : 'Job Queue 전환 실패',
                  }));
                }
              });
          });
        }
        return;
      }

      // 사용자 onData 콜백 호출
      onData?.(part);
    },
    onError: async (error) => {
      const errorMessage = error.message || 'Unknown error';
      logger.error(
        `[HybridAI] useChat error (trace: ${traceIdRef.current}):`,
        errorMessage
      );

      // 초기 resume probe(아직 사용자 쿼리 없음)에서 발생하는 네트워크 오류는
      // 사용자 오류로 승격하지 않고 무시한다.
      const isResumeProbeWithoutUserQuery =
        !currentQueryRef.current &&
        /(failed to fetch|load failed|networkerror)/i.test(errorMessage);
      if (isResumeProbeWithoutUserQuery) {
        logger.debug(
          `[HybridAI] Ignoring resume probe error before first query (trace: ${traceIdRef.current})`
        );
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      // Atomic check-and-set pattern to prevent double handling
      if (errorHandledRef.current) {
        logger.debug(
          '[HybridAI] onError skipped (already handled by onFinish)'
        );
        return;
      }
      errorHandledRef.current = true;

      // Streaming retry with exponential backoff
      const canRetry =
        isRetryableError(errorMessage) &&
        retryCountRef.current < streamRetryConfig.maxRetries;

      if (canRetry && currentQueryRef.current) {
        retryCountRef.current += 1;
        const delay = calculateRetryDelay(retryCountRef.current - 1);

        logger.info(
          `[HybridAI] Retrying stream (${retryCountRef.current}/${streamRetryConfig.maxRetries}) ` +
            `after ${delay}ms (trace: ${traceIdRef.current})`
        );

        setState((prev) => ({
          ...prev,
          warning: `재연결 중... (${retryCountRef.current}/${streamRetryConfig.maxRetries})`,
        }));

        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          // errorHandledRef is reset inside executeQuery (useQueryExecution.ts L99)
          const query = currentQueryRef.current;
          const attachments = pendingAttachmentsRef.current;
          if (query) {
            executeQuery(query, attachments || undefined, true);
          }
        }, delay);

        return;
      }

      retryCountRef.current = 0;

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage || 'AI 응답 중 오류가 발생했습니다.',
        warning: null,
        processingTime: 0,
      }));
    },
  });

  // ============================================================================
  // useAsyncAIQuery Hook (Job Queue Mode)
  // ============================================================================
  // P1-10 Fix: asyncQuery를 ref에 저장하여 onData redirect 핸들러의 stale closure 방지
  const asyncQueryRef = useRef<ReturnType<typeof useAsyncAIQuery>>(null!);

  const asyncQuery = useAsyncAIQuery({
    sessionId: sessionIdRef.current,
    onProgress: (progress) => {
      setState((prev) => ({ ...prev, progress }));
      onProgress?.(progress);
    },
    onResult: (result) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        progress: null,
        clarification: null,
      }));
      onJobResult?.(result);

      if (result.success && result.response) {
        const messageWithRag = {
          id: generateMessageId('assistant'),
          role: 'assistant' as const,
          content: result.response,
          parts: [{ type: 'text' as const, text: result.response }],
          metadata:
            result.ragSources || result.traceId
              ? {
                  ...(result.ragSources && { ragSources: result.ragSources }),
                  ...(result.traceId && { traceId: result.traceId }),
                }
              : undefined,
        } as UIMessage;
        setMessages((prev) => [...prev, messageWithRag]);
      }
    },
    onError: (error) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error,
        clarification: null,
      }));
    },
  });

  // P1-10: ref를 최신 asyncQuery로 동기화
  asyncQueryRef.current = asyncQuery;

  // ============================================================================
  // Computed Values
  // ============================================================================
  const isChatLoading =
    chatStatus === 'streaming' || chatStatus === 'submitted';
  const isLoading = state.isLoading || isChatLoading || asyncQuery.isLoading;

  // ============================================================================
  // Sub-Hooks: Query Execution (executeQuery + sendQuery)
  // ============================================================================
  const { executeQuery, sendQuery } = useQueryExecution({
    complexityThreshold,
    asyncQuery,
    sendMessage,
    onBeforeStreamingSend: () => {
      setResumeEnabled(true);
    },
    setMessages,
    setState,
    refs: {
      errorHandled: errorHandledRef,
      currentQuery: currentQueryRef,
      pendingQuery: pendingQueryRef,
      pendingAttachments: pendingAttachmentsRef,
    },
  });

  // ============================================================================
  // Sub-Hook: Clarification Handlers
  // ============================================================================
  const {
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
  } = useClarificationHandlers({
    pendingQueryRef,
    pendingAttachmentsRef,
    executeQuery,
    setState,
  });

  // ============================================================================
  // Sub-Hook: Control Functions
  // ============================================================================
  const { stop, cancel, reset, previewComplexity } = useQueryControls({
    currentMode: state.mode,
    asyncQuery,
    stopChat,
    onUserAbort: () => {
      setResumeEnabled(false);
    },
    onReset: () => {
      setResumeEnabled(true);
    },
    setMessages,
    setState,
    refs: {
      abortController: abortControllerRef,
      retryTimeout: retryTimeoutRef,
      retryCount: retryCountRef,
      traceId: traceIdRef,
      pendingQuery: pendingQueryRef,
      pendingAttachments: pendingAttachmentsRef,
      currentQuery: currentQueryRef,
    },
  });

  // ============================================================================
  // Cleanup on Unmount
  // ============================================================================
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  // ============================================================================
  // Return
  // ============================================================================
  return {
    sendQuery,
    executeQuery,
    state,
    messages,
    setMessages,
    progressPercent: state.progress?.progress ?? asyncQuery.progressPercent,
    progressMessage: state.progress?.message ?? asyncQuery.progressMessage,
    isLoading,
    stop,
    cancel,
    reset,
    currentMode: state.mode,
    previewComplexity,
    // Clarification functions
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
  };
}

export default useHybridAIQuery;
