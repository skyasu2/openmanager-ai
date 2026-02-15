'use client';

import { Clock } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

/**
 * 실시간 시간 표시 컴포넌트
 *
 * @description
 * - 현재 시간과 날짜를 1초마다 업데이트
 * - 순수 UI 컴포넌트 (외부 상태 없음)
 * - memo로 최적화 (props 없음)
 *
 * @example
 * ```tsx
 * <RealTimeDisplay />
 * ```
 */
export const RealTimeDisplay = memo(function RealTimeDisplay() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setCurrentTime(new Date());

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const timeText = currentTime
    ? currentTime.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  const dateText = currentTime
    ? currentTime.toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      })
    : '--- -- (-- )';

  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-600">
      <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
      <span suppressHydrationWarning aria-live={isMounted ? 'polite' : 'off'}>
        {timeText}
      </span>
      <span className="text-gray-700">|</span>
      <span suppressHydrationWarning>{dateText}</span>
    </div>
  );
});

RealTimeDisplay.displayName = 'RealTimeDisplay';
