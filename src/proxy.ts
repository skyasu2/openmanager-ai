/**
 * 🔐 Next.js Proxy - 라우트 보호 (Next.js 16+)
 *
 * 로컬 dev에서는 인증 프록시 그래프를 건너뛰어 route compilation을 최소화한다.
 * 운영/CI에서는 실제 auth proxy 구현을 동적 로드한다.
 */

import { type NextRequest, NextResponse } from 'next/server';

function readBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function shouldBypassAuthProxyInDev(): boolean {
  if (process.env.CI) return false;

  const explicitOverride =
    readBooleanEnv(process.env.OPENMANAGER_DEV_AUTH_PROXY_BYPASS) ??
    readBooleanEnv(process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH);

  if (explicitOverride !== undefined) {
    return explicitOverride;
  }

  return process.env.NODE_ENV === 'development';
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // 로컬 dev에서는 기본적으로 auth proxy를 생략해 compile graph를 줄인다.
  // 필요 시 OPENMANAGER_DEV_AUTH_PROXY_BYPASS=false 로 실제 auth proxy를 강제한다.
  if (shouldBypassAuthProxyInDev()) {
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
