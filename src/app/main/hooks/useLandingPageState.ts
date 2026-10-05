import { useEffect, useMemo, useState } from 'react';
import { isGuestSystemStartEnabled } from '@/config/guestMode';
import { isVercel } from '@/env-client';
import { useInitialAuth } from '@/hooks/auth/useInitialAuth';
import { useSyncSystemWindow } from '@/hooks/system/useSyncSystemWindow';
import { useUnifiedAdminStore } from '@/stores/useUnifiedAdminStore';
import debug from '@/utils/debug';
import {
  authRetryDelay,
  debugWithEnv,
  mountDelay,
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

  const { getSystemRemainingTime } = useUnifiedAdminStore();
  const [_systemTimeRemaining, setSystemTimeRemaining] = useState(0);

  useSyncSystemWindow(authReady ? multiUserStatus : null);

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
    // 랜딩 최초 진입에서 full-screen loading -> Home 전환이 main 영역 CLS를 유발해
    // 로딩 상태는 인라인 스켈레톤으로 흡수하고 전체 레이아웃 스왑은 피한다.
    shouldShowLoading: false,
    shouldShowSystemStart,
    showGuestRestriction,
    statusInfo,
    systemStartCountdown,
  };
}
