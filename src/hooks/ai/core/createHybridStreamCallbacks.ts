import type { UIMessage } from '@ai-sdk/react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  calculateRetryDelay,
  isRetryableError,
} from '@/config/ai-proxy.config';
import {
  extractStreamError,
  isColdStartRelatedError,
} from '@/lib/ai/constants/stream-errors';
import { logger } from '@/lib/logging';
import type {
  HybridQueryState,
  RedirectEventData,
  StreamDataPart,
  WarningEventData,
} from '../types/hybrid-query.types';
import type { FileAttachment } from '../useFileAttachments';

type StateSetter = Dispatch<SetStateAction<HybridQueryState>>;

type ExecuteQueryFn = (
  query: string,
  attachments?: FileAttachment[],
  isRetry?: boolean
) => void;

interface CreateHybridStreamCallbacksDeps {
  traceIdRef: MutableRefObject<string>;
  verboseLogging: boolean;
  maxRetries: number;
  onStreamFinish?: () => void;
  onData?: (dataPart: StreamDataPart) => void;
  setState: StateSetter;
  refs: {
    retryCount: MutableRefObject<number>;
    warmingUp: MutableRefObject<boolean>;
    currentQuery: MutableRefObject<string | null>;
    pendingAttachments: MutableRefObject<FileAttachment[] | null>;
    errorHandled: MutableRefObject<boolean>;
    redirecting: MutableRefObject<boolean>;
    abortController: MutableRefObject<AbortController | null>;
    retryTimeout: MutableRefObject<ReturnType<typeof setTimeout> | null>;
    executeQuery: MutableRefObject<ExecuteQueryFn | null>;
  };
  stopStreaming: () => void;
  runJobQueueQuery: (query: string) => Promise<unknown>;
}

function extractTextContent(message: UIMessage): string {
  const parts = message.parts ?? [];
  return parts
    .filter(
      (part): part is { type: 'text'; text: string } =>
        part != null && part.type === 'text'
    )
    .map((part) => part.text)
    .join('');
}

