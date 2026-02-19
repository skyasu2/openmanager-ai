/**
 * useAsyncAIQuery Hook
 *
 * Provides async AI query functionality with real-time progress updates.
 * Uses Job Queue + SSE for long-running queries to avoid Vercel timeout.
 *
 * Flow:
 * 1. Create job via POST /api/ai/jobs
 * 2. Connect to SSE stream: /api/ai/jobs/:id/stream
 * 3. Receive real-time progress updates
 * 4. Get final result when completed
 *
 * @example
 * ```tsx
 * const { sendQuery, progress, result, error, isLoading, cancel } = useAsyncAIQuery();
 *
 * const handleSubmit = async () => {
 *   const response = await sendQuery('서버 상태를 분석해주세요');
 *   if (response.success) {
 *     logger.info('Result:', response.data);
 *   }
 * };
 * ```
 *
 * @version 1.0.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { extractStreamError } from '@/lib/ai/constants/stream-errors';
import { logger } from '@/lib/logging';
import {
  calculateBackoff,
  fetchWithRetry,
  RETRY_STANDARD,
} from '@/lib/utils/retry';

// ============================================================================
// Types
// ============================================================================

export interface AsyncQueryProgress {
  stage: string;
  progress: number; // 0-100
  message?: string;
  elapsedMs?: number;
}

export interface AsyncQueryResult {
  success: boolean;
  response?: string;
  targetAgent?: string;
  toolResults?: unknown[];
  ragSources?: Array<{
    title: string;
    similarity: number;
    sourceType: string;
    category?: string;
  }>;
  processingTimeMs?: number;
  error?: string;
  /** Langfuse trace ID for feedback scoring */
  traceId?: string;
  /** Job ID (Stale Closure 방지용) */
  jobId?: string;
}

export interface AsyncQueryState {
  isLoading: boolean;
  isConnected: boolean;
  progress: AsyncQueryProgress | null;
  result: AsyncQueryResult | null;
  error: string | null;
  jobId: string | null;
}

