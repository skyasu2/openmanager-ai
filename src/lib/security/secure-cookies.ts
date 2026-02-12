/**
 * 🔐 보안 쿠키 유틸리티 - Vercel 환경 최적화
 *
 * AI 교차검증 기반 보안 강화:
 * - HttpOnly는 클라이언트에서 설정 불가하므로 제외
 * - Secure 플래그는 HTTPS 환경에서만 적용
 * - SameSite=Strict로 CSRF 공격 방지
 */

/**
 * Vercel 환경 감지
 */
import { logger } from '@/lib/logging';
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

    // 🔧 Vercel 패턴 매칭 개선
    const isVercelDeploy =
      hostname === 'openmanager-ai.vercel.app' || // 프로덕션
      (hostname.startsWith('openmanager-ai-') &&
        hostname.endsWith('.vercel.app')) || // 프리뷰 배포
      hostname.includes('-skyasus-projects.vercel.app'); // 사용자별 배포

    const isLocalDev =
      hostname === 'localhost' &&
      (urlObj.port === '3000' || urlObj.port === '3001');

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
   * 게스트 세션 ID 설정 (auth_* 통일 체계)
   */
  setGuestSession(sessionId: string): void {
    setSecureCookie('auth_session_id', sessionId, 24 * 60 * 60); // 24시간
    setSecureCookie('auth_type', 'guest', 24 * 60 * 60); // 통일 체계
  },

  /**
   * 게스트 세션 삭제 (통일 체계 쿠키 정리)
   */
  clearGuestSession(): void {
    deleteSecureCookie('auth_session_id');
    deleteSecureCookie('auth_type');
  },

  /**
   * 게스트 세션 확인 (통일 체계)
   */
  hasGuestSession(): boolean {
    if (typeof document === 'undefined') return false;

    const cookies = document.cookie.split(';').map((c) => c.trim());

    const hasSessionId = cookies.some((c) => c.startsWith('auth_session_id='));
    const hasAuthType = cookies.some((c) => c.startsWith('auth_type=guest'));

    return hasSessionId && hasAuthType;
  },
};
