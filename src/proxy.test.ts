/**
 * @vitest-environment node
 */

import type { User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUpdateSession,
  mockUpdateSessionWithAuth,
  mockHasGuestSessionCookieHeader,
  mockGetRequestCountryCode,
  mockIsGuestCountryBlocked,
  mockIsGuestChinaIpRangeBlocked,
  mockIsGuestFullAccessEnabledServer,
  mockLoggerWarn,
  mockLoggerInfo,
  mockLoggerError,
  mockLoggerDebug,
} = vi.hoisted(() => ({
  mockUpdateSession: vi.fn(),
  mockUpdateSessionWithAuth: vi.fn(),
  mockHasGuestSessionCookieHeader: vi.fn(),
  mockGetRequestCountryCode: vi.fn(),
  mockIsGuestCountryBlocked: vi.fn(),
  mockIsGuestChinaIpRangeBlocked: vi.fn(),
  mockIsGuestFullAccessEnabledServer: vi.fn(),
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
  hasGuestSessionCookieHeader: mockHasGuestSessionCookieHeader,
}));

vi.mock('@/lib/auth/guest-region-policy', () => ({
  getRequestCountryCode: mockGetRequestCountryCode,
  isGuestCountryBlocked: mockIsGuestCountryBlocked,
}));

vi.mock('@/lib/auth/guest-ip-policy', () => ({
  isGuestChinaIpRangeBlocked: mockIsGuestChinaIpRangeBlocked,
}));

vi.mock('@/config/guestMode.server', () => ({
  isGuestFullAccessEnabledServer: mockIsGuestFullAccessEnabledServer,
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
    mockHasGuestSessionCookieHeader.mockReturnValue(false);
    mockGetRequestCountryCode.mockReturnValue(null);
    mockIsGuestCountryBlocked.mockReturnValue(false);
    mockIsGuestChinaIpRangeBlocked.mockReturnValue({
      blocked: false,
      clientIp: null,
    });
    mockIsGuestFullAccessEnabledServer.mockReturnValue(true);
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
    expect(mockHasGuestSessionCookieHeader).toHaveBeenCalledWith('');
  });

  it('보호 경로에서 게스트 쿠키가 있으면 접근을 허용한다', async () => {
    mockHasGuestSessionCookieHeader.mockReturnValue(true);
    mockIsGuestFullAccessEnabledServer.mockReturnValue(true);

    const request = new NextRequest('https://openmanager.test/dashboard', {
      headers: { cookie: 'auth_session_id=guest-abc' },
    });
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(mockHasGuestSessionCookieHeader).toHaveBeenCalledWith(
      'auth_session_id=guest-abc'
    );
  });

  it('보호 경로에서 게스트 + 차단 국가면 로그인 페이지로 리다이렉트한다', async () => {
    mockHasGuestSessionCookieHeader.mockReturnValue(true);
    mockIsGuestFullAccessEnabledServer.mockReturnValue(false);
    mockGetRequestCountryCode.mockReturnValue('CN');
    mockIsGuestCountryBlocked.mockReturnValue(true);

    const request = new NextRequest('https://openmanager.test/dashboard', {
      headers: {
        cookie: 'auth_session_id=guest-abc',
        'x-vercel-ip-country': 'CN',
      },
    });

    const response = await proxy(request);
    const location = parseLocation(response);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('guest_region_blocked');
    expect(location.searchParams.get('country')).toBe('CN');
  });

  it('보호 경로에서 게스트 + 중국 IP CIDR 차단이면 로그인 페이지로 리다이렉트한다', async () => {
    mockHasGuestSessionCookieHeader.mockReturnValue(true);
    mockIsGuestFullAccessEnabledServer.mockReturnValue(false);
    mockIsGuestChinaIpRangeBlocked.mockReturnValue({
      blocked: true,
      clientIp: '1.2.3.4',
    });

    const request = new NextRequest('https://openmanager.test/dashboard', {
      headers: {
        cookie: 'auth_session_id=guest-abc',
        'x-forwarded-for': '1.2.3.4',
      },
    });

    const response = await proxy(request);
    const location = parseLocation(response);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('guest_region_blocked');
  });

  it('개발 바이패스가 켜져 있으면 보호 경로도 updateSession으로 우회한다', async () => {
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH = 'true';
    const request = new NextRequest('https://openmanager.test/dashboard');

    await proxy(request);

    expect(mockUpdateSession).toHaveBeenCalledWith(request);
    expect(mockUpdateSessionWithAuth).not.toHaveBeenCalled();
  });
});
