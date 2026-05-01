import type { MutableRefObject } from 'react';
import { extractStreamError } from '@/lib/ai/constants/stream-errors';
import {
  type AIErrorDetails,
  extractAIErrorDetailsFromPayload,
  inferAIErrorDetailsFromMessage,
} from '@/lib/ai/error-details';
import { normalizeRetrievalMetadata } from '@/lib/ai/utils/retrieval-status';
import { logger } from '@/lib/logging';
import { calculateBackoff } from '@/lib/utils/retry';
import type { AsyncQueryProgress, AsyncQueryResult } from '../useAsyncAIQuery';

export interface TrackedSSEListener {
  eventType: string;
  handler: EventListener;
}

interface ConnectAsyncQuerySSEParams {
  jobId: string;
  timeout: number;
  eventSourceRef: MutableRefObject<EventSource | null>;
  listenersRef: MutableRefObject<TrackedSSEListener[]>;
  timeoutRef: MutableRefObject<NodeJS.Timeout | null>;
  getCurrentProgress: () => number;
  onConnected: () => void;
  onProgress: (progress: AsyncQueryProgress) => void;
  onResult: (result: AsyncQueryResult) => void;
  onError: (error: string, details?: AIErrorDetails | null) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

function normalizeProviderAttempts(
  value: unknown
): AsyncQueryResult['providerAttempts'] {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const attempts = value
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const provider = getNonEmptyString(entry.provider);
      if (!provider) return null;
      const modelId = getNonEmptyString(entry.modelId);
      const attempt = getFiniteNumber(entry.attempt);
      const durationMs = getFiniteNumber(entry.durationMs);
      const error = getNonEmptyString(entry.error);
      return {
        provider,
        ...(modelId && { modelId }),
        ...(attempt !== undefined && { attempt }),
        ...(durationMs !== undefined && { durationMs }),
        ...(error && { error }),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return attempts.length > 0 ? attempts : undefined;
}

export function closeTrackedEventSource(
  eventSourceRef: MutableRefObject<EventSource | null>,
  listenersRef: MutableRefObject<TrackedSSEListener[]>
) {
  if (!eventSourceRef.current) {
    return;
  }

  for (const { eventType, handler } of listenersRef.current) {
    eventSourceRef.current.removeEventListener(eventType, handler);
  }
  listenersRef.current = [];
  eventSourceRef.current.close();
  eventSourceRef.current = null;
}

export function connectAsyncQuerySSE(
  params: ConnectAsyncQuerySSEParams,
  reconnectAttempt = 0
) {
  const {
    jobId,
    timeout,
    eventSourceRef,
    listenersRef,
    timeoutRef,
    getCurrentProgress,
    onConnected,
    onProgress,
    onResult,
    onError,
  } = params;
  const maxReconnects = 3;

  closeTrackedEventSource(eventSourceRef, listenersRef);

  const eventSource = new EventSource(`/api/ai/jobs/${jobId}/stream`);
  eventSourceRef.current = eventSource;

  const addTrackedListener = (eventType: string, handler: EventListener) => {
    eventSource.addEventListener(eventType, handler);
    listenersRef.current.push({ eventType, handler });
  };

  const scheduleReconnect = (message: string) => {
    closeTrackedEventSource(eventSourceRef, listenersRef);

    if (reconnectAttempt < maxReconnects) {
      const delay = calculateBackoff(reconnectAttempt, 1000, 10000, 0.1);
      logger.info(
        `[AsyncAI] SSE disconnected, reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1}/${maxReconnects})`
      );
      onProgress({
        stage: 'reconnecting',
        progress: getCurrentProgress(),
        message: `재연결 중... (${reconnectAttempt + 1}/${maxReconnects})`,
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        if (eventSourceRef.current === null && timeoutRef.current === null) {
          return;
        }
        try {
          connectAsyncQuerySSE(params, reconnectAttempt + 1);
        } catch (error) {
          logger.error('[AsyncAI] Reconnection failed:', error);
          onError('재연결에 실패했습니다.');
        }
      }, delay);
      return;
    }

    onError(message);
  };

  addTrackedListener('connected', () => {
    onConnected();
    if (reconnectAttempt > 0) {
      logger.info(
        `[AsyncAI] SSE reconnected after ${reconnectAttempt} attempts`
      );
    }
  });

  addTrackedListener('progress', ((event: MessageEvent) => {
    try {
      const progress = JSON.parse(event.data) as AsyncQueryProgress;
      onProgress(progress);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          onError(`Request timeout after ${timeout}ms`);
        }, timeout);
      }
    } catch (error) {
      logger.warn('[AsyncAI] Failed to parse progress:', error);
    }
  }) as EventListener);

  addTrackedListener('result', ((event: MessageEvent) => {
    try {
      const resultData = JSON.parse(event.data);
      if (!resultData || typeof resultData !== 'object') {
        throw new Error('Invalid result data structure');
      }

      const errorInResponse = extractStreamError(resultData.response || '');
      if (errorInResponse) {
        logger.warn(`[AsyncAI] Stream error in result: ${errorInResponse}`);
        onError(errorInResponse);
        return;
      }
      const metadata = isRecord(resultData.metadata) ? resultData.metadata : {};
      const provider = getNonEmptyString(metadata.provider);
      const modelId = getNonEmptyString(metadata.modelId);
      const providerAttempts = normalizeProviderAttempts(
        metadata.providerAttempts
      );
      const fallbackReason = getNonEmptyString(metadata.fallbackReason);
      const ttfbMs = getFiniteNumber(metadata.ttfbMs);

      onResult({
        success: true,
        response: resultData.response,
        targetAgent: resultData.targetAgent,
        toolsCalled: Array.isArray(resultData.toolsCalled)
          ? resultData.toolsCalled
          : undefined,
        toolResults: resultData.toolResults,
        ragSources: resultData.ragSources,
        processingTimeMs: resultData.processingTimeMs,
        latencyTier:
          metadata.latencyTier === 'fast' ||
          metadata.latencyTier === 'normal' ||
          metadata.latencyTier === 'slow' ||
          metadata.latencyTier === 'very_slow'
            ? metadata.latencyTier
            : undefined,
        resolvedMode:
          metadata.resolvedMode === 'single' ||
          metadata.resolvedMode === 'multi'
            ? metadata.resolvedMode
            : undefined,
        modeSelectionSource:
          typeof metadata.modeSelectionSource === 'string'
            ? metadata.modeSelectionSource
            : undefined,
        traceId:
          typeof metadata.traceId === 'string' ? metadata.traceId : undefined,
        retrieval: normalizeRetrievalMetadata(metadata.retrieval),
        ...(provider && { provider }),
        ...(modelId && { modelId }),
        ...(providerAttempts && { providerAttempts }),
        ...(typeof metadata.usedFallback === 'boolean' && {
          usedFallback: metadata.usedFallback,
        }),
        ...(fallbackReason && { fallbackReason }),
        ...(ttfbMs !== undefined && { ttfbMs }),
        analysisMode:
          metadata.analysisMode === 'auto' ||
          metadata.analysisMode === 'thinking'
            ? metadata.analysisMode
            : undefined,
        handoffHistory: Array.isArray(metadata.handoffs)
          ? (metadata.handoffs as AsyncQueryResult['handoffHistory'])
          : undefined,
        toolResultSummaries: Array.isArray(metadata.toolResultSummaries)
          ? (metadata.toolResultSummaries as AsyncQueryResult['toolResultSummaries'])
          : undefined,
      });
    } catch (error) {
      onError(`Failed to parse result: ${error}`);
    }
  }) as EventListener);

  addTrackedListener('error', ((event: Event) => {
    if (eventSource.readyState === EventSource.CLOSED) {
      return;
    }

    const messageEvent = event as MessageEvent;
    if (messageEvent.data) {
      try {
        const errorData = JSON.parse(messageEvent.data);
        const errorMessage =
          (typeof errorData.error === 'string' && errorData.error) ||
          (typeof errorData.message === 'string' && errorData.message) ||
          'Stream error';
        const details =
          extractAIErrorDetailsFromPayload(errorData.errorDetails) ??
          extractAIErrorDetailsFromPayload(errorData);
        onError(
          errorMessage,
          details ?? inferAIErrorDetailsFromMessage(errorMessage)
        );
        return;
      } catch {
        // ignore parse error and continue with reconnect flow
      }
    }

    scheduleReconnect('연결이 끊어졌습니다. 다시 시도해주세요.');
  }) as EventListener);

  addTrackedListener('timeout', ((event: MessageEvent) => {
    try {
      const timeoutData = JSON.parse(event.data);
      const message =
        typeof timeoutData.message === 'string'
          ? timeoutData.message
          : 'Request timeout';
      scheduleReconnect(message);
    } catch {
      scheduleReconnect('Request timeout');
    }
  }) as EventListener);
}
