/**
 * Incident Report retry 전략
 *
 * generate 액션에서 fallback 발생 시 최대 3단계 retry:
 * 1. Circuit Breaker 경유 재시도
 * 2. Circuit Breaker 경유 2차 재시도
 * 3. Direct Cloud Run 재시도 (Circuit Breaker 우회)
 */

import type { CacheableAIResponse } from '@/lib/ai/cache/ai-response-cache';
import { getErrorMessage } from '@/types/type-utils';
import { debug } from '@/utils/debug';
import {
  DIRECT_RETRY_MIN_BUFFER_MS,
  getIncidentRetryTimeout,
  isFallbackPayload,
} from './route-helpers';

export interface RetryState {
  responseData: Record<string, unknown>;
  isFallback: boolean;
  didGenerateRetry: boolean;
  attemptedDirectRetry: boolean;
  didDirectRetry: boolean;
}

interface RetryDeps {
  fetchIncidentReport: (timeout: number) => Promise<CacheableAIResponse>;
  fetchCloudRunDirect: (timeout: number) => Promise<CacheableAIResponse>;
  getSecondAttemptPlan: () => { retryAllowed: boolean; timeoutMs: number };
  effectiveDefaultTimeout: number;
  routeBudgetMs: number;
}

/**
 * generate 액션의 retry 전략을 실행합니다.
 *
 * 초기 fallback 응답을 받으면 최대 3단계까지 재시도합니다.
 */
export async function executeGenerateRetry(
  initialResponse: Record<string, unknown>,
  deps: RetryDeps
): Promise<RetryState> {
  let responseData = initialResponse;
  let isFallback = true;
  const didGenerateRetry = true;
  let attemptedDirectRetry = false;
  let didDirectRetry = false;

  debug.info(
    '[incident-report] Generate fallback on first attempt. Retrying once...'
  );

  await new Promise((resolve) => setTimeout(resolve, 250));
  const secondAttemptPlan = deps.getSecondAttemptPlan();

  if (!secondAttemptPlan.retryAllowed) {
    debug.info(
      '[incident-report] Direct Cloud Run retry skipped due insufficient route budget'
    );
    responseData = {
      ...responseData,
      _fallbackReason: 'Route budget limit reached',
    };
    return {
      responseData,
      isFallback: true,
      didGenerateRetry,
      attemptedDirectRetry,
      didDirectRetry,
    };
  }

  debug.info(
    '[incident-report] Generate fallback persisted. Trying second Cloud Run retry...'
  );

  try {
    responseData = (await deps.fetchIncidentReport(
      secondAttemptPlan.timeoutMs
    )) as Record<string, unknown>;
    isFallback = isFallbackPayload(responseData);
  } catch (directRetryError) {
    debug.error(
      '[incident-report] Second Cloud Run retry failed:',
      directRetryError
    );
    responseData = {
      ...responseData,
      _fallbackReason: getErrorMessage(directRetryError),
    };
    isFallback = true;
  }

  if (!isFallback) {
    return {
      responseData,
      isFallback: false,
      didGenerateRetry,
      attemptedDirectRetry,
      didDirectRetry,
    };
  }

  // 3rd attempt: direct Cloud Run (bypass circuit breaker)
  const directRetryPlan = getIncidentRetryTimeout(
    secondAttemptPlan.timeoutMs,
    deps.effectiveDefaultTimeout + secondAttemptPlan.timeoutMs,
    deps.routeBudgetMs,
    DIRECT_RETRY_MIN_BUFFER_MS
  );

  if (!directRetryPlan.retryAllowed) {
    responseData = {
      ...responseData,
      _fallbackReason: 'Route budget limit reached',
    };
    return {
      responseData,
      isFallback: true,
      didGenerateRetry,
      attemptedDirectRetry,
      didDirectRetry,
    };
  }

  debug.info(
    '[incident-report] Generate fallback persisted. Trying direct Cloud Run retry...'
  );
  attemptedDirectRetry = true;

  try {
    responseData = (await deps.fetchCloudRunDirect(
      directRetryPlan.timeoutMs
    )) as Record<string, unknown>;
    isFallback = isFallbackPayload(responseData);
    didDirectRetry = !isFallback;
  } catch (directRetryError) {
    debug.error(
      '[incident-report] Direct Cloud Run retry failed:',
      directRetryError
    );
    responseData = {
      ...responseData,
      _fallbackReason: getErrorMessage(directRetryError),
    };
    isFallback = true;
  }

  return {
    responseData,
    isFallback,
    didGenerateRetry,
    attemptedDirectRetry,
    didDirectRetry,
  };
}
