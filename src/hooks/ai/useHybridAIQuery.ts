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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  } = options;
  const traceIdRef = useRef<string>(generateTraceId());
  const observabilityConfig = getObservabilityConfig();
  const retryCountRef = useRef<number>(0);
  const streamRetryConfig = getStreamRetryConfig();
  const webSearchEnabledRef = useRef<boolean | undefined>(
    webSearchEnabled || undefined
  );
  useEffect(() => {
    webSearchEnabledRef.current = webSearchEnabled || undefined;
  }, [webSearchEnabled]);
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
  });
  const pendingQueryRef = useRef<string | null>(null);
  const pendingAttachmentsRef = useRef<FileAttachment[] | null>(null);
  const currentQueryRef = useRef<string | null>(null);
  const errorHandledRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    resume: resumeEnabled,
    onFinish: ({ message }) => {
      if (errorHandledRef.current) {
        logger.debug(
          '[HybridAI] onFinish skipped (error already handled by onError)'
        );
        setState((prev) => ({ ...prev, isLoading: false }));
        onStreamFinish?.();
        return;
      }
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
      onData?.(part);
    },
    onError: async (error) => {
      const errorMessage = error.message || 'Unknown error';
      logger.error(
        `[HybridAI] useChat error (trace: ${traceIdRef.current}):`,
        errorMessage
      );
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
      if (errorHandledRef.current) {
        logger.debug(
          '[HybridAI] onError skipped (already handled by onFinish)'
        );
        return;
      }
      errorHandledRef.current = true;
      const isColdStart = isColdStartRelatedError(errorMessage);
      const maxRetries = isColdStart ? 2 : streamRetryConfig.maxRetries;
      const canRetry =
        isRetryableError(errorMessage) && retryCountRef.current < maxRetries;

      if (canRetry && currentQueryRef.current) {
        retryCountRef.current += 1;
        const delay = isColdStart
          ? Math.min(10_000, 5_000 * retryCountRef.current) // 5s, 10s
          : calculateRetryDelay(retryCountRef.current - 1);

        logger.info(
          `[HybridAI] Retrying stream (${retryCountRef.current}/${maxRetries}) ` +
            `after ${delay}ms (trace: ${traceIdRef.current})`
        );

        setState((prev) => ({
          ...prev,
          warning: `재연결 중... (${retryCountRef.current}/${maxRetries})`,
        }));

        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
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
    refs: {
      errorHandled: errorHandledRef,
      currentQuery: currentQueryRef,
      pendingQuery: pendingQueryRef,
      pendingAttachments: pendingAttachmentsRef,
    },
  });
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
