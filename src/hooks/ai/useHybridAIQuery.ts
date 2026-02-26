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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  generateTraceId,
  getComplexityThreshold,
  getObservabilityConfig,
  getStreamRetryConfig,
} from '@/config/ai-proxy.config';
import { normalizeAIResponse } from '@/lib/ai/utils/message-normalizer';
import { createHybridChatTransport } from './core/createHybridChatTransport';
import { createHybridStreamCallbacks } from './core/createHybridStreamCallbacks';
import { useClarificationHandlers } from './core/useClarificationHandlers';
import { useQueryControls } from './core/useQueryControls';
import { useQueryExecution } from './core/useQueryExecution';
import { useAsyncAIQuery } from './useAsyncAIQuery';
import { generateMessageId } from './utils/hybrid-query-utils';

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

import {
  COLD_START_ERROR_PATTERNS,
  extractStreamError,
  isColdStartRelatedError,
  STREAM_ERROR_MARKER,
  STREAM_ERROR_REGEX,
} from '@/lib/ai/constants/stream-errors';
import type {
  HybridQueryState,
  UseHybridAIQueryOptions,
  UseHybridAIQueryReturn,
} from './types/hybrid-query.types';
import type { FileAttachment } from './useFileAttachments';
export {
  STREAM_ERROR_MARKER,
  COLD_START_ERROR_PATTERNS,
  STREAM_ERROR_REGEX,
  extractStreamError,
  isColdStartRelatedError,
};

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
    ragEnabled,
  } = options;
  const traceIdRef = useRef<string>(generateTraceId());
  const observabilityConfig = getObservabilityConfig();
  const retryCountRef = useRef<number>(0);
  const streamRetryConfig = getStreamRetryConfig();
  const webSearchEnabledRef = useRef<boolean | undefined>(
    webSearchEnabled ?? undefined
  );
  const ragEnabledRef = useRef<boolean | undefined>(ragEnabled ?? undefined);
  const warmingUpRef = useRef<boolean>(false);
  useEffect(() => {
    webSearchEnabledRef.current = webSearchEnabled ?? undefined;
  }, [webSearchEnabled]);
  useEffect(() => {
    ragEnabledRef.current = ragEnabled ?? undefined;
  }, [ragEnabled]);
  const apiEndpoint = customEndpoint ?? '/api/ai/supervisor/stream/v2';
  const sessionIdRef = useRef<string>(
    initialSessionId || generateMessageId('session')
  );
  const resumeEnabled = false;
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
    warmingUp: false,
    estimatedWaitSeconds: 0,
  });
  // warmingUpRef: onData/transport body 콜백에서 stale closure 방지
  useEffect(() => {
    warmingUpRef.current = state.warmingUp;
  }, [state.warmingUp]);
  const pendingQueryRef = useRef<string | null>(null);
  const pendingAttachmentsRef = useRef<FileAttachment[] | null>(null);
  const currentQueryRef = useRef<string | null>(null);
  const errorHandledRef = useRef<boolean>(false);
  const redirectingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopChatRef = useRef<() => void>(() => {});
  const executeQueryRef = useRef<
    | ((
        query: string,
        attachments?: FileAttachment[],
        isRetry?: boolean
      ) => void)
    | null
  >(null);
  const transport = useMemo(
    () =>
      createHybridChatTransport({
        apiEndpoint,
        traceIdRef,
        traceIdHeader: observabilityConfig.traceIdHeader,
        warmingUpRef,
        webSearchEnabledRef,
        ragEnabledRef,
      }),
    [apiEndpoint, observabilityConfig.traceIdHeader]
  );
  const asyncQueryRef = useRef<ReturnType<typeof useAsyncAIQuery>>(null!);
  const streamCallbacks = useMemo(
    () =>
      createHybridStreamCallbacks({
        traceIdRef,
        verboseLogging: observabilityConfig.verboseLogging,
        maxRetries: streamRetryConfig.maxRetries,
        onStreamFinish,
        onData,
        setState,
        refs: {
          retryCount: retryCountRef,
          warmingUp: warmingUpRef,
          currentQuery: currentQueryRef,
          pendingAttachments: pendingAttachmentsRef,
          errorHandled: errorHandledRef,
          redirecting: redirectingRef,
          abortController: abortControllerRef,
          retryTimeout: retryTimeoutRef,
          executeQuery: executeQueryRef,
        },
        stopStreaming: () => {
          stopChatRef.current();
        },
        runJobQueueQuery: (query: string) => {
          return asyncQueryRef.current.sendQuery(query);
        },
      }),
    [
      onData,
      onStreamFinish,
      observabilityConfig.verboseLogging,
      streamRetryConfig.maxRetries,
    ]
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
    resume: resumeEnabled,
    onFinish: streamCallbacks.onFinish,
    onData: streamCallbacks.onData,
    onError: streamCallbacks.onError,
  });
  stopChatRef.current = stopChat;

  const asyncQuery = useAsyncAIQuery({
    sessionId: sessionIdRef.current,
    timeout: 120_000,
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
        const normalizedResponse = normalizeAIResponse(result.response);
        const messageWithRag = {
          id: generateMessageId('assistant'),
          role: 'assistant' as const,
          content: normalizedResponse,
          parts: [{ type: 'text' as const, text: normalizedResponse }],
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
  asyncQueryRef.current = asyncQuery;
  const isChatLoading =
    chatStatus === 'streaming' || chatStatus === 'submitted';
  const isLoading = state.isLoading || isChatLoading || asyncQuery.isLoading;
  const { executeQuery, sendQuery } = useQueryExecution({
    complexityThreshold,
    asyncQuery,
    sendMessage,
    setMessages,
    setState,
    chatStatus,
    refs: {
      errorHandled: errorHandledRef,
      currentQuery: currentQueryRef,
      pendingQuery: pendingQueryRef,
      pendingAttachments: pendingAttachmentsRef,
    },
  });
  executeQueryRef.current = executeQuery;
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
  const { stop, cancel, reset, previewComplexity } = useQueryControls({
    currentMode: state.mode,
    asyncQuery,
    stopChat,
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
      redirecting: redirectingRef,
      errorHandled: errorHandledRef,
    },
  });

  const clearError = useCallback(() => {
    retryCountRef.current = 0;
    errorHandledRef.current = false;

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      error: null,
      warning: null,
      processingTime: 0,
    }));
  }, []);
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
    clearError,
    currentMode: state.mode,
    previewComplexity,
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
  };
}

export default useHybridAIQuery;
