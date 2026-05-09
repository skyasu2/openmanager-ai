'use client';

import { AlertTriangle, Clock, Timer } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cn } from '@/lib/utils';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';

const WARNING_THRESHOLD_MS = 5 * 60 * 1000;
const CRITICAL_THRESHOLD_MS = 30 * 1000;

type TimerTone = 'normal' | 'warning' | 'critical';

const TIMER_TONE_STYLES: Record<TimerTone, string> = {
  normal:
    'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-800 shadow-sm shadow-amber-100',
  critical:
    'border-red-400 bg-red-50 text-red-700 shadow-sm shadow-red-100 ring-2 ring-red-200 animate-wiggle motion-reduce:animate-none',
};

const TIMER_TONE_LABELS: Record<TimerTone, string> = {
  normal: '정상',
  warning: '만료 주의',
  critical: '만료 임박',
};

const TIMER_TONE_VISIBLE_TEXT: Record<TimerTone, string> = {
  normal: '남음',
  warning: '주의',
  critical: '임박',
};

const getTimerTone = (remainingTime: number): TimerTone => {
  if (remainingTime <= CRITICAL_THRESHOLD_MS) {
    return 'critical';
  }
  if (remainingTime <= WARNING_THRESHOLD_MS) {
    return 'warning';
  }
  return 'normal';
};

/**
 * 🕐 세션 카운트다운 컴포넌트
 *
 * @description
 * - 시스템 시작 후 30분 자동 종료까지 남은 시간 표시
 * - 1초마다 업데이트
 * - 5분 이하: 노란색 경고
 * - 30초 이하: 빨간색 만료 임박 경고
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

  // 시스템이 시작되지 않았거나 마운트 전이면 표시 안 함
  if (!isMounted || !isSystemStarted) {
    return null;
  }

  const timerTone = getTimerTone(remainingTime);
  const isCritical = timerTone === 'critical';
  const statusLabel = TIMER_TONE_LABELS[timerTone];
  const visibleStatusText = TIMER_TONE_VISIBLE_TEXT[timerTone];

  return (
    <div
      suppressHydrationWarning
      className={cn(
        'flex min-w-[6.75rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-sm font-semibold transition-colors',
        TIMER_TONE_STYLES[timerTone]
      )}
      role="timer"
      aria-live="off"
      aria-label={`세션 ${statusLabel}: ${formatTime(remainingTime)}`}
      title={`세션 ${statusLabel}: ${formatTime(remainingTime)}`}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        세션 {statusLabel}
      </span>
      {isCritical ? (
        <AlertTriangle
          className="h-3.5 w-3.5 animate-pulse"
          aria-hidden="true"
        />
      ) : timerTone === 'warning' ? (
        <Timer className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
      ) : (
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span className="font-mono tabular-nums">
        {formatTime(remainingTime)}
      </span>
      <span className={cn('text-xs', isCritical ? 'font-bold' : 'opacity-80')}>
        {visibleStatusText}
      </span>
    </div>
  );
});

SessionCountdown.displayName = 'SessionCountdown';
