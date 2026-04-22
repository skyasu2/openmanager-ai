/**
 * 🔐 useAuth - 게스트 인증 훅
 *
 * OpenManager AI 게스트 인증 시스템 (Google OAuth 제거됨)
 */

import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@/lib/auth/auth-state-manager-types';
import {
  AUTH_SESSION_ID_KEY,
  AUTH_TYPE_KEY,
  AUTH_USER_KEY,
  hasGuestStorageState,
} from '@/lib/auth/guest-session-utils';
import { logger } from '@/lib/logging';

// Safe localStorage access helpers (SSR compatible)
function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
  } catch {
    logger.warn(`[useAuth] localStorage.getItem('${key}') failed`);
  }
  return null;
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(key);
    }
  } catch {
    logger.warn(`[useAuth] localStorage.removeItem('${key}') failed`);
  }
}

export interface UseAuthResult {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionId: string | null;
  login: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 로그인 함수 (게스트 모드만 지원)
  const login = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);

      // 게스트 사용자 생성
      const guestUser: AuthUser = {
        id: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: '게스트 사용자',
        email: `guest_${Date.now()}@example.com`,
        provider: 'guest',
      };

      // AuthStateManager를 통한 게스트 인증 설정
      const { authStateManager } = await import(
        '@/lib/auth/auth-state-manager'
      );
      await authStateManager.setGuestAuth(guestUser);

      // 세션 ID 가져오기 (safe access)
      const newSessionId =
        safeGetItem(AUTH_SESSION_ID_KEY) || `guest_${Date.now()}`;

      setUser(guestUser);
      setSessionId(newSessionId);

      return { success: true };
    } catch (error) {
      logger.error('로그인 실패:', error);
      return { success: false, error: '로그인 중 오류가 발생했습니다.' };
    } finally {
      setIsLoading(false);
    }
  };

  // 로그아웃 함수
  const logout = async (): Promise<void> => {
    try {
      if (sessionId) {
        const { authStateManager } = await import(
          '@/lib/auth/auth-state-manager'
        );
        await authStateManager.clearAllAuthData();
      }

      // 상태 초기화
      setUser(null);
      setSessionId(null);

      // 로컬 스토리지 정리 (safe access)
      safeRemoveItem(AUTH_SESSION_ID_KEY);
      safeRemoveItem(AUTH_TYPE_KEY);
      safeRemoveItem(AUTH_USER_KEY);

      logger.info('로그아웃 완료');
    } catch (error) {
      logger.error('로그아웃 실패:', error);
    }
  };

  // 인증 상태 확인
  const checkAuth = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Safe localStorage access (SSR compatible)
      const storedSessionId = safeGetItem(AUTH_SESSION_ID_KEY);
      const authType = safeGetItem(AUTH_TYPE_KEY);
      const storedUser = safeGetItem(AUTH_USER_KEY);

      if (
        !hasGuestStorageState({
          sessionId: storedSessionId,
          authType,
          userJson: storedUser,
        })
      ) {
        setUser(null);
        setSessionId(null);
        return;
      }

      // 세션 유효성 확인 (getAuthState가 만료/무효 세션을 내부적으로 검증)
      const { authStateManager } = await import(
        '@/lib/auth/auth-state-manager'
      );
      const currentState = await authStateManager.getAuthState();

      if (currentState.isAuthenticated) {
        setUser(currentState.user);
        setSessionId(storedSessionId);
      } else {
        // 세션이 만료된 경우 로컬 스토리지 정리 (safe access)
        safeRemoveItem(AUTH_SESSION_ID_KEY);
        safeRemoveItem(AUTH_TYPE_KEY);
        safeRemoveItem(AUTH_USER_KEY);
        setUser(null);
        setSessionId(null);
      }
    } catch (error) {
      logger.error('인증 상태 확인 실패:', error);
      setUser(null);
      setSessionId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 권한 확인 함수
  // 🎯 의도적 설계: 데모/포트폴리오 목적으로 인증된 사용자에게 모든 권한 부여
  // 엔터프라이즈 배포 시 아래 주석 코드로 교체하여 권한 제한 적용
  const hasPermission = (_permission: string): boolean => {
    if (!user) return false;

    // 데모 모드: 인증된 사용자 전체 권한 허용
    return true;

    /* [엔터프라이즈 전환용] 권한 기반 접근 제어
    const guestPermissions = [
      'view_dashboard',
      'view_servers',
      'view_metrics',
      'basic_actions',
    ];
    return guestPermissions.includes(permission);
    */
  };

  // 컴포넌트 마운트 시 인증 상태 확인
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  return {
    user,
    isLoading,
    isAuthenticated: user !== null,
    sessionId,
    login,
    logout,
    checkAuth,
    hasPermission,
  };
}