export interface UseAsyncAIQueryOptions {
  /** Session ID for conversation context */
  sessionId?: string;
  /** Timeout in milliseconds (default: 15000) */
  timeout?: number;
  /** Callback when progress updates */
  onProgress?: (progress: AsyncQueryProgress) => void;
  /** Callback when result is received */
  onResult?: (result: AsyncQueryResult) => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAsyncAIQuery(options: UseAsyncAIQueryOptions = {}) {
  const { sessionId, timeout = 15000, onProgress, onResult, onError } = options;

  // State
  const [state, setState] = useState<AsyncQueryState>({
    isLoading: false,
    isConnected: false,
    progress: null,
    result: null,
    error: null,
    jobId: null,
  });

  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 🎯 P1 Fix: AbortController for fetch cancellation on unmount/cancel
  const abortControllerRef = useRef<AbortController | null>(null);

  // 🎯 P0 Fix: Store listener references for explicit removal
  // Changed from Map to Array to prevent overwrite issues with duplicate event types
  const listenersRef = useRef<
    Array<{ eventType: string; handler: EventListener }>
  >([]);

  // 🎯 P1-5 Fix: Cleanup function defined before useEffect to avoid stale closure
  const cleanupRef = useRef<() => void>(() => {});

  // Cleanup function
  const cleanup = useCallback(() => {
    // 🎯 P1 Fix: Abort any pending fetch requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // 🎯 P0 Fix: Explicitly remove all listeners before closing (Array version)
    if (eventSourceRef.current) {
      for (const { eventType, handler } of listenersRef.current) {
        eventSourceRef.current.removeEventListener(eventType, handler);
      }
      listenersRef.current = [];
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // 🎯 P1-5 Fix: Keep cleanupRef updated with latest cleanup function
  cleanupRef.current = cleanup;

  // 🎯 P1-5 Fix: Cleanup on unmount to prevent EventSource memory leak
  // Uses ref to avoid stale closure issues with useCallback dependencies
  useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, []);

  // Cancel current query
  const cancel = useCallback(async () => {
    cleanup();

    if (state.jobId) {
      try {
        await fetch(`/api/ai/jobs/${state.jobId}`, { method: 'DELETE' });
      } catch (e) {
        logger.warn('[AsyncAI] Failed to cancel job:', e);
      }
    }

    setState((prev) => ({
      ...prev,
      isLoading: false,
      isConnected: false,
      error: 'Cancelled by user',
    }));
  }, [state.jobId, cleanup]);

  // Send query
  const sendQuery = useCallback(
    async (query: string): Promise<AsyncQueryResult> => {
      // Cleanup previous state
      cleanup();
      setState({
        isLoading: true,
        isConnected: false,
        progress: null,
        result: null,
        error: null,
        jobId: null,
      });

      return new Promise((resolve) => {
        // 🎯 Store jobId for closure access (Stale Closure 방지)
        let capturedJobId: string | null = null;

        const handleError = (error: string) => {
          cleanup();
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isConnected: false,
            error,
            progress: null, // 🎯 P2 Fix: Clear progress on error to avoid "80% complete... ERROR" UX
          }));
          onError?.(error);
          resolve({ success: false, error, jobId: capturedJobId ?? undefined });
        };

        const handleResult = (result: AsyncQueryResult) => {
          cleanup();
          // 🎯 Include jobId in result for Stale Closure prevention
          const resultWithJobId = {
            ...result,
            jobId: capturedJobId ?? undefined,
          };
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isConnected: false,
            result: resultWithJobId,
          }));
          onResult?.(resultWithJobId);
          resolve(resultWithJobId);
        };

        // SSE 재연결 로직
        const connectSSE = (jobId: string, reconnectAttempt = 0) => {
          const maxReconnects = 3;

          // 🎯 P0 Fix: 기존 리스너 제거 후 EventSource 닫기 (Array version)
          if (eventSourceRef.current) {
            for (const { eventType, handler } of listenersRef.current) {
              eventSourceRef.current.removeEventListener(eventType, handler);
            }
            listenersRef.current = [];
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }

          const eventSource = new EventSource(`/api/ai/jobs/${jobId}/stream`);
          eventSourceRef.current = eventSource;

          // 🎯 P0 Fix: Helper to add and track listeners (Array version)
          const addTrackedListener = (
            eventType: string,
            handler: EventListener
          ) => {
            eventSource.addEventListener(eventType, handler);
            listenersRef.current.push({ eventType, handler });
          };

          // Handle connection
          addTrackedListener('connected', () => {
            setState((prev) => ({ ...prev, isConnected: true }));
            // 재연결 성공 시 attempt 리셋
            if (reconnectAttempt > 0) {
              logger.info(
                `[AsyncAI] SSE reconnected after ${reconnectAttempt} attempts`
              );
            }
          });

          // Handle progress updates
          addTrackedListener('progress', ((event: MessageEvent) => {
            try {
              const progress = JSON.parse(event.data) as AsyncQueryProgress;
              setState((prev) => ({ ...prev, progress }));
              onProgress?.(progress);
            } catch (e) {
              logger.warn('[AsyncAI] Failed to parse progress:', e);
            }
          }) as EventListener);

          // Handle result
          addTrackedListener('result', ((event: MessageEvent) => {
            try {
              const resultData = JSON.parse(event.data);
              if (!resultData || typeof resultData !== 'object') {
                throw new Error('Invalid result data structure');
              }

              // 🎯 응답 내용에서 스트림 에러 패턴 확인 (일관성 유지)
              const errorInResponse = extractStreamError(
                resultData.response || ''
              );
              if (errorInResponse) {
                logger.warn(
                  `[AsyncAI] Stream error in result: ${errorInResponse}`
                );
                handleError(errorInResponse);
                return;
              }

              handleResult({
                success: true,
                response: resultData.response,
                targetAgent: resultData.targetAgent,
                toolResults: resultData.toolResults,
                ragSources: resultData.ragSources,
                processingTimeMs: resultData.processingTimeMs,
                traceId: resultData.metadata?.traceId,
              });
            } catch (e) {
              handleError(`Failed to parse result: ${e}`);
            }
          }) as EventListener);

          // Handle error from stream with reconnection
          addTrackedListener('error', ((event: Event) => {
            if (eventSource.readyState === EventSource.CLOSED) {
              return; // 정상 종료
            }

            // 에러 데이터 확인
            const messageEvent = event as MessageEvent;
            if (messageEvent.data) {
              try {
                const errorData = JSON.parse(messageEvent.data);
                handleError(errorData.error || 'Stream error');
                return;
              } catch {
                // 파싱 실패 - 연결 오류로 처리
              }
            }

            // 🎯 P0 Fix: 리스너 제거 후 연결 닫기 (Array version)
            for (const { eventType: et, handler: h } of listenersRef.current) {
              eventSourceRef.current?.removeEventListener(et, h);
            }
            listenersRef.current = [];
            eventSource.close();
            eventSourceRef.current = null;

            if (reconnectAttempt < maxReconnects) {
              const delay = calculateBackoff(
                reconnectAttempt,
                1000,
                10000,
                0.1
              );
              logger.info(
                `[AsyncAI] SSE disconnected, reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1}/${maxReconnects})`
              );

              setState((prev) => ({
                ...prev,
                isConnected: false,
                progress: {
                  stage: 'reconnecting',
                  progress: prev.progress?.progress ?? 0,
                  message: `재연결 중... (${reconnectAttempt + 1}/${maxReconnects})`,
                },
              }));

              // 🎯 P1-1 Fix: Store reconnection timer in ref for cleanup
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
              }
              timeoutRef.current = setTimeout(() => {
                // Skip if already cleaned up (component unmounted)
                if (
                  eventSourceRef.current === null &&
                  timeoutRef.current === null
                ) {
                  return;
                }
                // 🎯 P0 Fix: Wrap recursive call in try-catch for safety
                try {
                  connectSSE(jobId, reconnectAttempt + 1);
                } catch (err) {
                  logger.error('[AsyncAI] Reconnection failed:', err);
                  handleError('재연결에 실패했습니다.');
                }
              }, delay);
            } else {
              handleError('연결이 끊어졌습니다. 다시 시도해주세요.');
            }
          }) as EventListener);

          // Handle timeout from stream
          addTrackedListener('timeout', ((event: MessageEvent) => {
            try {
              const timeoutData = JSON.parse(event.data);
              handleError(timeoutData.message || 'Request timeout');
            } catch {
              handleError('Request timeout');
            }
          }) as EventListener);
        };

