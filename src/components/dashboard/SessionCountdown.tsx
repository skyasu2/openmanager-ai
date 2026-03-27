'use client';

import { Clock, Timer } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';

/**
 * 🕐 세션 카운트다운 컴포넌트
 *
 * @description
 * - 시스템 시작 후 30분 자동 종료까지 남은 시간 표시
 * - 1초마다 업데이트
 * - 5분 이하: 주황색 경고
 * - 1분 이하: 빨간색 위험
 *
 * @example
 * ```tsx
 * <SessionCountdown />
 * ```
 */
export const SessionCountdown = memo(function SessionCountdown() {
  const { isSystemStarted, getSystemRemainingTime } = useUnifiedAdminStore(
    useShallow((s) => ({
      isSystemStarted: s.isSystemStarted,
      getSystemRemainingTime: s.getSystemRemainingTime,
    }))
  );
  const [remainingTime, setRemainingTime] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 1초마다 남은 시간 업데이트
  useEffect(() => {
    if (!isSystemStarted) {
      setRemainingTime(0);
      return;
    }

    // 초기 값 설정
    setRemainingTime(getSystemRemainingTime());

    const timer = setInterval(() => {
      const time = getSystemRemainingTime();
      setRemainingTime(time);
    }, 1000);

    return () => clearInterval(timer);
  }, [isSystemStarted, getSystemRemainingTime]);

  // 시간 포맷팅 (MM:SS)
  const formatTime = (ms: number): string => {
    if (ms <= 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 남은 시간에 따른 스타일
  const getTimeStyle = () => {
    const minutes = Math.floor(remainingTime / 60000);
    if (minutes <= 1) {
      return 'text-red-600 bg-red-50 border-red-200';
    }
    if (minutes <= 5) {
      return 'text-orange-600 bg-orange-50 border-orange-200';
    }
    return 'text-green-600 bg-green-50 border-green-200';
  };

  // 시스템이 시작되지 않았거나 마운트 전이면 표시 안 함
  if (!isMounted || !isSystemStarted) {
    return null;
  }

  const minutes = Math.floor(remainingTime / 60000);

  return (
    <div
      suppressHydrationWarning
      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm font-medium transition-colors ${getTimeStyle()}`}
      role="timer"
      aria-label={`세션 남은 시간: ${formatTime(remainingTime)}`}
    >
      {minutes <= 5 ? (
        <Timer className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
      ) : (
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span className="font-mono tabular-nums">
        {formatTime(remainingTime)}
      </span>
      <span className="text-xs opacity-75">남음</span>
    </div>
  );
});

SessionCountdown.displayName = 'SessionCountdown';
