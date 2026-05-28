'use client';

import { Clock } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { formatDashboardDateTime } from '@/utils/dashboard/rotating-timestamp';

type RealTimeDisplayProps = {
  variant?: 'default' | 'compact';
};

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
export const RealTimeDisplay = memo(function RealTimeDisplay({
  variant = 'default',
}: RealTimeDisplayProps) {
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

  const dateTimeText = currentTime
    ? formatDashboardDateTime(currentTime)
    : '----.--.-- --:--:--';

  const weekdayText = currentTime
    ? currentTime.toLocaleDateString('ko-KR', {
        weekday: 'short',
      })
    : '--';

  const compactTimeText = dateTimeText.includes(' ')
    ? (dateTimeText.split(' ')[1]?.slice(0, 5) ?? '--:--')
    : '--:--';

  if (variant === 'compact') {
    return (
      <div
        className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-white/80 px-2.5 text-xs font-medium text-slate-600 shadow-xs"
        role="timer"
        aria-label={`현재 시간 ${dateTimeText} (${weekdayText})`}
        aria-live={isMounted ? 'polite' : 'off'}
        title={`현재 시간 ${dateTimeText} (${weekdayText})`}
      >
        <Clock className="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
        <span suppressHydrationWarning aria-hidden="true">
          {compactTimeText}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-600">
      <Clock className="h-4 w-4 text-blue-500" aria-hidden="true" />
      <span suppressHydrationWarning aria-live={isMounted ? 'polite' : 'off'}>
        {dateTimeText}
      </span>
      <span className="text-gray-500" suppressHydrationWarning>
        ({weekdayText})
      </span>
    </div>
  );
});

RealTimeDisplay.displayName = 'RealTimeDisplay';
