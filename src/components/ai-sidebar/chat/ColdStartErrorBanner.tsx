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
import { isColdStartRelatedError } from '@/lib/ai/constants/stream-errors';

const AUTO_RETRY_SECONDS = 5;

export interface ColdStartErrorBannerProps {
  error: string;
  onRetry?: () => void;
  onClearError?: () => void;
}

/**
 * Cold Start 에러 배너 (자동 재시도 카운트다운 포함)
 */
export function ColdStartErrorBanner({
  error,
  onRetry,
  onClearError,
}: ColdStartErrorBannerProps) {
  const isColdStart = isColdStartRelatedError(error);
  const [countdown, setCountdown] = useState(
    isColdStart ? AUTO_RETRY_SECONDS : 0
  );
  const [isAutoRetrying, setIsAutoRetrying] = useState(isColdStart);

  // 자동 재시도 카운트다운
  useEffect(() => {
    if (!isAutoRetrying || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        // 카운트다운 종료 → 자동 재시도
        setIsAutoRetrying(false);
        onRetry?.();
      } else {
        setCountdown((prev) => prev - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, isAutoRetrying, onRetry]);

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
                      width: `${(countdown / AUTO_RETRY_SECONDS) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-medium text-orange-600">
                  {countdown}초 후 재시도
                </span>
              </div>
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
