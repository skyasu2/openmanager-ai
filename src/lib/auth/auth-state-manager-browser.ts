import { logger } from '@/lib/logging';
import type { AuthState } from './auth-state-manager-types';

// 통일된 키 접두사
const AUTH_PREFIX = 'auth_';

// 세션 최대 유효 기간: 7일 (밀리초)
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 브라우저 호환 세션 ID 생성
 * - Web Crypto API 사용 (모든 현대 브라우저 지원)
 * - 폴백: Math.random 기반 생성
 */
export function generateClientSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 14)}`;
}

/**
 * 레거시 키 마이그레이션 (기존 사용자 자동 전환)
 */
export function migrateLegacyAuthCookieKeys(): void {
  try {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';').map((c) => c.trim());
      const legacySessionCookie = cookies.find((c) =>
        c.startsWith('guest_session_id=')
      );

      if (
        legacySessionCookie &&
        !cookies.find((c) => c.startsWith('auth_session_id='))
      ) {
        const sessionId = legacySessionCookie.split('=')[1];
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        document.cookie = `auth_session_id=${sessionId}; path=/; expires=${expires.toUTCString()}; Secure; SameSite=Strict`;
        document.cookie = `guest_session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict`;
        logger.info('🔐 쿠키 마이그레이션: guest_session_id → auth_session_id');
      }
    }
  } catch (error) {
    logger.warn('⚠️ 레거시 키 마이그레이션 실패:', error);
  }
}

export function getGuestAuthState(
  onInvalidGuestSession: () => void
): AuthState {
  if (typeof window !== 'undefined') {
    const authType = localStorage.getItem('auth_type');
    const sessionId = localStorage.getItem('auth_session_id');
    const userStr = localStorage.getItem('auth_user');
    const createdAtStr = localStorage.getItem('auth_created_at');

    if (authType === 'guest' && sessionId && userStr) {
      if (createdAtStr) {
        const createdAt = Number.parseInt(createdAtStr, 10);
        if (Number.isNaN(createdAt)) {
          logger.warn('⚠️ 유효하지 않은 세션 생성 시간 - 세션 정리');
          onInvalidGuestSession();
          return {
            user: null,
            type: 'unknown',
            isAuthenticated: false,
          };
        }

        const now = Date.now();
        const age = now - createdAt;
        if (age > SESSION_MAX_AGE_MS) {
          logger.info('🔐 세션 만료됨 (7일 초과) - 자동 로그아웃');
          onInvalidGuestSession();
          return {
            user: null,
            type: 'unknown',
            isAuthenticated: false,
          };
        }
      }

      try {
        const user = JSON.parse(userStr);
        return {
          user: { ...user, provider: 'guest' },
          type: 'guest',
          isAuthenticated: true,
          sessionId: `${sessionId.substring(0, 8)}...`,
        };
      } catch (error) {
        logger.warn('⚠️ 게스트 사용자 정보 파싱 실패:', error);
      }
    }
  }

  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';').map((c) => c.trim());
    const sessionCookie = cookies.find((c) => c.startsWith('auth_session_id='));
    const authTypeCookie = cookies.find((c) => c.startsWith('auth_type=guest'));

    if (sessionCookie && authTypeCookie) {
      const sessionId = sessionCookie.split('=')[1];
      return {
        user: {
          id: sessionId || `guest_${Date.now()}`,
          name: '게스트 사용자',
          provider: 'guest',
        },
        type: 'guest',
        isAuthenticated: true,
        sessionId: `${sessionId?.substring(0, 8)}...`,
      };
    }
  }

  return {
    user: null,
    type: 'unknown',
    isAuthenticated: false,
  };
}

/**
 * 통합 저장소 정리 (localStorage + sessionStorage + 쿠키)
 */
export function clearBrowserAuthStorage(authType?: 'github' | 'guest'): void {
  if (typeof window === 'undefined') return;

  const keysToRemove = Object.keys(localStorage).filter((key) => {
    if (key.startsWith(AUTH_PREFIX)) return true;

    if (!authType || authType === 'github') {
      if (
        key.startsWith('sb-') ||
        key.includes('supabase') ||
        key.includes('github') ||
        key.startsWith('supabase.auth.') ||
        key.includes('access_token') ||
        key.includes('refresh_token')
      )
        return true;
    }

    if (
      key === 'admin_mode' ||
      key === 'admin_failed_attempts' ||
      key === 'admin_lock_end_time'
    )
      return true;

    return false;
  });

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    logger.info(`🧹 localStorage 정리: ${key}`);
  });

  if (
    typeof sessionStorage !== 'undefined' &&
    (!authType || authType === 'github')
  ) {
    Object.keys(sessionStorage)
      .filter(
        (key) =>
          key.includes('supabase') ||
          key.includes('github') ||
          key.includes('auth')
      )
      .forEach((key) => {
        sessionStorage.removeItem(key);
        logger.info(`🧹 sessionStorage 정리: ${key}`);
      });
  }

  if (typeof document !== 'undefined') {
    const isTestMode =
      document.cookie.includes('test_mode=enabled') &&
      document.cookie.includes('vercel_test_token=');

    const cookiesToClear = ['auth_session_id', 'auth_type'];
    if (!isTestMode) {
      cookiesToClear.push('test_mode', 'vercel_test_token');
    } else {
      logger.info('🧪 테스트 모드 감지 - 테스트 쿠키 보존');
    }

    const isProduction = window.location.protocol === 'https:';
    const secureFlag = isProduction ? '; Secure' : '';

    cookiesToClear.forEach((cookie) => {
      document.cookie = `${cookie}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}; SameSite=Lax`;
      logger.info(`🧹 쿠키 정리: ${cookie}`);
    });
  }
}
