/**
 * 🕐 실시간 시계 컴포넌트
 *
 * 성능 최적화를 위해 분리된 독립 컴포넌트
 * - 매초 업데이트가 다른 컴포넌트에 영향 주지 않음
 * - memo로 불필요한 리렌더링 방지
 * - 자동 정리 기능 포함
 */

import { Clock } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

interface RealtimeClockProps {
  format?: '12h' | '24h';
  showIcon?: boolean;
  className?: string;
  locale?: string;
}

export const RealtimeClock = memo(function RealtimeClock({
  format = '24h',
  showIcon = true,
  className = '',
  locale = 'ko-KR',
}: RealtimeClockProps) {
  // 🔒 Hydration 불일치 방지: 초기값 null, 마운트 후 시간 설정
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());

    // 다음 초가 시작될 때까지의 시간 계산 (정확한 초 단위 업데이트)
    const now = new Date();
    const msUntilNextSecond = 1000 - now.getMilliseconds();

    const firstTimeout = setTimeout(() => {
      setCurrentTime(new Date());

      intervalRef.current = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }, msUntilNextSecond);

    return () => {
      clearTimeout(firstTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatTime = () => {
    if (!currentTime) return '--:--:--';

    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: format === '12h',
    };

    return currentTime.toLocaleTimeString(locale, options);
  };

  return (
    <div
      suppressHydrationWarning
      className={`flex items-center space-x-2 text-gray-600 dark:text-gray-300 ${className}`}
    >
      {showIcon && <Clock className="h-5 w-5" aria-hidden="true" />}
      <span className="font-mono text-sm">{formatTime()}</span>
    </div>
  );
});

// 날짜 포함 버전
interface DateTimeClockProps extends RealtimeClockProps {
  showDate?: boolean;
  dateFormat?: 'short' | 'long';
}

export const DateTimeClock = memo(function DateTimeClock({
  showDate = true,
  dateFormat = 'short',
  ...clockProps
}: DateTimeClockProps) {
  // 🔒 Hydration 불일치 방지: 초기값 null, 마운트 후 시간 설정
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDate = () => {
    if (!currentTime) return '--';

    const options: Intl.DateTimeFormatOptions =
      dateFormat === 'short'
        ? { month: 'short', day: 'numeric' }
        : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };

    return currentTime.toLocaleDateString(
      clockProps.locale || 'ko-KR',
      options
    );
  };

  return (
    <div suppressHydrationWarning className="flex flex-col items-end">
      {showDate && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {formatDate()}
        </span>
      )}
      <RealtimeClock {...clockProps} />
    </div>
  );
});