        // 🎯 P1 Fix: Create AbortController for this request
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        // Step 1: Create Job with Retry
        fetchWithRetry(
          '/api/ai/jobs',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query,
              options: { sessionId },
            }),
            signal, // 🎯 P1 Fix: Pass abort signal for cancellation
          },
          {
            ...RETRY_STANDARD,
            onRetry: (error, attempt, delayMs) => {
              logger.info(
                `[AsyncAI] Job creation retry ${attempt}, waiting ${delayMs}ms`,
                error
              );
              setState((prev) => ({
                ...prev,
                progress: {
                  stage: 'retrying',
                  progress: 0,
                  message: `재시도 중... (${attempt}/3)`,
                },
              }));
            },
          }
        )
          .then(async (response) => {
            if (response.status === 429) {
              let message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
              try {
                const body = await response.json();
                message = body.dailyLimitExceeded
                  ? body.message || '일일 요청 제한을 초과했습니다.'
                  : `요청이 너무 많습니다. ${body.retryAfter ?? 60}초 후 다시 시도해주세요.`;
              } catch {
                // Non-JSON 429 response (e.g. from CDN/proxy)
              }
              throw new Error(message);
            }
            if (!response.ok) {
              throw new Error(`Failed to create job: ${response.status}`);
            }
            return response.json();
          })
          .then((data: { jobId: string; status: string }) => {
            const { jobId } = data;
            // 🎯 Capture jobId for Stale Closure prevention
            capturedJobId = jobId;
            setState((prev) => ({ ...prev, jobId }));

            // Step 2: Connect to SSE Stream
            connectSSE(jobId);

            // Set timeout
            timeoutRef.current = setTimeout(() => {
              handleError(`Request timeout after ${timeout}ms`);
            }, timeout);
          })
          .catch((error) => {
            handleError(`Failed to start query: ${error.message}`);
          });
      });
    },
    [sessionId, timeout, onProgress, onResult, onError, cleanup]
  );

  // Reset state
  const reset = useCallback(() => {
    cleanup();
    setState({
      isLoading: false,
      isConnected: false,
      progress: null,
      result: null,
      error: null,
      jobId: null,
    });
  }, [cleanup]);

  return {
    // Actions
    sendQuery,
    cancel,
    reset,

    // State
    ...state,

    // Computed
    progressPercent: state.progress?.progress ?? 0,
    progressMessage: state.progress?.message ?? '',
  };
}

export default useAsyncAIQuery;
