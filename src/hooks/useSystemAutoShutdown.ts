/**
 * 🕐 System Auto Shutdown Hook
 *
 * UI 표시 전용 자동 종료 시스템 훅
 * - useUnifiedAdminStore의 자동 종료 시간 정보 활용
 * - 남은 시간 표시 및 경고 알림
 * - 실제 종료는 useUnifiedAdminStore에서 처리
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { SYSTEM_AUTO_SHUTDOWN_TIME } from '@/config/system-constants';
import { logger } from '@/lib/logging';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';

interface UseSystemAutoShutdownOptions {
  /** 경고 시간 (분) */
  warningMinutes?: number;
  /** 경고 콜백 */
  onWarning?: (remainingMinutes: number) => void;
  /** 종료 콜백 (UI 업데이트용) */
  onShutdown?: () => void;
}

export function useSystemAutoShutdown({
  warningMinutes: _warningMinutes = 5,
  onWarning,
  onShutdown,
}: UseSystemAutoShutdownOptions = {}) {
  // useUnifiedAdminStore에서 시스템 상태 가져오기
  const { isSystemStarted, getSystemRemainingTime } = useUnifiedAdminStore(
    useShallow((s) => ({
      isSystemStarted: s.isSystemStarted,
      getSystemRemainingTime: s.getSystemRemainingTime,
    }))
  );

  // 상태 관리
  const [remainingTime, setRemainingTime] = useState(0);
  const [isWarning, setIsWarning] = useState(false);
  const [hasWarned5Min, setHasWarned5Min] = useState(false);
  const [hasWarned1Min, setHasWarned1Min] = useState(false);

  // 업데이트 인터벌 참조
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 남은 시간 업데이트 (1초마다)
  useEffect(() => {
    if (!isSystemStarted) {
      setRemainingTime(0);
      setIsWarning(false);
      setHasWarned5Min(false);
      setHasWarned1Min(false);
      return;
    }

    updateIntervalRef.current = setInterval(() => {
      const remaining = getSystemRemainingTime();
      setRemainingTime(remaining);

      // 경고 시간 체크
      const remainingMinutes = Math.floor(remaining / 60000);

      // 5분 경고
      if (remainingMinutes <= 5 && remainingMinutes > 4 && !hasWarned5Min) {
        setIsWarning(true);
        setHasWarned5Min(true);
        onWarning?.(5);
      }

      // 1분 경고
      if (remainingMinutes <= 1 && remainingMinutes > 0 && !hasWarned1Min) {
        setHasWarned1Min(true);
        onWarning?.(1);
      }

      // 시간이 다 되면 콜백 호출 (UI 업데이트용)
      if (remaining <= 0 && isSystemStarted) {
        onShutdown?.();
      }
    }, 1000); // 🎯 1초 간격으로 복원 - 부드러운 카운트다운 UX

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isSystemStarted,
    hasWarned5Min,
    hasWarned1Min,
    getSystemRemainingTime,
    onShutdown,
    onWarning,
  ]); // 함수 참조들 제거하여 Vercel Edge Runtime 호환성 확보

  // 시간 포맷팅 (MM:SS)
  const formatTime = useCallback((milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // 남은 시간 퍼센트 계산
  const getRemainingPercentage = useCallback(() => {
    if (!isSystemStarted) return 0;
    return (remainingTime / SYSTEM_AUTO_SHUTDOWN_TIME) * 100;
  }, [isSystemStarted, remainingTime]);

  // 로컬 스토리지에서 이전 종료 시간 확인
  const checkPreviousShutdown = useCallback(() => {
    const autoShutdown = localStorage.getItem('system_auto_shutdown');
    const shutdownTime = localStorage.getItem('system_shutdown_time');

    if (autoShutdown === 'true' && shutdownTime) {
      const timeSinceShutdown = Date.now() - new Date(shutdownTime).getTime();
      if (timeSinceShutdown < 60 * 60 * 1000) {
        // 1시간 이내
        return timeSinceShutdown;
      }
    }

    return null;
  }, []);

  // 초기 로드 시 이전 종료 확인
  useEffect(() => {
    const timeSinceShutdown = checkPreviousShutdown();
    if (timeSinceShutdown !== null) {
      const minutes = Math.floor(timeSinceShutdown / 60000);
      logger.info(`📊 이전 자동 종료로부터 ${minutes}분 경과`);
    }
  }, [checkPreviousShutdown]);

  return {
    isSystemActive: isSystemStarted,
    remainingTime,
    isWarning,
    formatTime,
    getRemainingPercentage,
    // UI 표시용 정보
    remainingMinutes: Math.floor(remainingTime / 60000),
    remainingSeconds: Math.floor((remainingTime % 60000) / 1000),
  };
}
