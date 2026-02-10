/**
 * 🔐 Next.js Proxy - 라우트 보호 (Next.js 16+)
 *
 * 페이지별 접근 권한을 제어합니다.
 * Next.js 16에서 middleware → proxy로 명칭 변경됨.
 *
 * 📌 접근 권한 정책:
 * - 공개 페이지: `/`, `/main`, `/login`, `/auth/*`, `/api/*`
 * - 보호 페이지: `/dashboard/*`, `/system-boot/*` (GitHub 로그인 필요)
 *
 * ⚠️ 개발 모드 (NEXT_PUBLIC_DEV_BYPASS_AUTH=true):
 * - 모든 페이지 접근 허용 (게스트/비로그인 포함)
 *
 * @see src/utils/supabase/middleware.ts - Supabase 세션 헬퍼
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/utils/supabase/middleware';

// ============================================================================
// 접근 권한 설정
// ============================================================================

/**
 * 공개 경로 (인증 불필요)
 * - 루트, 메인, 로그인, 인증 콜백, API
 */
const PUBLIC_PATHS = [
  '/',
  '/main',
  '/login',
  '/auth',
  '/api',
  '/_next',
  '/favicon.ico',
  '/hourly-data', // 정적 데이터 파일
];

/**
 * 보호 경로 패턴 (GitHub 로그인 필요)
 * - 개발 완료 후 활성화 예정
 */
const PROTECTED_PATH_PATTERNS = [
  /^\/dashboard(\/.*)?$/,
  /^\/system-boot(\/.*)?$/,
];

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 경로가 공개 경로인지 확인
 */
function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

/**
 * 경로가 보호 경로인지 확인
 */
function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

/**
 * 개발 모드 바이패스 확인
 *
 * 기본값 false (프로덕션 안전). 명시적 opt-in만 허용.
 */
function isDevBypassEnabled(): boolean {
  const envValue = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH;
  if (envValue === 'true' || envValue === '1') {
    return true;
  }
  return false;
}

/**
 * Supabase 세션 쿠키 존재 여부 확인
 * Vercel Edge Runtime 호환 방식
 */
function hasSupabaseAuthCookie(request: NextRequest): boolean {
  // Next.js RequestCookies는 getAll() 메서드 지원
  // Edge Runtime에서는 request.headers.get('cookie')로 직접 접근
  const cookieHeader = request.headers.get('cookie') || '';
  // sb-*-auth-token 패턴 확인
  return cookieHeader.includes('-auth-token');
}

/**
 * 게스트 세션 여부 확인
 */
function isGuestAuth(request: NextRequest): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  return cookieHeader.includes('auth_type=guest');
}

// ============================================================================
// Proxy 메인 함수 (Next.js 16+)
// ============================================================================

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. 개발 모드 바이패스 - 모든 접근 허용
  if (isDevBypassEnabled()) {
    // Supabase 세션 업데이트만 수행 (인증 체크 없음)
    return updateSession(request);
  }

  // 2. 공개 경로 - 인증 불필요
  if (isPublicPath(pathname)) {
    return updateSession(request);
  }

  // 3. 보호 경로 - GitHub 로그인 확인
  if (isProtectedPath(pathname)) {
    // Supabase 세션 확인
    const response = NextResponse.next();
    const supabaseResponse = await updateSession(request, response);

    // 세션 쿠키 확인 (Edge Runtime 호환)
    const hasSession = hasSupabaseAuthCookie(request);
    const isGuest = isGuestAuth(request);

    // GitHub 로그인 사용자만 허용 (게스트는 제외)
    if (!hasSession || isGuest) {
      console.warn(
        `[Proxy] Access denied: ${pathname} (hasSession: ${hasSession}, isGuest: ${isGuest})`
      );

      // 로그인 페이지로 리다이렉트 (원래 URL 저장)
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
  }

  // 4. 기타 경로 - 기본 허용
  return updateSession(request);
}

// ============================================================================
// Proxy 설정
// ============================================================================

export const config = {
  matcher: [
    /*
     * 다음 경로 제외:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico, sitemap.xml, robots.txt (메타데이터 파일)
     * - 정적 에셋 (svg, png, jpg, jpeg, gif, webp, ico)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
