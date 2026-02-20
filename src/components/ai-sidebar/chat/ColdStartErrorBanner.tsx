'use client';

/**
 * Cold Start Error Banner
 *
 * AI 엔진 Cold Start 에러 및 일반 에러 표시
 * - Cold Start 감지 시 자동 재시도 카운트다운
 * - 일반 에러는 수동 재시도 버튼 제공
 *
 * @created 2026-01-28
 * @extracted-from EnhancedAIChat.tsx
 */

import { AlertCircle, RefreshCw, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  isColdStartRelatedError,
  isModelConfigRelatedError,
} from '@/lib/ai/constants/stream-errors';

const RETRY_SCHEDULE = [5, 10, 15]; // seconds per attempt
const MAX_AUTO_RETRIES = RETRY_SCHEDULE.length;

export interface ColdStartErrorBannerProps {
  error: string;
  onRetry?: () => void;
  onClearError?: () => void;
}

/**
 * Cold Start 에러 배너 (다단계 자동 재시도 카운트다운 포함)
 * 3단계 progressive retry: 5초, 10초, 15초 = 총 30초 자동 대기
 */
export function ColdStartErrorBanner({
  error,
  onRetry,
  onClearError,
}: ColdStartErrorBannerProps) {
  const isColdStart = isColdStartRelatedError(error);
  const isModelConfigError = isModelConfigRelatedError(error);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const currentDelay = RETRY_SCHEDULE[retryAttempt] ?? 0;
  const [countdown, setCountdown] = useState(isColdStart ? currentDelay : 0);
  const [isAutoRetrying, setIsAutoRetrying] = useState(
    isColdStart && retryAttempt < MAX_AUTO_RETRIES && error.trim().length > 0
  );
  const [autoRetryExhausted, setAutoRetryExhausted] = useState(false);

  // error prop 변경 시 retry 상태 리셋
  useEffect(() => {
    const shouldAutoRetry = isColdStart && error.trim().length > 0;
    setRetryAttempt(0);
    setAutoRetryExhausted(false);
    if (shouldAutoRetry) {
      setCountdown(RETRY_SCHEDULE[0] ?? 5);
      setIsAutoRetrying(true);
    } else {
      setCountdown(0);
      setIsAutoRetrying(false);
    }
  }, [error, isColdStart]);

  // 자동 재시도 카운트다운 (다단계)
  useEffect(() => {
    if (!isAutoRetrying || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        // 카운트다운 종료 → 자동 재시도
        const nextAttempt = retryAttempt + 1;
        setRetryAttempt(nextAttempt);
        if (nextAttempt < MAX_AUTO_RETRIES) {
          // 다음 시도 준비
          setCountdown(RETRY_SCHEDULE[nextAttempt] ?? 5);
        } else {
          // 모든 자동 재시도 소진 → 수동 모드
          setIsAutoRetrying(false);
          setAutoRetryExhausted(true);
        }
        onRetry?.();
      } else {
        setCountdown((prev) => prev - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isAutoRetrying, onRetry, retryAttempt]);

  // 자동 재시도 취소
  const cancelAutoRetry = useCallback(() => {
    setIsAutoRetrying(false);
    setCountdown(0);
  }, []);

  // Cold Start 에러용 UI
  if (isColdStart) {
    return (
      <div className="border-t border-orange-300 bg-linear-to-r from-orange-50 to-amber-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
            <Zap className="h-5 w-5 text-orange-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-orange-800">
              ⚡ AI 엔진이 준비 중입니다
            </p>
            <p className="mt-1 text-xs text-orange-700">
              Cloud Run AI 엔진이 대기 모드에서 깨어나고 있습니다. 일반적으로
              5-10초 소요됩니다.
            </p>
            {isAutoRetrying && countdown > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-orange-200">
                  <div
                    className="h-full bg-orange-500 transition-all duration-1000 ease-linear"
                    style={{
                      width: `${(countdown / (RETRY_SCHEDULE[retryAttempt] ?? 1)) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-orange-600">
                  시도 {retryAttempt + 1}/{MAX_AUTO_RETRIES}: {countdown}초 후
                  재시도
                </span>
              </div>
            )}
            {autoRetryExhausted && (
              <p className="mt-1 text-xs text-orange-600">
                AI 엔진이 아직 준비 중입니다. 수동 재시도해 주세요.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={() => {
                  cancelAutoRetry();
                  onRetry();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-700"
              >
                <RefreshCw className="h-4 w-4" />
                <span>지금 재시도</span>
              </button>
            )}
            {isAutoRetrying && (
              <button
                type="button"
                onClick={cancelAutoRetry}
                className="text-xs text-orange-600 underline hover:text-orange-800"
              >
                자동 재시도 취소
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isModelConfigError) {
    return (
      <div className="border-t border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-900">
                AI 모델 설정 또는 권한 오류
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                자동 재시도보다 모델 ID/권한 설정 점검이 필요합니다.
              </p>
              <p className="mt-1 break-words text-xs text-amber-700">{error}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center space-x-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center space-x-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
                aria-label="재시도"
              >
                <RefreshCw className="h-4 w-4" />
                <span>재시도</span>
              </button>
            )}
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                className="rounded-lg p-1.5 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-700"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 일반 에러용 UI
  return (
    <div className="border-t border-red-200 bg-linear-to-r from-red-50 to-orange-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start space-x-2">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-800">
              요청을 처리할 수 없습니다
            </p>
            <p className="mt-0.5 break-words text-xs text-red-600">{error}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center space-x-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center space-x-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
              aria-label="재시도"
            >
              <RefreshCw className="h-4 w-4" />
              <span>재시도</span>
            </button>
          )}
          {onClearError && (
            <button
              type="button"
              onClick={onClearError}
              className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-100 hover:text-red-600"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
