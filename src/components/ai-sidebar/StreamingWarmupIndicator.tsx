'use client';

/**
 * Streaming Warmup Indicator
 *
 * Cloud Run AI Engine cold start 대기 시 표시되는 인디케이터.
 * 내부 재시도를 숨기고 연속적 진행으로 보여줌.
 *
 * @created 2026-02-21
 */

import { Loader2, Zap } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

interface StreamingWarmupIndicatorProps {
  /** 예상 대기 시간 (초) */
  estimatedWaitSeconds: number;
}

export const StreamingWarmupIndicator = memo<StreamingWarmupIndicatorProps>(
  ({ estimatedWaitSeconds }) => {
    const [progress, setProgress] = useState(0);
    const [elapsed, setElapsed] = useState(0);
    const startTimeRef = useRef(Date.now());

    useEffect(() => {
      startTimeRef.current = Date.now();
      setProgress(0);
      setElapsed(0);
    }, []);

    // Smooth progress: 빠르게 시작 → 느리게 마무리 (easeOutExpo 커브)
    useEffect(() => {
      const estimatedMs = (estimatedWaitSeconds || 60) * 1000;

      const interval = setInterval(() => {
        const elapsedMs = Date.now() - startTimeRef.current;
        const ratio = Math.min(elapsedMs / estimatedMs, 1);
        // easeOutExpo: 초반 빠름, 90% 이후 천천히
        const eased = 1 - (1 - ratio) ** 3;
        // 최대 95%까지 (100%는 실제 완료 시)
        setProgress(Math.min(eased * 95, 95));
        setElapsed(Math.floor(elapsedMs / 1000));
      }, 200);

      return () => clearInterval(interval);
    }, [estimatedWaitSeconds]);

    return (
      <div className="border-t border-blue-200 bg-linear-to-r from-blue-50 to-indigo-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <Zap className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <p className="text-sm font-semibold text-blue-800">
                AI 엔진 준비 중...
              </p>
            </div>
            <p className="mt-1 text-xs text-blue-600">
              Cloud Run AI 엔진이 시작되고 있습니다. 최대 1분 소요될 수
              있습니다.
            </p>

            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-blue-200">
                <div
                  className="h-full rounded-full bg-linear-to-r from-blue-500 to-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-blue-500">
                {elapsed}초
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

StreamingWarmupIndicator.displayName = 'StreamingWarmupIndicator';