export function createHybridStreamCallbacks(
  deps: CreateHybridStreamCallbacksDeps
) {
  const {
    traceIdRef,
    verboseLogging,
    maxRetries,
    onStreamFinish,
    onData,
    setState,
    refs,
    stopStreaming,
    runJobQueueQuery,
  } = deps;

  const onFinish = ({ message }: { message: UIMessage }) => {
    if (refs.redirecting.current) {
      logger.debug('[HybridAI] onFinish skipped (redirect in progress)');
      onStreamFinish?.();
      return;
    }

    if (refs.errorHandled.current) {
      logger.debug(
        '[HybridAI] onFinish skipped (error already handled by onError)'
      );
      setState((prev) => ({ ...prev, isLoading: false }));
      onStreamFinish?.();
      return;
    }

    const streamError = extractStreamError(extractTextContent(message));
    if (streamError) {
      logger.warn(
        `[HybridAI] Stream error detected (trace: ${traceIdRef.current}): ${streamError}`
      );
      refs.errorHandled.current = true;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: streamError,
      }));
    } else {
      refs.retryCount.current = 0;
      if (verboseLogging) {
        logger.info(
          `[HybridAI] Stream completed successfully (trace: ${traceIdRef.current})`
        );
      }
      setState((prev) => ({
        ...prev,
        isLoading: false,
        warmingUp: false,
        estimatedWaitSeconds: 0,
      }));
    }

    onStreamFinish?.();
  };

  const onDataPart = (dataPart: unknown) => {
    const part = dataPart as StreamDataPart;

    if (part.type === 'data-warning' && part.data) {
      const warningData = part.data as WarningEventData;
      if (warningData.code === 'SLOW_PROCESSING') {
        logger.warn(
          `⚠️ [HybridAI] Slow processing: ${warningData.message} (${warningData.elapsed}ms)`
        );
        setState((prev) => ({
          ...prev,
          warning: warningData.message,
          processingTime: warningData.elapsed,
        }));
      } else {
        logger.warn(`⚠️ [HybridAI] Stream error: ${warningData.message}`);
        setState((prev) => ({
          ...prev,
          warning: warningData.message,
        }));
      }
      return;
    }

    if (part.type === 'data-redirect' && part.data) {
      const redirectData = part.data as RedirectEventData;
      logger.info(
        `🔀 [HybridAI] Redirect received: switching to job-queue (${redirectData.complexity})`
      );

      refs.redirecting.current = true;
      setState((prev) => ({
        ...prev,
        mode: 'job-queue',
        complexity: redirectData.complexity,
        isLoading: true,
      }));

      stopStreaming();

      const query = refs.currentQuery.current;
      if (!query) {
        refs.redirecting.current = false;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Job Queue 전환에 필요한 쿼리를 찾을 수 없습니다.',
        }));
        return;
      }

      refs.abortController.current?.abort();
      const controller = new AbortController();
      refs.abortController.current = controller;
      const currentQuery = query;

      queueMicrotask(() => {
        if (controller.signal.aborted) {
          logger.debug('[HybridAI] Job Queue redirect aborted');
          refs.redirecting.current = false;
          return;
        }

        runJobQueueQuery(currentQuery)
          .then(() => {
            refs.redirecting.current = false;
            if (!controller.signal.aborted) {
              logger.debug('[HybridAI] Job Queue redirect completed');
            }
          })
          .catch((error) => {
            refs.redirecting.current = false;
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
      return;
    }

    if (refs.warmingUp.current) {
      setState((prev) => ({
        ...prev,
        warmingUp: false,
        estimatedWaitSeconds: 0,
      }));
    }
    onData?.(part);
  };

  const onError = async (error: Error) => {
    const errorMessage = error.message || 'Unknown error';
    logger.error(
      `[HybridAI] useChat error (trace: ${traceIdRef.current}):`,
      errorMessage
    );

    const isResumeProbeWithoutUserQuery =
      !refs.currentQuery.current &&
      /(failed to fetch|load failed|networkerror)/i.test(errorMessage);
    if (isResumeProbeWithoutUserQuery) {
      logger.debug(
        `[HybridAI] Ignoring resume probe error before first query (trace: ${traceIdRef.current})`
      );
      setState((prev) => ({ ...prev, isLoading: false }));
      return;
    }

    if (refs.errorHandled.current) {
      logger.debug('[HybridAI] onError skipped (already handled by onFinish)');
      return;
    }

    refs.errorHandled.current = true;
    const isColdStart = isColdStartRelatedError(errorMessage);
    const retryLimit = isColdStart ? 1 : maxRetries;
    const canRetry =
      isRetryableError(errorMessage) && refs.retryCount.current < retryLimit;

    if (canRetry && refs.currentQuery.current) {
      refs.retryCount.current += 1;
      const delay = isColdStart
        ? 3_000
        : calculateRetryDelay(refs.retryCount.current - 1);

      logger.info(
        `[HybridAI] Retrying stream (${refs.retryCount.current}/${retryLimit}) after ${delay}ms (trace: ${traceIdRef.current})`
      );

      setState((prev) => ({
        ...prev,
        warning: isColdStart
          ? 'AI 엔진 웜업 중... 재연결합니다'
          : `재연결 중... (${refs.retryCount.current}/${retryLimit})`,
        warmingUp: isColdStart,
        estimatedWaitSeconds: isColdStart ? 60 : 0,
      }));

      refs.retryTimeout.current = setTimeout(() => {
        refs.retryTimeout.current = null;
        const query = refs.currentQuery.current;
        const attachments = refs.pendingAttachments.current;
        const executeQuery = refs.executeQuery.current;

        if (!query || !executeQuery) {
          logger.warn(
            '[HybridAI] Retry skipped due to missing query or executeQuery reference'
          );
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: '재시도 준비 중 오류가 발생했습니다.',
          }));
          return;
        }

        executeQuery(query, attachments || undefined, true);
      }, delay);
      return;
    }

    refs.retryCount.current = 0;
    setState((prev) => ({
      ...prev,
      isLoading: false,
      error: errorMessage || 'AI 응답 중 오류가 발생했습니다.',
      warning: null,
      processingTime: 0,
      warmingUp: false,
      estimatedWaitSeconds: 0,
    }));
  };

  return { onFinish, onData: onDataPart, onError };
}
