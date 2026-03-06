/**
 * 🛡️ CSRF (Cross-Site Request Forgery) 보호
 *
 * Next.js 15 Edge Runtime 호환
 * - 토큰 생성: crypto.randomUUID()
 * - 토큰 검증: 헤더 vs 쿠키 비교
 * - Secure 쿠키 설정
 */

import { NextResponse, type NextRequest } from 'next/server';

/**
 * CSRF 토큰 생성 (32자 랜덤)
 */
export function generateCSRFToken(): string {
  // Edge Runtime에서 사용 가능한 Web Crypto API
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * CSRF 토큰 검증
 *
 * @param request - Next.js Request
 * @returns true if valid, false otherwise
 */
export function verifyCSRFToken(request: NextRequest): boolean {
  // 1. 헤더에서 CSRF 토큰 가져오기
  const headerToken = request.headers.get('X-CSRF-Token');

  // 2. 쿠키에서 CSRF 토큰 가져오기
  const cookieValue = request.cookies.get('csrf_token');
  const cookieToken =
    typeof cookieValue === 'string'
      ? cookieValue
      : (cookieValue as { value?: string } | undefined)?.value;

  // 3. 둘 다 존재하고 일치하는지 확인
  if (!headerToken || !cookieToken) {
    return false;
  }

  return headerToken === cookieToken;
}

/**
 * CSRF 검증 실패 응답
 */
export function createCSRFFailureResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Invalid CSRF token' },
    { status: 403 }
  );
}

/**
 * mutating route에 선택적으로 적용하는 CSRF 래퍼
 */
export function withCSRFProtection<T extends unknown[] = []>(
  handler: (
    request: NextRequest,
    ...args: T
  ) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest, ...args: T) => {
    if (!verifyCSRFToken(request)) {
      return createCSRFFailureResponse();
    }

    return handler(request, ...args);
  };
}

/**
 * CSRF 토큰을 응답에 쿠키로 설정
 *
 * @param response - Next.js Response
 * @param token - CSRF token
 */
export function setCSRFCookie(response: NextResponse, token: string): void {
  // Next.js 15 리다이렉트 응답 호환성을 위해 Set-Cookie 헤더 직접 설정
  const secure = process.env.NODE_ENV === 'production';
  const cookieValue = [
    `csrf_token=${token}`,
    'Path=/',
    'SameSite=Strict',
    'Max-Age=86400', // 24시간
    secure && 'Secure',
  ]
    .filter(Boolean)
    .join('; ');

  response.headers.append('Set-Cookie', cookieValue);
}

/**
 * CSRF 토큰 생성 및 쿠키 설정 (통합 함수)
 *
 * @param response - Next.js Response
 * @returns Generated token
 */
export function setupCSRFProtection(response: NextResponse): string {
  const token = generateCSRFToken();
  setCSRFCookie(response, token);
  return token;
}

/**
 * 클라이언트 사이드에서 CSRF 토큰 가져오기
 *
 * @returns CSRF token from cookie, or empty string if not found
 */
export function getCSRFTokenFromCookie(): string {
  if (typeof document === 'undefined') return '';

  const cookies = document.cookie.split(';').map((cookie) => cookie.trim());
  const csrfCookie = cookies.find((cookie) => cookie.startsWith('csrf_token='));

  if (!csrfCookie) return '';

  return csrfCookie.split('=')[1] || '';
}
