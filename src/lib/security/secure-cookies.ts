/**
 * 🔐 보안 쿠키 유틸리티 - Vercel 환경 최적화
 *
 * AI 교차검증 기반 보안 강화:
 * - HttpOnly는 클라이언트에서 설정 불가하므로 제외
 * - Secure 플래그는 HTTPS 환경에서만 적용
 * - SameSite=Strict로 CSRF 공격 방지
 */

import {
  AUTH_SESSION_ID_KEY,
  AUTH_TYPE_KEY,
  hasGuestSessionCookieHeader,
} from '@/lib/auth/guest-session-utils';
/**
 * Vercel 환경 감지
 */
import { logger } from '@/lib/logging';
import { getSiteUrl } from '@/lib/site-url';
export function isVercelEnvironment(): boolean {
  if (typeof window !== 'undefined') {
    return (
      window.location.hostname.includes('vercel.app') ||
      window.location.hostname.includes('.vercel.app')
    );
  }
  return process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
}

/**
 * HTTPS 환경 감지
 */
export function isSecureEnvironment(): boolean {
  if (typeof window !== 'undefined') {
    return window.location.protocol === 'https:';
  }
  return process.env.NODE_ENV === 'production';
}

/**
 * 보안 쿠키 설정 생성
 */
export function getSecureCookieOptions(maxAge?: number): string {
  const options = ['path=/'];

  if (maxAge) {
    options.push(`max-age=${maxAge}`);
  }

  // 🔒 보안 플래그들
  if (isSecureEnvironment()) {
    options.push('Secure'); // HTTPS에서만
  }

  // 🛡️ CSRF 방지 - 가장 엄격한 설정
  options.push('SameSite=Strict');

  return options.join('; ');
}

/**
 * 보안 쿠키 설정
 */
export function setSecureCookie(
  name: string,
  value: string,
  maxAge?: number
): void {
  if (typeof document === 'undefined') return;

  const cookieString = `${name}=${value}; ${getSecureCookieOptions(maxAge)}`;
  document.cookie = cookieString;

  logger.info(`🍪 보안 쿠키 설정: ${name}`, {
    secure: isSecureEnvironment(),
    sameSite: 'Strict',
    environment: isVercelEnvironment() ? 'Vercel' : 'Local',
  });
}

/**
 * 보안 쿠키 삭제
 */
export function deleteSecureCookie(name: string): void {
  if (typeof document === 'undefined') return;

  const expireOptions = getSecureCookieOptions().replace(
    'max-age=',
    'expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; '
  );
  document.cookie = `${name}=; ${expireOptions}`;

  logger.info(`🗑️ 보안 쿠키 삭제: ${name}`);
}

/**
 * OAuth 리다이렉트 URL 검증
 */
export function validateRedirectUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const productionHost = new URL(getSiteUrl()).hostname;

    // 🔧 Vercel 패턴 매칭 개선
    const isVercelDeploy =
      hostname === productionHost || // 프로덕션(커스텀 도메인 포함)
      (hostname.startsWith('openmanager-ai-') &&
        hostname.endsWith('.vercel.app')) || // 프리뷰 배포
      hostname.includes('-skyasus-projects.vercel.app'); // 사용자별 배포

    const isLoopbackHost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isLocalDev =
      isLoopbackHost && (urlObj.port === '3000' || urlObj.port === '3001');

    const isAllowed = isVercelDeploy || isLocalDev;

    // 🔧 프로덕션에서만 로그 출력하도록 조건부 로깅
    if (process.env.NODE_ENV === 'development') {
      logger.info(`🔍 OAuth URL 검증: ${url}`, {
        hostname,
        port: urlObj.port,
        isVercelDeploy,
        isLocalDev,
        isAllowed,
      });
    }

    return isAllowed;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      logger.error('❌ URL 검증 실패:', error);
    }
    return false;
  }
}

/**
 * 게스트 세션용 보안 쿠키 관리 (AuthStateManager 키 체계 일치)
 */
export const guestSessionCookies = {
  /**
   * 게스트 세션 ID 설정 (auth_session_id 단일 체계)
   */
  setGuestSession(sessionId: string): void {
    setSecureCookie(AUTH_SESSION_ID_KEY, sessionId, 24 * 60 * 60); // 24시간
  },

  /**
   * 게스트 세션 삭제 (레거시 키 포함 정리)
   */
  clearGuestSession(): void {
    deleteSecureCookie(AUTH_SESSION_ID_KEY);
    deleteSecureCookie(AUTH_TYPE_KEY);
  },

  /**
   * 게스트 세션 확인 (통일 체계)
   */
  hasGuestSession(): boolean {
    if (typeof document === 'undefined') return false;

    return hasGuestSessionCookieHeader(document.cookie);
  },
};
