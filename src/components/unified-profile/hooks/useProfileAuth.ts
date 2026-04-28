import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { signOut, useSession } from '@/hooks/useSupabaseSession';
import { authStateManager, clearAuthData } from '@/lib/auth/auth-state-manager';
import {
  AUTH_SESSION_ID_KEY,
  AUTH_TYPE_KEY,
  AUTH_USER_KEY,
  LEGACY_GUEST_SESSION_COOKIE_KEY,
} from '@/lib/auth/guest-session-utils';
import { logger } from '@/lib/logging';
// Unused imports removed: getCurrentUser, isGitHubAuthenticated, isGuestUser
import type {
  ProfileAuthHook,
  UserInfo,
  UserType,
} from '../types/profile.types';

/**
 * 프로필 인증 관련 커스텀 훅
 * 사용자 정보, 인증 상태 관리
 */
export function useProfileAuth(): ProfileAuthHook {
  const router = useRouter();
  const { status } = useSession();

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userType, setUserType] = useState<UserType>('unknown');
  const [isLoading, setIsLoading] = useState(true);

  // 사용자 정보 로드 (Promise.all 병렬 처리로 150ms 최적화)
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        setIsLoading(true);

        // 🚀 AuthStateManager를 통한 통합 인증 상태 확인 - 정확한 타입 감지
        // 캐시된 상태 사용 (5초 TTL) - 중복 API 호출 방지
        // 캐시 무효화는 로그인/로그아웃 액션 시에만 수행
        const authState = await authStateManager.getAuthState();

        // AuthStateManager의 결과를 직접 사용 (더 정확함)
        setUserInfo(authState.user);
        setUserType(
          authState.type === 'github'
            ? 'github'
            : authState.type === 'google'
              ? 'google'
              : authState.type === 'guest'
                ? 'guest'
                : 'unknown'
        );

        logger.info('👤 사용자 정보 로드 (AuthStateManager 통합):', {
          user: authState.user,
          type: authState.type,
          isAuthenticated: authState.isAuthenticated,
          sessionStatus: status,
        });
      } catch (error) {
        logger.error('❌ 사용자 정보 로드 실패:', error);
        setUserType('unknown');
      } finally {
        setIsLoading(false);
      }
    };

    if (status !== 'loading') {
      void loadUserInfo();
    }
  }, [status]); // session 제거하여 무한 루프 방지

  /**
   * 통합 로그아웃 처리 (AuthStateManager 사용)
   */
  const handleLogout = useCallback(async () => {
    const userTypeLabel = userType === 'github' ? 'GitHub' : '게스트';
    logger.info('🚪 handleLogout 호출됨:', { userType, userTypeLabel });

    const confirmed = confirm(
      `🚪 ${userTypeLabel} 계정에서 로그아웃하시겠습니까?`
    );

    if (!confirmed) {
      logger.info('🚪 사용자가 로그아웃 취소');
      return false;
    }

    try {
      logger.info('🚪 통합 로그아웃 시작:', { userType });

      // React 상태 즉시 업데이트 (UI 반응성 향상)
      setUserInfo(null);
      setUserType('unknown');
      setIsLoading(true);

      // AuthStateManager를 통한 통합 로그아웃
      logger.info('🔄 AuthStateManager clearAuthData 호출 중...');
      await clearAuthData(userType === 'github' ? 'github' : 'guest');

      logger.info('✅ 통합 로그아웃 완료 - 리다이렉트 진행');

      // 로그인 페이지로 리다이렉트
      router.replace('/login');
      return true;
    } catch (error) {
      logger.error('❌ 통합 로그아웃 실패:', error);

      // Fallback: 레거시 로그아웃 로직
      logger.warn('⚠️ 레거시 로그아웃으로 fallback');

      try {
        // Supabase 로그아웃 (GitHub)
        if (userType === 'github') {
          await signOut({ callbackUrl: '/login' });
        } else {
          // 게스트 로그아웃은 AuthStateManager가 실패했으므로 수동 정리
          if (typeof window !== 'undefined') {
            localStorage.removeItem('admin_mode');
            localStorage.removeItem(AUTH_SESSION_ID_KEY);
            localStorage.removeItem(AUTH_TYPE_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
          }

          if (typeof document !== 'undefined') {
            document.cookie = `${AUTH_SESSION_ID_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            document.cookie = `${AUTH_TYPE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
            document.cookie = `${LEGACY_GUEST_SESSION_COOKIE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
          }
        }
      } catch (fallbackError) {
        logger.error('❌ 레거시 로그아웃도 실패:', fallbackError);
      }

      // 실패해도 로그인 페이지로 강제 이동
      router.replace('/login');
      return false;
    }
  }, [router, userType]);

  // 비활성 타이머는 사용하지 않음 (max-lines-per-function 경고 해결)

  /**
   * 페이지 이동 핸들러들
   */
  const navigateToLogin = useCallback(() => {
    logger.info('🚀 navigateToLogin 호출됨 - /login으로 이동');
    router.replace('/login');
  }, [router]);

  const navigateToDashboard = useCallback(() => {
    logger.info('🚀 navigateToDashboard 호출됨 - /dashboard로 이동');
    router.replace('/dashboard');
  }, [router]);

  return {
    userInfo,
    userType,
    isLoading,
    status,
    handleLogout,
    navigateToLogin,
    navigateToDashboard,
  };
}
