/**
 * 🔐 Next.js Proxy - 라우트 보호 (Next.js 16+)
 *
 * 로컬 dev에서는 인증 프록시 그래프를 건너뛰어 route compilation을 최소화한다.
 * 운영/CI에서는 실제 auth proxy 구현을 동적 로드한다.
 */

import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // 로컬 dev에서는 auth 체크 생략 (컴파일 의존성 최소화)
  if (process.env.NODE_ENV === 'development' && !process.env.CI) {
    return NextResponse.next();
  }

  const { handleAuthenticatedProxy } = await import('./proxy-auth');
  return handleAuthenticatedProxy(request);
}

// config.matcher는 Next.js가 정적으로 분석하므로 리터럴 배열만 허용
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
