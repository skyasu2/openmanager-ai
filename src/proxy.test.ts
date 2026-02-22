/**
 * @vitest-environment node
 */

import type { User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUpdateSession,
  mockUpdateSessionWithAuth,
  mockGetCookieValueFromHeader,
  mockLoggerWarn,
  mockLoggerInfo,
  mockLoggerError,
  mockLoggerDebug,
} = vi.hoisted(() => ({
  mockUpdateSession: vi.fn(),
  mockUpdateSessionWithAuth: vi.fn(),
  mockGetCookieValueFromHeader: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock('@/utils/supabase/middleware', () => ({
  updateSession: mockUpdateSession,
  updateSessionWithAuth: mockUpdateSessionWithAuth,
}));

vi.mock('@/lib/auth/guest-session-utils', () => ({
  AUTH_SESSION_ID_KEY: 'auth_session_id',
  GUEST_AUTH_PROOF_COOKIE_KEY: 'guest_auth_proof',
  getCookieValueFromHeader: mockGetCookieValueFromHeader,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
    error: mockLoggerError,
    debug: mockLoggerDebug,
  },
}));

import { proxy } from './proxy';

function parseLocation(response: Response): URL {
  const location = response.headers.get('location');
  expect(location).toBeTruthy();
  return new URL(location as string);
}

describe('proxy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    mockUpdateSession.mockResolvedValue(NextResponse.next());
    mockUpdateSessionWithAuth.mockResolvedValue({
      response: NextResponse.next(),
      user: null,
      error: null,
    });
    mockGetCookieValueFromHeader.mockReturnValue(null);
  });

  it('공개 경로는 updateSession만 수행한다', async () => {
    const request = new NextRequest('https://openmanager.test/login');

    await proxy(request);

    expect(mockUpdateSession).toHaveBeenCalledWith(request);
    expect(mockUpdateSessionWithAuth).not.toHaveBeenCalled();
  });

  it('보호 경로에서 인증 사용자가 없으면 /login?redirectTo 로 이동한다', async () => {
    const request = new NextRequest('https://openmanager.test/dashboard');

    const response = await proxy(request);
    const location = parseLocation(response);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('redirectTo')).toBe('/dashboard');
  });

  it('보호 경로에서 검증된 user가 있으면 접근을 허용한다', async () => {
    const allowedResponse = NextResponse.next();
    mockUpdateSessionWithAuth.mockResolvedValue({
      response: allowedResponse,
      user: { id: 'user-1' } satisfies Pick<User, 'id'>,
      error: null,
    });

    const request = new NextRequest('https://openmanager.test/dashboard');
    const response = await proxy(request);

    expect(response).toBe(allowedResponse);
    expect(mockGetCookieValueFromHeader).toHaveBeenCalled();
  });

  it('보호 경로에서 게스트 쿠키(session + proof)가 모두 있으면 접근을 허용한다', async () => {
    // Given: session ID와 proof 쿠키가 모두 존재
    mockGetCookieValueFromHeader.mockImplementation(
      (_header: string, key: string) => {
        if (key === 'auth_session_id') return 'guest-abc';
        if (key === 'guest_auth_proof') return 'v1.payload.signature';
        return null;
      }
    );

    const request = new NextRequest('https://openmanager.test/dashboard', {
      headers: {
        cookie:
          'auth_session_id=guest-abc; guest_auth_proof=v1.payload.signature',
      },
    });

    // When
    const response = await proxy(request);

    // Then: 접근 허용
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('보호 경로에서 proof 쿠키 없이 session ID만 있으면 접근을 거부한다', async () => {
    // Given: session ID만 있고 proof 쿠키 없음
    mockGetCookieValueFromHeader.mockImplementation(
      (_header: string, key: string) => {
        if (key === 'auth_session_id') return 'guest-abc';
        return null;
      }
    );

    const request = new NextRequest('https://openmanager.test/dashboard', {
      headers: { cookie: 'auth_session_id=guest-abc' },
    });

    // When
    const response = await proxy(request);

    // Then: 로그인 페이지로 리다이렉트
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get('location') as string);
    expect(location.pathname).toBe('/login');
  });

  it('개발 바이패스가 켜져 있으면 보호 경로도 updateSession으로 우회한다', async () => {
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH = 'true';
    const request = new NextRequest('https://openmanager.test/dashboard');

    await proxy(request);

    expect(mockUpdateSession).toHaveBeenCalledWith(request);
    expect(mockUpdateSessionWithAuth).not.toHaveBeenCalled();
  });
});
