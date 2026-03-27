import { useEffect, useMemo, useRef, useState } from 'react';
import { isGuestSystemStartEnabled } from '@/config/guestMode';
import { isVercel } from '@/env-client';
import { useInitialAuth } from '@/hooks/useInitialAuth';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import debug from '@/utils/debug';
import {
  authRetryDelay,
  debugWithEnv,
  mountDelay,
  syncDebounce,
} from '@/utils/vercel-env-utils';
import {
  performanceTracker,
  preloadCriticalResources,
} from '@/utils/vercel-optimization';
import { useSystemStart } from './useSystemStart';

export function useLandingPageState() {
  const {
    isLoading: authLoading,
    isAuthenticated,
    user: currentUser,
    isGitHubConnected: isGitHubUser,
    error: authError,
    isReady: authReady,
    getLoadingMessage,
    retry: retryAuth,
  } = useInitialAuth();

  const [isMounted, setIsMounted] = useState(false);

  const isGuestUser = useMemo(
    () => currentUser?.provider === 'guest',
    [currentUser]
  );
  const isGuestSystemStartEnabledValue = useMemo(
    () => isGuestSystemStartEnabled(),
    []
  );

  const canAccessDashboard = useMemo(
    () => isAuthenticated && (!isGuestUser || isGuestSystemStartEnabledValue),
    [isAuthenticated, isGuestUser, isGuestSystemStartEnabledValue]
  );

  const {
    systemStartCountdown,
    isSystemStarting,
    isSystemStarted,
    multiUserStatus,
    guestRestrictionReason,
    showGuestRestriction,
    dismissGuestRestriction,
    statusInfo,
    buttonConfig,
    handleSystemToggle,
    navigateToDashboard,
  } = useSystemStart({
    isAuthenticated,
    isGitHubUser,
    isGuestUser,
    isGuestSystemStartEnabled: isGuestSystemStartEnabledValue,
    authLoading,
    isMounted,
  });
  const shouldShowSystemStart = !isSystemStarted || !isAuthenticated;

  const { startSystem, stopSystem, getSystemRemainingTime } =
    useUnifiedAdminStore();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevRunningRef = useRef<boolean | null>(null);
  const [_systemTimeRemaining, setSystemTimeRemaining] = useState(0);

  useEffect(() => {
    if (isVercel) performanceTracker.start('page-mount');

    const mountTimer = setTimeout(() => {
      setIsMounted(true);
      debug.log(debugWithEnv('✅ 클라이언트 마운트 완료'), { isVercel });
      if (isVercel) {
        void preloadCriticalResources();
        performanceTracker.end('page-mount');
      }
    }, mountDelay);

    return () => clearTimeout(mountTimer);
  }, []);

  useEffect(() => {
    if (!authReady || !multiUserStatus) return;
    const currentRunning = multiUserStatus.isRunning;
    if (prevRunningRef.current !== currentRunning) {
      prevRunningRef.current = currentRunning;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        const needsStart = multiUserStatus.isRunning && !isSystemStarted;
        const needsStop = !multiUserStatus.isRunning && isSystemStarted;
        if (needsStart) {
          debug.log(debugWithEnv('🔄 시스템이 다른 사용자에 의해 시작됨'));
          startSystem();
        } else if (needsStop) {
          debug.log(debugWithEnv('🔄 시스템이 다른 사용자에 의해 정지됨'));
          stopSystem();
        }
      }, syncDebounce);
    }

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [authReady, multiUserStatus, isSystemStarted, startSystem, stopSystem]);

  useEffect(() => {
    if (!authError || !authReady) return;
    debug.error(debugWithEnv('❌ 인증 에러 발생'), authError);
    const authRetryTimeout = setTimeout(() => {
      debug.log(
        debugWithEnv(`🔄 인증 재시도 시작 (${authRetryDelay / 1000}초 후)`)
      );
      retryAuth();
    }, authRetryDelay);

    return () => clearTimeout(authRetryTimeout);
  }, [authError, authReady, retryAuth]);

  useEffect(() => {
    if (!isSystemStarted) {
      setSystemTimeRemaining(0);
      return;
    }

    const timerInterval = setInterval(() => {
      setSystemTimeRemaining(getSystemRemainingTime());
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [isSystemStarted, getSystemRemainingTime]);

  return {
    authError,
    canAccessDashboard,
    buttonConfig,
    dismissGuestRestriction,
    getLoadingMessage,
    guestRestrictionReason,
    handleSystemToggle,
    isMounted,
    isSystemStarted,
    isSystemStarting,
    multiUserStatus,
    navigateToDashboard,
    retryAuth,
    shouldShowLoading: !authReady,
    shouldShowSystemStart,
    showGuestRestriction,
    statusInfo,
    stopSystem,
    systemStartCountdown,
  };
}
