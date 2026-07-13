import { logger } from '@/lib/logging';
import type { AuthProvider, AuthState } from './auth-state-manager-types';
import {
  AUTH_CREATED_AT_KEY,
  AUTH_SESSION_ID_KEY,
  AUTH_TYPE_KEY,
  AUTH_USER_KEY,
  getGuestSessionIdFromCookieHeader,
  hasGuestStorageState,
  LEGACY_GUEST_SESSION_COOKIE_KEY,
} from './guest-session-utils';

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
        c.startsWith(`${LEGACY_GUEST_SESSION_COOKIE_KEY}=`)
      );

      if (
        legacySessionCookie &&
        !cookies.find((c) => c.startsWith(`${AUTH_SESSION_ID_KEY}=`))
      ) {
        const sessionId = legacySessionCookie.split('=')[1];
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        document.cookie = `${AUTH_SESSION_ID_KEY}=${sessionId}; path=/; expires=${expires.toUTCString()}; Secure; SameSite=Strict`;
        document.cookie = `${LEGACY_GUEST_SESSION_COOKIE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict`;
        logger.info(
          `🔐 쿠키 마이그레이션: ${LEGACY_GUEST_SESSION_COOKIE_KEY} → ${AUTH_SESSION_ID_KEY}`
        );
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
    const authType = localStorage.getItem(AUTH_TYPE_KEY);
    const sessionId = localStorage.getItem(AUTH_SESSION_ID_KEY);
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    const createdAtStr = localStorage.getItem(AUTH_CREATED_AT_KEY);

    if (
      hasGuestStorageState({
        sessionId,
        authType,
        userJson: userStr,
      }) &&
      sessionId
    ) {
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

      if (userStr) {
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

      return {
        user: {
          id: sessionId,
          name: '게스트 사용자',
          provider: 'guest',
        },
        type: 'guest',
        isAuthenticated: true,
        sessionId: `${sessionId.substring(0, 8)}...`,
      };
    }
  }

  if (typeof document !== 'undefined') {
    const sessionId = getGuestSessionIdFromCookieHeader(document.cookie);
    if (sessionId) {
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
export function clearBrowserAuthStorage(
  authType?: AuthProvider,
  skipCookies?: boolean
): void {
  if (typeof window === 'undefined') return;

  const keysToRemove = Object.keys(localStorage).filter((key) => {
    if (key.startsWith(AUTH_PREFIX)) return true;

    if (!authType || authType === 'github' || authType === 'google') {
      if (
        key.startsWith('sb-') ||
        key.includes('supabase') ||
        key.includes('github') ||
        key.includes('google') ||
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
    (!authType || authType === 'github' || authType === 'google')
  ) {
    Object.keys(sessionStorage)
      .filter(
        (key) =>
          key.includes('supabase') ||
          key.includes('github') ||
          key.includes('google') ||
          key.includes('auth')
      )
      .forEach((key) => {
        sessionStorage.removeItem(key);
        logger.info(`🧹 sessionStorage 정리: ${key}`);
      });
  }

  // skipCookies: setGuestAuth() 호출 시 서버 API가 설정한 쿠키를 보존
  if (!skipCookies && typeof document !== 'undefined') {
    const isTestMode =
      document.cookie.includes('test_mode=enabled') &&
      document.cookie.includes('vercel_test_token=');

    const cookiesToClear = [
      AUTH_SESSION_ID_KEY,
      AUTH_TYPE_KEY,
      LEGACY_GUEST_SESSION_COOKIE_KEY,
    ];
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
