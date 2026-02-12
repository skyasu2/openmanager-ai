/**
 * 🔐 Auto Logout Hook
 *
 * OpenManager AI 자동 로그아웃 시스템 (Google OAuth 제거됨)
 */

'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logging';

interface UseAutoLogoutOptions {
  /** 비활성 시간 (밀리초) */
  inactivityTimeout?: number;
  /** 경고 시간 (밀리초) */
  warningTimeout?: number;
  /** 로그아웃 후 리다이렉트 경로 */
  redirectPath?: string;
  /** 경고 콜백 */
  onWarning?: () => void;
  /** 로그아웃 콜백 */
  onLogout?: () => void;
  /** 타임아웃 시간 (분) */
  timeoutMinutes?: number;
  /** 경고 시간 (분) */
  warningMinutes?: number;
}

export function useAutoLogout({
  inactivityTimeout = 30 * 60 * 1000, // 30분
  warningTimeout = 5 * 60 * 1000, // 5분 전 경고
  redirectPath = '/login',
  onWarning,
  onLogout,
  timeoutMinutes: _timeoutMinutes = 30,
  warningMinutes: _warningMinutes = 5,
}: UseAutoLogoutOptions = {}) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [remainingTime, setRemainingTime] = useState(inactivityTimeout);
  const [isWarning, setIsWarning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // 자동 로그아웃 처리 (resetTimers보다 먼저 정의)
  const handleAutoLogout = useCallback(async () => {
    try {
      onLogout?.();

      // 게스트 모드 - 로컬 스토리지 정리 (SSR 안전)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_session_id');
        localStorage.removeItem('auth_type');
      }
      setIsLoggedIn(false);
      router.push(redirectPath);

      logger.info('🔐 자동 로그아웃 완료');
    } catch (error) {
      logger.error('❌ 자동 로그아웃 실패:', error);
      // 실패해도 로그인 페이지로 이동
      router.push(redirectPath);
    }
  }, [onLogout, router, redirectPath]);

  // 타이머 초기화
  const resetTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    setIsWarning(false);
    setRemainingTime(inactivityTimeout);

    // 로그인된 사용자만 타이머 설정
    if (isLoggedIn) {
      // 경고 타이머
      warningTimeoutRef.current = setTimeout(() => {
        setIsWarning(true);
        onWarning?.();
      }, inactivityTimeout - warningTimeout);

      // 로그아웃 타이머
      timeoutRef.current = setTimeout(() => {
        void handleAutoLogout();
      }, inactivityTimeout);
    }
  }, [
    inactivityTimeout,
    warningTimeout,
    isLoggedIn,
    onWarning,
    handleAutoLogout,
  ]);

  // 활동 업데이트
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    resetTimers();
  }, [resetTimers]);

  // 강제 로그아웃
  const forceLogout = useCallback(async () => {
    try {
      await handleAutoLogout();
    } catch (error) {
      logger.error('❌ 강제 로그아웃 실패:', error);
    }
  }, [handleAutoLogout]);

  // 수동 로그아웃
  const logout = async () => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }

      await handleAutoLogout();
    } catch (error) {
      logger.error('❌ 수동 로그아웃 실패:', error);
    }
  };

  // 활동 감지 이벤트 리스너
  useEffect(() => {
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 1000) {
        updateActivity();
      }
    };

    // 이벤트 리스너 등록
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    // 초기 타이머 설정
    resetTimers();

    return () => {
      // 이벤트 리스너 제거
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });

      // 타이머 정리
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // 초기 타이머 설정
    resetTimers,
    updateActivity,
  ]); // resetTimers, updateActivity는 ref 기반으로 안정적

  // 로그인 상태 확인
  useEffect(() => {
    const checkAuthStatus = () => {
      // SSR 안전성 체크
      if (typeof window === 'undefined') {
        setIsLoggedIn(false);
        return;
      }

      const sessionId = localStorage.getItem('auth_session_id');
      const authType = localStorage.getItem('auth_type');
      setIsLoggedIn(!!sessionId && authType === 'guest');
    };

    checkAuthStatus();

    // 주기적으로 상태 확인 (1초 → 10초로 최적화)
    const interval = setInterval(checkAuthStatus, 10000);

    return () => clearInterval(interval);
  }, []);

  // 로그인 상태가 변경될 때 타이머 재설정
  useEffect(() => {
    resetTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetTimers]); // resetTimers는 ref 기반으로 안정적

  return {
    logout,
    updateActivity,
    lastActivity: lastActivityRef.current,
    isLoggedIn,
    remainingTime,
    isWarning,
    resetTimer: resetTimers,
    forceLogout,
  };
}
