'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isVercel } from '@/env-client';
import { getAuthState } from '@/lib/auth/auth-state-manager';
import type { AuthUser } from '@/lib/auth/auth-state-manager-types';
import { logger } from '@/lib/logging';

// This logic is now inlined from the old vercel-env.ts
// 깜빡임 방지: 지연 제거 (이전: isVercel ? 300 : 100)
const initDelay = 0;
// 🔧 인증 체크 타임아웃: 3초 (Vercel) / 2초 (로컬)
const AUTH_TIMEOUT_MS = isVercel ? 3000 : 2000;
const debugWithEnv = (message: string) =>
  `[${isVercel ? 'Vercel' : 'Local'}] ${message}`;

// 초기화 상태 타입 정의
export interface InitialAuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  isGitHubConnected: boolean;
  error: string | null;
  currentStep:
    | 'init'
    | 'auth-check'
    | 'user-fetch'
    | 'github-check'
    | 'complete';
}

// 초기화 상태 초기값
const initialState: InitialAuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
  isGitHubConnected: false,
  error: null,
  currentStep: 'init',
};

/**
 * 통합 초기화 훅 - 모든 인증 및 사용자 정보를 단일 프로세스로 처리
 * 5-6초 다단계 로딩 화면 문제 해결
 */
export function useInitialAuth() {
  const [state, setState] = useState<InitialAuthState>(initialState);
  const pathname = usePathname();
  const initRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 상태 업데이트 헬퍼
  const updateState = useCallback((updates: Partial<InitialAuthState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // 통합 초기화 프로세스
  const initializeAuth = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;

    try {
      updateState({ currentStep: 'auth-check', isLoading: true });
      logger.info(debugWithEnv('🔄 인증 상태 확인 중...'));

      // 🔧 타임아웃이 있는 인증 체크 - 느린 네트워크에서도 빠르게 페이지 표시
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)
      );

      const authState = await Promise.race([getAuthState(), timeoutPromise]);

      // 타임아웃 발생 시 비인증 상태로 페이지 표시
      if (!authState) {
        logger.warn(
          debugWithEnv(
            `⏱️ 인증 체크 타임아웃 (${AUTH_TIMEOUT_MS}ms) - 비인증 상태로 진행`
          )
        );
        updateState({
          currentStep: 'complete',
          isLoading: false,
          isAuthenticated: false,
          user: null,
          isGitHubConnected: false,
          error: null,
        });
        return;
      }

      const user = authState.user;

      // provider 정보는 authState에서 직접 추출 (isGitHubAuthenticated() 불필요)
      const isGitHubUser =
        user?.provider === 'github' || authState.type === 'github';

      logger.info(debugWithEnv('📊 인증 결과'), {
        hasUser: !!user,
        userType: user?.provider,
        authType: authState.type,
        userName: user?.name,
        userEmail: user?.email,
        userId: user?.id,
        isGitHubUser,
        currentPath: pathname,
      });

      const isActuallyGitHubUser = isGitHubUser;

      updateState({
        currentStep: 'complete',
        isLoading: false,
        isAuthenticated: !!user,
        user,
        isGitHubConnected: isActuallyGitHubUser,
        error: null,
      });

      logger.info(debugWithEnv('🔧 인증 상태 확정:'), {
        authType: authState.type,
        userProvider: user?.provider,
        finalGitHubStatus: isActuallyGitHubUser,
      });

      // 비로그인 상태에서도 메인 페이지 표시 (로그인 버튼으로 유도)
      if (!user) {
        logger.info(
          debugWithEnv('ℹ️ 비로그인 상태 - 메인 페이지에서 로그인 버튼 표시')
        );
      } else {
        logger.info(
          debugWithEnv('✅ 인증 성공'),
          user.name,
          `(${user.provider})`
        );
      }
    } catch (error) {
      logger.error('Authentication initialization failed:', error);
      updateState({
        currentStep: 'complete',
        isLoading: false,
        isAuthenticated: false,
        user: null,
        isGitHubConnected: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      });
      // 에러 발생 시에도 메인 페이지에서 로그인 버튼 표시 (리다이렉트 제거)
      logger.info(
        debugWithEnv('⚠️ 인증 에러 - 메인 페이지에서 로그인 버튼 표시')
      );
    }
  }, [pathname, updateState]);

  useEffect(() => {
    logger.info(debugWithEnv('🔄 useInitialAuth 초기화 시작'));

    const timeoutId = setTimeout(() => {
      if (initRef.current) {
        logger.info(
          debugWithEnv('🚫 useInitialAuth: 이미 초기화 중이므로 스킵')
        );
        return;
      }
      void initializeAuth();
    }, initDelay);

    return () => {
      clearTimeout(timeoutId);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      logger.info(debugWithEnv('🧹 useInitialAuth 타이머 정리 완료'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeAuth]);

  useEffect(() => {
    return () => {
      initRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const retry = useCallback(() => {
    initRef.current = false;
    setState(initialState);
    void initializeAuth();
  }, [initializeAuth]);

  const getLoadingMessage = useCallback(() => {
    switch (state.currentStep) {
      case 'init':
        return '초기화 중...';
      case 'auth-check':
      case 'user-fetch':
      case 'github-check':
        return '인증 확인 중...';
      default:
        return '로딩 중...';
    }
  }, [state.currentStep]);

  return {
    ...state,
    retry,
    getLoadingMessage,
    isReady: state.currentStep === 'complete' && !state.isLoading,
    shouldRedirect: false, // 비로그인 상태에서도 메인 페이지 표시 (리다이렉트 비활성화)
  };
}

export default useInitialAuth;
