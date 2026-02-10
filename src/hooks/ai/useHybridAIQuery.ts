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
 * @updated 2026-01-01 - AI SDK v6 베스트 프랙티스 적용
 *   - DefaultChatTransport 동적 헤더/바디 패턴 적용
 *   - crypto.randomUUID 기반 메시지 ID 생성
 *   - onData 콜백 지원 추가
 */

import type { UIMessage } from '@ai-sdk/react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  TRACEPARENT_HEADER,
  calculateRetryDelay,
  generateTraceparent,
  generateTraceId,
  getComplexityThreshold,
  getObservabilityConfig,
  getStreamRetryConfig,
  isRetryableError,
} from '@/config/ai-proxy.config';
import { generateClarification } from '@/lib/ai/clarification-generator';
import { classifyQuery } from '@/lib/ai/query-classifier';
import {
  analyzeQueryComplexity,
  shouldForceJobQueue,
} from '@/lib/ai/utils/query-complexity';
import { logger } from '@/lib/logging';
import { useClarificationHandlers } from './core/useClarificationHandlers';
import { useAsyncAIQuery } from './useAsyncAIQuery';
import {
  generateMessageId,
  sanitizeMessages,
} from './utils/hybrid-query-utils';

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
// Import for local use and re-export for backward compatibility
import {
  COLD_START_ERROR_PATTERNS as _COLD_START_ERROR_PATTERNS,
  STREAM_ERROR_MARKER as _STREAM_ERROR_MARKER,
  STREAM_ERROR_REGEX as _STREAM_ERROR_REGEX,
  extractStreamError,
  isColdStartRelatedError,
} from '@/lib/ai/constants/stream-errors';
import type { QueryComplexity } from '@/lib/ai/utils/query-complexity';
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
  _STREAM_ERROR_MARKER as STREAM_ERROR_MARKER,
  _COLD_START_ERROR_PATTERNS as COLD_START_ERROR_PATTERNS,
  _STREAM_ERROR_REGEX as STREAM_ERROR_REGEX,
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
    // 🎯 Real-time streaming endpoint (2026-01-09)
    // Cloud Run SSE streaming → Vercel proxy → Frontend
    apiEndpoint: customEndpoint,
    // 🎯 P0 Fix: Use config value as default instead of hardcoded magic number
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
  // v2 uses AI SDK native UIMessageStream protocol with resumable streams
  const apiEndpoint = customEndpoint ?? '/api/ai/supervisor/stream/v2';

  // Session ID with stable initial value
  const sessionIdRef = useRef<string>(
    initialSessionId || generateMessageId('session')
  );

  // State
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

  // 🎯 파일 첨부 저장 (명확화 플로우에서 사용)
  const pendingAttachmentsRef = useRef<FileAttachment[] | null>(null);

  // Redirect 이벤트 처리를 위한 쿼리 저장
  const currentQueryRef = useRef<string | null>(null);

  // 🔒 Error Race Condition 방지: onError/onFinish 중 먼저 처리된 쪽이 에러 핸들링
  const errorHandledRef = useRef<boolean>(false);

  // 🎯 AbortController for graceful request cancellation (Phase 2 개선)
  // Vercel 10s timeout 대응: 8초 내부 timeout + graceful abort
  const abortControllerRef = useRef<AbortController | null>(null);
  // Retry setTimeout ID for cleanup on unmount
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ============================================================================
  // useChat Hook (Streaming Mode) - AI SDK v6 베스트 프랙티스 적용
  // ============================================================================
  // Transport: DefaultChatTransport with AI SDK native UIMessageStream protocol
  // Features: Resumable streams, structured data events, automatic reconnection
  //
  // 🎯 Real-time streaming enabled (2026-01-09)
  // 🌊 Native protocol support (2026-01-24)
  // @see https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
  // v2 only: AI SDK native UIMessageStream with resumable stream support
  // 🎯 Best Practice: prepareReconnectToStreamRequest로 resume URL 커스터마이징
  // AI SDK 기본 패턴 {api}/{id}/stream 대신 query parameter 방식 사용
  // @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiEndpoint,
        // W3C Trace Context: 매 요청마다 새 traceparent 생성하여 end-to-end 추적
        // traceIdRef의 UUID를 trace-id로 사용, 요청마다 새 parent-id 생성
        headers: () => ({
          [TRACEPARENT_HEADER]: generateTraceparent(traceIdRef.current),
          [observabilityConfig.traceIdHeader]: traceIdRef.current,
        }),
        // Resolvable<object> 함수: sendMessages() 호출 시점에 최신 webSearchEnabled 반환
        // ChatStore.transport가 readonly이므로 정적 값 대신 함수로 전달해야
        // 토글 변경이 실시간 반영됨
        body: () => ({ enableWebSearch: webSearchEnabledRef.current }),
        // Resume stream URL customization (fixes 404 error)
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
    // AI SDK v6: Session ID for resumable streams
    id: sessionIdRef.current,
    transport,
    // 🚫 resume 비활성화: 명확화 흐름에서 "Cannot read properties of undefined (reading 'text')" 에러 발생
    // AI SDK 내부에서 이전 세션 메시지 복원 시 parts 배열 처리 문제로 추정
    // TODO: AI SDK 업데이트 후 재활성화 테스트 필요
    // @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams
    resume: false,
    onFinish: ({ message }) => {
      // 🔒 Race Condition 방지: onError가 이미 에러를 처리했으면 스킵
      // Note: errorHandledRef는 executeQuery에서 새 요청 시작 시 리셋됨
      if (errorHandledRef.current) {
        logger.debug(
          '[HybridAI] onFinish skipped (error already handled by onError)'
        );
        setState((prev) => ({ ...prev, isLoading: false }));
        onStreamFinish?.();
        return;
      }

      // 🚨 스트림 완료 후 에러 패턴 감지 (Cold Start 등)
      // AI SDK v6: message.parts 배열에서 텍스트 추출 (null/undefined 방어 코드)
      const parts = message.parts ?? [];
      const content = parts
        .filter(
          (p): p is { type: 'text'; text: string } =>
            p != null && p.type === 'text'
        )
        .map((p) => p.text)
        .join('');

      // 🎯 개선된 에러 추출 (false positive 방지)
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
        // 🎯 P1: Reset retry count on successful completion
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
    // AI SDK v6: 실시간 데이터 파트 처리 콜백 + Redirect/Warning 이벤트 내부 처리
    onData: (dataPart) => {
      const part = dataPart as StreamDataPart;

      // Warning 이벤트 처리 (처리 지연 또는 스트림 에러 경고)
      // 🎯 CODEX Review Fix: SLOW_PROCESSING과 STREAM_ERROR_OCCURRED 분기 처리
      // AI SDK v6: custom data parts는 'data-' prefix 포함
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
          // STREAM_ERROR_OCCURRED - elapsed 필드 없음
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

        // Job Queue 모드로 전환
        setState((prev) => ({
          ...prev,
          mode: 'job-queue',
          complexity: redirectData.complexity,
          isLoading: true,
        }));

        // 현재 스트리밍 중단
        stopChat();

        // 🎯 Phase 2 개선: AbortController 패턴으로 race condition 방지
        // setTimeout(50ms) 대신 queueMicrotask 사용하여 stopChat 완료 후 실행 보장
        // AbortController로 컴포넌트 언마운트 시 안전한 취소 지원
        const query = currentQueryRef.current;
        if (query) {
          // 기존 abort controller가 있으면 취소
          abortControllerRef.current?.abort();
          const controller = new AbortController();
          abortControllerRef.current = controller;

          // 🎯 P0 Fix: Capture current references before microtask to avoid stale closure
          const currentAsyncQuery = asyncQuery;
          const currentQuery = query;

          // queueMicrotask: stopChat의 현재 실행 컨텍스트 완료 후 실행
          queueMicrotask(() => {
            // 이미 취소되었으면 스킵 (컴포넌트 언마운트 등)
            if (controller.signal.aborted) {
              logger.debug('[HybridAI] Job Queue redirect aborted');
              return;
            }
            // 🎯 P0 Fix: Removed stale jobId reference - asyncQuery manages its own jobId state
            // 🎯 P1 Fix: Add catch handler for unhandled promise rejection
            currentAsyncQuery
              .sendQuery(currentQuery)
              .then(() => {
                // Note: jobId is managed internally by useAsyncAIQuery
                // Access via asyncQuery.jobId (not currentAsyncQuery which is stale)
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

      // 🎯 P1-4 Fix: Atomic check-and-set pattern to prevent double handling
      // Check FIRST, then set immediately to prevent race with onFinish
      if (errorHandledRef.current) {
        logger.debug(
          '[HybridAI] onError skipped (already handled by onFinish)'
        );
        return;
      }
      errorHandledRef.current = true; // Set immediately after check (atomic pattern)

      // 🎯 P1: Streaming retry with exponential backoff
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

        // Show retry warning to user
        setState((prev) => ({
          ...prev,
          warning: `재연결 중... (${retryCountRef.current}/${streamRetryConfig.maxRetries})`,
        }));

        // Wait and retry (with cleanup support)
        retryTimeoutRef.current = setTimeout(() => {
          retryTimeoutRef.current = null;
          errorHandledRef.current = false; // Reset for retry
          const query = currentQueryRef.current;
          const attachments = pendingAttachmentsRef.current;
          if (query) {
            // Re-execute with isRetry=true to skip clarification
            executeQuery(query, attachments || undefined, true);
          }
        }, delay);

        return;
      }

      // 🎯 Reset retry count on final failure
      retryCountRef.current = 0;

      // 복구 실패 시 기존 에러 처리
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

      // Job 결과를 메시지로 변환하여 추가
      // crypto.randomUUID 기반 ID로 충돌 방지
      if (result.success && result.response) {
        // 메시지에 추가 (assistant 메시지로, ragSources 포함)
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

  // ============================================================================
  // Computed Values
  // ============================================================================
  const isChatLoading =
    chatStatus === 'streaming' || chatStatus === 'submitted';
  const isLoading = state.isLoading || isChatLoading || asyncQuery.isLoading;

  // ============================================================================
  // Send Query (Auto Routing)
  // ============================================================================

  /**
   * 실제 쿼리 전송 로직 (명확화 완료 후 호출)
   * @param query - 텍스트 쿼리
   * @param attachments - 선택적 파일 첨부 (이미지, PDF, MD)
   */
  const executeQuery = useCallback(
    (query: string, attachments?: FileAttachment[], isRetry = false) => {
      // 빈 쿼리 방어
      if (!query || !query.trim()) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          logger.warn('[HybridAI] executeQuery: Empty query, skipping');
        }
        return;
      }

      const trimmedQuery = query.trim();

      // 🔒 새 요청 시작 시 에러 핸들링 플래그 리셋 (Codex review feedback)
      errorHandledRef.current = false;

      // Redirect 이벤트 처리를 위해 현재 쿼리 저장
      currentQueryRef.current = trimmedQuery;

      // 1. 복잡도 분석 + 의도 기반 Job Queue 강제 라우팅
      const analysis = analyzeQueryComplexity(trimmedQuery);
      const forceJobQueue = shouldForceJobQueue(trimmedQuery);
      // 🎯 파일 첨부 시 Vision Agent가 필요하므로 스트리밍 모드 선호
      const hasAttachments = attachments && attachments.length > 0;
      const isComplex =
        !hasAttachments &&
        (analysis.score > complexityThreshold || forceJobQueue.force);

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        logger.info(
          `[HybridAI] Query complexity: ${analysis.level} (score: ${analysis.score}), ` +
            `Force Job Queue: ${forceJobQueue.force}${forceJobQueue.matchedKeyword ? ` (keyword: "${forceJobQueue.matchedKeyword}")` : ''}, ` +
            `Attachments: ${hasAttachments ? attachments!.length : 0}, ` +
            `Mode: ${isComplex ? 'job-queue' : 'streaming'}`
        );
      }

      // 🎯 AI SDK v6 sendMessage: { text, files } 형식 사용
      // FileUIPart = { type: 'file', mediaType, url (data URL), filename? }
      // @see https://ai-sdk.dev/docs/ai-sdk-ui/chatbot#files
      type FileUIPart = {
        type: 'file';
        mediaType: string;
        url: string;
        filename?: string;
      };

      // 파일 첨부를 FileUIPart[]로 변환
      const fileUIParts: FileUIPart[] = hasAttachments
        ? attachments!.map((att) => ({
            type: 'file' as const,
            mediaType: att.mimeType,
            url: att.data, // data URL 형식 (base64)
            filename: att.name,
          }))
        : [];

      // 사용자 메시지 생성 (UI 표시용) - 텍스트만 포함
      // isRetry=true일 때는 이미 메시지 목록에 있으므로 생성 건너뛰기
      const userMessage: UIMessage | null = isRetry
        ? null
        : {
            id: generateMessageId('user'),
            role: 'user' as const,
            parts: [{ type: 'text' as const, text: trimmedQuery }],
          };

      // 2. 모드별 처리
      if (isComplex) {
        // Job Queue 모드: 긴 작업, 진행률 표시
        if (userMessage) {
          setMessages((prev) => [...prev, userMessage]);
        }

        setState((prev) => ({
          ...prev,
          mode: 'job-queue',
          complexity: analysis.level,
          progress: null,
          jobId: null,
          isLoading: true,
          error: null,
          clarification: null,
        }));

        // 🎯 P1 Fix: Add catch handler for unhandled promise rejection
        // 🎯 Stale Closure Fix: Use returned jobId instead of asyncQuery.jobId
        asyncQuery
          .sendQuery(trimmedQuery)
          .then((result) => {
            setState((prev) => ({ ...prev, jobId: result.jobId ?? null }));
          })
          .catch((error) => {
            logger.error('[HybridAI] Job Queue query failed:', error);
            setState((prev) => ({
              ...prev,
              isLoading: false,
              error:
                error instanceof Error ? error.message : 'Job Queue 쿼리 실패',
            }));
          });
      } else {
        // Streaming 모드: 빠른 응답
        // Note: sendMessage(AI SDK)가 자동으로 user 메시지를 추가하므로
        //       수동으로 setMessages 하지 않음 (중복 방지)
        setState((prev) => ({
          ...prev,
          mode: 'streaming',
          complexity: analysis.level,
          progress: null,
          jobId: null,
          isLoading: true,
          error: null,
          clarification: null,
        }));

        // 🛡️ Pre-sanitize: sendMessage 호출 전에 기존 messages를 sanitize
        // flushSync로 동기적 상태 업데이트 보장 후 sendMessage 호출
        // 🎯 Fix: "Cannot read properties of undefined (reading 'text')" 에러 방지
        flushSync(() => {
          setMessages((prev) => {
            let cleaned = sanitizeMessages(prev);
            // 🎯 Retry Fix: 재시도 시 이전 실패한 user+assistant 메시지 제거
            // sendMessage가 자동으로 새 user 메시지를 추가하므로 중복 방지
            if (isRetry && cleaned.length >= 1) {
              // 마지막 메시지부터 역순으로 탐색하여 마지막 user 메시지와 이후 assistant 메시지 제거
              let lastUserIdx = -1;
              for (let i = cleaned.length - 1; i >= 0; i--) {
                if (cleaned[i]?.role === 'user') {
                  lastUserIdx = i;
                  break;
                }
              }
              if (lastUserIdx !== -1) {
                cleaned = cleaned.slice(0, lastUserIdx);
              }
            }
            return cleaned;
          });
        });

        // 🎯 AI SDK v6: sendMessage({ text, files? }) 형식
        // 파일 첨부 시 files 배열로 전달 (FileUIPart[])
        // @see node_modules/ai/dist/index.d.ts line 3314-3328
        const messagePayload = hasAttachments
          ? { text: trimmedQuery, files: fileUIParts }
          : { text: trimmedQuery };

        Promise.resolve(
          sendMessage(messagePayload as Parameters<typeof sendMessage>[0])
        ).catch((error) => {
          logger.error('[HybridAI] Streaming send failed:', error);
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error:
              error instanceof Error ? error.message : '스트리밍 전송 실패',
          }));
        });
      }
    },
    [complexityThreshold, asyncQuery, sendMessage, setMessages]
  );

  const sendQuery = useCallback(
    async (query: string, attachments?: FileAttachment[]) => {
      if (!query.trim()) return;

      // 원본 쿼리 및 첨부 파일 저장 (명확화 플로우에서 사용)
      pendingQueryRef.current = query;
      pendingAttachmentsRef.current = attachments || null;

      // 0. 초기화
      setState((prev) => ({ ...prev, error: null }));

      try {
        // 🎯 파일 첨부가 있으면 명확화 스킵 (Vision Agent 직접 호출)
        if (attachments && attachments.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            logger.info(
              `[HybridAI] Skipping clarification: ${attachments.length} attachment(s) detected`
            );
          }
          executeQuery(query, attachments);
          return;
        }

        // 1. 쿼리 분류 (Groq LLM 사용)
        const classification = await classifyQuery(query);

        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          logger.info(
            `[HybridAI] Classification: intent=${classification.intent}, complexity=${classification.complexity}, confidence=${classification.confidence}%`
          );
        }

        // 2. 명확화 필요 여부 체크
        const clarificationRequest = generateClarification(
          query,
          classification
        );

        if (clarificationRequest) {
          setState((prev) => ({
            ...prev,
            clarification: clarificationRequest,
          }));
          return;
        }

        // 3. 명확화 불필요: 바로 실행
        executeQuery(query, attachments);
      } catch (error) {
        logger.error('[HybridAI] sendQuery error:', error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : '쿼리 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        }));
      }
    },
    [executeQuery]
  );

  // ============================================================================
  // Clarification Functions (extracted to core/useClarificationHandlers.ts)
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
  // Control Functions
  // ============================================================================
  const stop = useCallback(() => {
    // 🎯 Phase 2: AbortController cleanup on stop
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (state.mode === 'streaming') {
      stopChat();
    }
    setState((prev) => ({ ...prev, isLoading: false }));
  }, [state.mode, stopChat]);

  const cancel = useCallback(async () => {
    if (state.mode === 'job-queue') {
      await asyncQuery.cancel();
    } else {
      stopChat();
    }
    setState((prev) => ({ ...prev, isLoading: false }));
  }, [state.mode, asyncQuery, stopChat]);

  const reset = useCallback(() => {
    // 🎯 Phase 2: AbortController cleanup on reset
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // 🎯 P1: Reset retry count and generate new trace ID
    retryCountRef.current = 0;
    traceIdRef.current = generateTraceId();

    asyncQuery.reset();
    setMessages([]);
    pendingQueryRef.current = null;
    pendingAttachmentsRef.current = null; // 🎯 P0 Fix: 첨부 파일 참조 정리
    currentQueryRef.current = null;
    setState({
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
  }, [asyncQuery, setMessages]);

  // ============================================================================
  // Utility: Preview Complexity
  // ============================================================================
  const previewComplexity = useCallback((query: string): QueryComplexity => {
    return analyzeQueryComplexity(query).level;
  }, []);

  // ============================================================================
  // Cleanup on Unmount (Phase 2 개선)
  // ============================================================================
  useEffect(() => {
    return () => {
      // 🎯 AbortController cleanup on unmount
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      // 🎯 Retry timeout cleanup on unmount
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
