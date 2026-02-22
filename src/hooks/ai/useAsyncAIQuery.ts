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
import { logger } from '@/lib/logging';
import { fetchWithRetry, RETRY_STANDARD } from '@/lib/utils/retry';
import {
  closeTrackedEventSource,
  connectAsyncQuerySSE,
  type TrackedSSEListener,
} from './core/asyncQuerySSE';

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
  const listenersRef = useRef<TrackedSSEListener[]>([]);

  // 🎯 P1-5 Fix: Cleanup function defined before useEffect to avoid stale closure
  const cleanupRef = useRef<() => void>(() => {});

  // 🎯 6th review fix: Track jobId via ref to prevent stale closure in cancel()
  const jobIdRef = useRef<string | null>(null);
  const progressRef = useRef<number>(0);

  // Cleanup function
  const cleanup = useCallback(() => {
    // 🎯 P1 Fix: Abort any pending fetch requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    closeTrackedEventSource(eventSourceRef, listenersRef);
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
    progressRef.current = 0;

    const currentJobId = jobIdRef.current;
    if (currentJobId) {
      try {
        await fetch(`/api/ai/jobs/${currentJobId}`, { method: 'DELETE' });
      } catch (e) {
        logger.warn('[AsyncAI] Failed to cancel job:', e);
      }
    }
    jobIdRef.current = null;

    setState((prev) => ({
      ...prev,
      isLoading: false,
      isConnected: false,
      error: 'Cancelled by user',
    }));
  }, [cleanup]);

  // Send query
  const sendQuery = useCallback(
    async (query: string): Promise<AsyncQueryResult> => {
      // Cleanup previous state
      cleanup();
      jobIdRef.current = null;
      progressRef.current = 0;
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
          jobIdRef.current = null;
          progressRef.current = 0;
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
          jobIdRef.current = null;
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
            jobIdRef.current = jobId;
            setState((prev) => ({ ...prev, jobId }));

            // Step 2: Connect to SSE Stream
            connectAsyncQuerySSE({
              jobId,
              timeout,
              eventSourceRef,
              listenersRef,
              timeoutRef,
              getCurrentProgress: () => progressRef.current,
              onConnected: () => {
                setState((prev) => ({ ...prev, isConnected: true }));
              },
              onProgress: (progress) => {
                progressRef.current = progress.progress;
                setState((prev) => ({ ...prev, progress, isConnected: true }));
                onProgress?.(progress);
              },
              onResult: (result) => {
                handleResult(result);
              },
              onError: (error) => {
                handleError(error);
              },
            });

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
    jobIdRef.current = null;
    progressRef.current = 0;
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
