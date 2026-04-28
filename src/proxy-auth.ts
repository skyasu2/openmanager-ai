import { type NextRequest, NextResponse } from 'next/server';
import {
  AUTH_SESSION_ID_KEY,
  GUEST_AUTH_PROOF_COOKIE_KEY,
  getCookieValueFromHeader,
} from '@/lib/auth/guest-session-utils';
import {
  updateSession,
  updateSessionWithAuth,
} from '@/utils/supabase/middleware';

const PUBLIC_PATHS = [
  '/',
  '/main',
  '/login',
  '/auth',
  '/api',
  '/_next',
  '/favicon.ico',
  '/hourly-data',
];

const PROTECTED_PATH_PATTERNS = [
  /^\/dashboard(\/.*)?$/,
  /^\/system-boot(\/.*)?$/,
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isGuestAuth(request: NextRequest): boolean {
  const cookieHeader = request.headers.get('cookie') || '';
  const sessionId = getCookieValueFromHeader(cookieHeader, AUTH_SESSION_ID_KEY);
  const proof = getCookieValueFromHeader(
    cookieHeader,
    GUEST_AUTH_PROOF_COOKIE_KEY
  );
  return Boolean(sessionId) && Boolean(proof);
}

export async function handleAuthenticatedProxy(
  request: NextRequest
): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return updateSession(request);
  }

  if (isProtectedPath(pathname)) {
    const response = NextResponse.next();
    const { response: supabaseResponse, user } = await updateSessionWithAuth(
      request,
      response
    );

    const hasSession = Boolean(user);
    const isGuest = isGuestAuth(request);

    if (!hasSession && !isGuest) {
      console.warn(
        `[Proxy] Access denied: ${pathname} (hasSession: ${String(hasSession)}, isGuest: ${String(isGuest)})`
      );

      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return supabaseResponse;
  }

  return updateSession(request);
}
