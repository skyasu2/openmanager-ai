/**
 * useHybridAIQuery Hook
 *
 * @description 쿼리 복잡도에 따라 자동으로 최적의 방식을 선택하는 하이브리드 AI 쿼리 훅
 *
 * 라우팅 전략:
 * - 복잡도 점수(score)가 complexityThreshold(기본값: 19)를 초과하면 Job Queue, 이하면 Streaming
 * - 레벨 라벨(simple ≤20 / moderate 21-45 / complex >45)은 복잡도 기술자일 뿐,
 *   라우팅 기준값이 아님. 실제 전환 기준은 getComplexityThreshold() 반환값.
 * - forceJobQueueKeywords(보고서·리포트·근본 원인 등) 매칭 시 점수 무관하게 Job Queue 강제
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
 * @updated 2026-05-19 - Split async result message helpers (704 → 523 lines)
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
import {
  buildAssistantMessageFromAsyncResult,
  mergeFinishedAssistantIntoMessages,
} from './core/async-result-message';
import { createHybridChatTransport } from './core/createHybridChatTransport';
import { createHybridStreamCallbacks } from './core/createHybridStreamCallbacks';
import { buildSourceToolRequestOptions } from './core/source-tool-request-options';
import { useClarificationHandlers } from './core/useClarificationHandlers';
import { useQueryControls } from './core/useQueryControls';
import { useQueryExecution } from './core/useQueryExecution';
import { useAsyncAIQuery } from './useAsyncAIQuery';
import { generateMessageId } from './utils/hybrid-query-utils';

export type {
  AgentStatus,
  AgentStatusEventData,
  AgentStepEventData,
  AgentStepStatus,
  AIStreamStatus,
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
import type { SemanticIntentFrame } from '@/lib/ai/entity-extractor';
import {
  type AIRateLimitErrorDetails,
  inferAIErrorDetailsFromMessage,
} from '@/lib/ai/error-details';
import type { RouteDecision } from '@/lib/ai/route-decision';
import {
  buildSemanticIntentRequestMetadata,
  type SemanticPreprocessingMetadata,
} from '@/lib/ai/semantic-intent-frame';
import type { AnalysisMode } from '@/types/ai/analysis-mode';
import type { JobDataSlot } from '@/types/ai-jobs';
import type {
  AIStreamStatus,
  HybridQueryState,
  UseHybridAIQueryOptions,
  UseHybridAIQueryReturn,
} from './types/hybrid-query.types';
import type { FileAttachment } from './useFileAttachments';

export {
  buildAssistantMessageFromAsyncResult,
  COLD_START_ERROR_PATTERNS,
  extractStreamError,
  isColdStartRelatedError,
  mergeFinishedAssistantIntoMessages,
  STREAM_ERROR_MARKER,
  STREAM_ERROR_REGEX,
};

const DEFAULT_AI_STREAM_ENDPOINT = '/api/ai/supervisor/stream/v2';

function normalizeStreamStatus(status: string): AIStreamStatus {
  if (
    status === 'submitted' ||
    status === 'streaming' ||
    status === 'ready' ||
    status === 'error'
  ) {
    return status;
  }
  return 'ready';
}

function resolveRateLimitUntilMs(
  details: AIRateLimitErrorDetails
): number | null {
  const now = Date.now();
  const retryAfterMs =
    typeof details.retryAfterSeconds === 'number' &&
    details.retryAfterSeconds > 0
      ? now + details.retryAfterSeconds * 1000
      : null;
  const resetAtMs =
    typeof details.resetAt === 'number' && details.resetAt > 0
      ? details.resetAt * 1000
      : null;
  const candidates = [retryAfterMs, resetAtMs].filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value > now
  );

  if (candidates.length === 0) {
    return null;
  }

  return Math.max(...candidates);
}

export function useHybridAIQuery(
  options: UseHybridAIQueryOptions = {}
): UseHybridAIQueryReturn {
  const {
    sessionId: initialSessionId,
    apiEndpoint: customEndpoint,
    complexityThreshold = getComplexityThreshold(),
    onStreamFinish,
    onStreamMessageFinish,
    onJobResult,
    onProgress,
    onData,
    webSearchEnabled,
    ragEnabled,
    analysisMode,
    queryAsOfDataSlot,
  } = options;
  const traceIdRef = useRef<string>(generateTraceId());
  const observabilityConfig = getObservabilityConfig();
  const retryCountRef = useRef<number>(0);
  const streamRetryConfig = getStreamRetryConfig();
  const webSearchEnabledRef = useRef<boolean | undefined>(
    webSearchEnabled ?? undefined
  );
  const ragEnabledRef = useRef<boolean | undefined>(ragEnabled ?? undefined);
  const analysisModeRef = useRef<AnalysisMode | undefined>(
    analysisMode ?? undefined
  );
  const queryAsOfDataSlotRef = useRef<JobDataSlot | undefined>(
    queryAsOfDataSlot
  );
  const currentRouteDecisionRef = useRef<RouteDecision | undefined>(undefined);
  const semanticIntentFrameRef = useRef<SemanticIntentFrame | undefined>(
    undefined
  );
  const semanticPreprocessingRef = useRef<
    SemanticPreprocessingMetadata | undefined
  >(undefined);
  const warmingUpRef = useRef<boolean>(false);
  useEffect(() => {
    webSearchEnabledRef.current = webSearchEnabled ?? undefined;
  }, [webSearchEnabled]);
  useEffect(() => {
    ragEnabledRef.current = ragEnabled ?? undefined;
  }, [ragEnabled]);
  useEffect(() => {
    analysisModeRef.current = analysisMode ?? undefined;
  }, [analysisMode]);
  useEffect(() => {
    queryAsOfDataSlotRef.current = queryAsOfDataSlot;
  }, [queryAsOfDataSlot]);
  const apiEndpoint = customEndpoint ?? DEFAULT_AI_STREAM_ENDPOINT;
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
    errorDetails: null,
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
  const rateLimitBlockRef = useRef<{
    details: AIRateLimitErrorDetails;
    untilMs: number;
  } | null>(null);
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
        webSearchEnabledRef,
        ragEnabledRef,
        analysisModeRef,
        queryAsOfDataSlotRef,
        localRouteDecisionRef: currentRouteDecisionRef,
        currentQueryRef,
        semanticIntentFrameRef,
        semanticPreprocessingRef,
      }),
    [apiEndpoint, observabilityConfig.traceIdHeader]
  );
  const asyncQueryRef = useRef<ReturnType<typeof useAsyncAIQuery>>(null!);
  const persistFinishedAssistantMessageRef = useRef(
    (_message: UIMessage, _traceId: string) => {}
  );
  const streamCallbacks = useMemo(
    () =>
      createHybridStreamCallbacks({
        traceIdRef,
        verboseLogging: observabilityConfig.verboseLogging,
        maxRetries: streamRetryConfig.maxRetries,
        onStreamFinish,
        onStreamMessageFinish,
        onData,
        persistFinishedAssistantMessage: (message, traceId) =>
          persistFinishedAssistantMessageRef.current(message, traceId),
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
          const semanticIntentPayload = buildSemanticIntentRequestMetadata({
            frame: semanticIntentFrameRef.current,
            originalQuery: query,
            preprocessing: semanticPreprocessingRef.current,
          });
          const jobQueueOptions = {
            ...(analysisModeRef.current && {
              analysisMode: analysisModeRef.current,
            }),
            ...(queryAsOfDataSlotRef.current && {
              queryAsOfDataSlot: queryAsOfDataSlotRef.current,
            }),
            ...buildSourceToolRequestOptions({
              webSearchEnabled: webSearchEnabledRef.current,
              ragEnabled: ragEnabledRef.current,
            }),
            ...(semanticIntentPayload.metadata?.intentFrame && {
              intentFrame: semanticIntentPayload.metadata.intentFrame,
            }),
            ...(semanticIntentPayload.semanticQueryTrace && {
              semanticQueryTrace: semanticIntentPayload.semanticQueryTrace,
            }),
          };

          return asyncQueryRef.current.sendQuery(
            query,
            Object.keys(jobQueueOptions).length > 0
              ? jobQueueOptions
              : undefined
          );
        },
      }),
    [
      onData,
      onStreamMessageFinish,
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
    experimental_throttle: 50,
    onFinish: streamCallbacks.onFinish,
    onData: streamCallbacks.onData,
    onError: streamCallbacks.onError,
  });
  stopChatRef.current = stopChat;
  const messagesRef = useRef<UIMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  persistFinishedAssistantMessageRef.current = (
    message: UIMessage,
    traceId: string
  ) => {
    setMessages((prev: UIMessage[]) =>
      mergeFinishedAssistantIntoMessages(prev, message, traceId)
    );
  };

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
        errorDetails: null,
        clarification: null,
      }));
      onJobResult?.(result);

      if (result.success && result.response) {
        const messageWithRag = buildAssistantMessageFromAsyncResult(result);
        setMessages((prev) => [...prev, messageWithRag]);
      }
    },
    onError: (error, errorDetails) => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error,
        errorDetails:
          errorDetails ?? inferAIErrorDetailsFromMessage(error) ?? null,
        clarification: null,
      }));
    },
  });
  asyncQueryRef.current = asyncQuery;
  const isChatLoading =
    chatStatus === 'streaming' || chatStatus === 'submitted';
  const streamStatus = normalizeStreamStatus(chatStatus);
  const isLoading = state.isLoading || isChatLoading || asyncQuery.isLoading;
  useEffect(() => {
    if (state.errorDetails?.kind !== 'rate-limit') {
      return;
    }

    const untilMs = resolveRateLimitUntilMs(state.errorDetails);
    if (!untilMs) {
      return;
    }

    rateLimitBlockRef.current = {
      details: state.errorDetails,
      untilMs,
    };
  }, [state.errorDetails]);
  const { executeQuery, sendQuery } = useQueryExecution({
    complexityThreshold,
    asyncQuery,
    sendMessage,
    onBeforeStreamingSend: (isRetry) => {
      if (!isRetry) {
        traceIdRef.current = generateTraceId();
      }
    },
    getMessages: () => messagesRef.current,
    setMessages,
    setState,
    onRouteDecision: (decision) => {
      currentRouteDecisionRef.current = decision;
    },
    chatStatus,
    refs: {
      errorHandled: errorHandledRef,
      currentQuery: currentQueryRef,
      pendingQuery: pendingQueryRef,
      pendingAttachments: pendingAttachmentsRef,
      rateLimitBlock: rateLimitBlockRef,
      semanticIntentFrame: semanticIntentFrameRef,
      semanticPreprocessing: semanticPreprocessingRef,
    },
    analysisMode,
    ragEnabled,
    webSearchEnabled,
    queryAsOfDataSlot,
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
      errorDetails: null,
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
    streamStatus,
    previewComplexity,
    selectClarification,
    submitCustomClarification,
    skipClarification,
    dismissClarification,
  };
}
