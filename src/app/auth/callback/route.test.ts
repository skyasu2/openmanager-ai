/**
 * @vitest-environment node
 */

import type { User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateServerClient,
  mockCookies,
  mockCookieGetAll,
  mockExchangeCodeForSession,
  mockRecordLoginEvent,
  mockNormalizeOAuthProvider,
  mockLoggerInfo,
  mockLoggerError,
  mockLoggerWarn,
  mockLoggerDebug,
} = vi.hoisted(() => ({
  mockCreateServerClient: vi.fn(),
  mockCookies: vi.fn(),
  mockCookieGetAll: vi.fn(),
  mockExchangeCodeForSession: vi.fn(),
  mockRecordLoginEvent: vi.fn(),
  mockNormalizeOAuthProvider: vi.fn(
    (provider: string | null | undefined) => provider ?? 'unknown'
  ),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
  },
}));

vi.mock('@/lib/auth/login-audit', () => ({
  recordLoginEvent: mockRecordLoginEvent,
  normalizeOAuthProvider: mockNormalizeOAuthProvider,
}));

import { GET } from './route';

type ExchangeSessionPayload = {
  session: {
    user: Pick<User, 'id' | 'app_metadata'>;
  } | null;
};

function getLocationUrl(response: Response): URL {
  const location = response.headers.get('location');
  expect(location).toBeTruthy();
  return new URL(location as string);
}

describe('/auth/callback GET', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'pk-live-test',
    };

    mockCookieGetAll.mockReturnValue([]);
    mockCookies.mockResolvedValue({ getAll: mockCookieGetAll });

    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'user-123',
            app_metadata: { provider: 'github' },
          },
        },
      } satisfies ExchangeSessionPayload,
      error: null,
    });
    mockRecordLoginEvent.mockResolvedValue(true);

    mockCreateServerClient.mockImplementation(
      (
        _url: string,
        _key: string,
        _config: {
          cookies: {
            getAll: () => unknown[];
            setAll: (
              cookiesToSet: Array<{
                name: string;
                value: string;
                options?: Record<string, unknown>;
              }>
            ) => void;
          };
        }
      ) => ({
        auth: {
          exchangeCodeForSession: mockExchangeCodeForSession,
        },
      })
    );
  });

  it('OAuth 에러가 있으면 로그인으로 리다이렉트한다', async () => {
    const request = new NextRequest(
      'https://openmanager.test/auth/callback?error=access_denied&error_description=User%20cancelled'
    );

    const response = await GET(request);
    const location = getLocationUrl(response);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('access_denied');
    expect(location.searchParams.get('message')).toBe('User cancelled');
    expect(mockRecordLoginEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        provider: 'unknown',
        errorMessage: 'User cancelled',
        metadata: expect.objectContaining({
          reason: 'oauth_callback_error',
          oauthError: 'access_denied',
        }),
      })
    );
  });

  it('코드가 없으면 로그인으로 리다이렉트한다', async () => {
    const request = new NextRequest('https://openmanager.test/auth/callback');

    const response = await GET(request);
    const location = getLocationUrl(response);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/login');
  });

  it('정상 코드 교환 시 redirectTo 내부 경로로 이동한다', async () => {
    const request = new NextRequest(
      'https://openmanager.test/auth/callback?code=abc123&redirectTo=/dashboard/servers'
    );

    const response = await GET(request);
    const location = getLocationUrl(response);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/dashboard/servers');
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc123');
    expect(mockRecordLoginEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        metadata: expect.objectContaining({
          reason: 'oauth_callback_success',
        }),
      })
    );
  });

  it('외부 redirectTo는 차단하고 /main으로 폴백한다', async () => {
    const request = new NextRequest(
      'https://openmanager.test/auth/callback?code=abc123&redirectTo=https://evil.example/phish'
    );

    const response = await GET(request);
    const location = getLocationUrl(response);

    expect(response.status).toBe(307);
    expect(location.pathname).toBe('/main');
  });

  it('publishable key가 없으면 anon key로 폴백해 클라이언트를 생성한다', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';

    const request = new NextRequest(
      'https://openmanager.test/auth/callback?code=abc123'
    );

    await GET(request);

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-test-key',
      expect.any(Object)
    );
  });

  it('Supabase 키가 없으면 config_error로 로그인 페이지로 보낸다', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const request = new NextRequest(
      'https://openmanager.test/auth/callback?code=abc123'
    );

    const response = await GET(request);
    const location = getLocationUrl(response);

    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('config_error');
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it('코드 교환 실패 시 exchange_failed로 리다이렉트한다', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null } satisfies ExchangeSessionPayload,
      error: { message: 'Invalid grant' },
    });

    const request = new NextRequest(
      'https://openmanager.test/auth/callback?code=abc123'
    );

    const response = await GET(request);
    const location = getLocationUrl(response);

    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('exchange_failed');
    expect(location.searchParams.get('message')).toBe('Invalid grant');
    expect(mockRecordLoginEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorMessage: 'Invalid grant',
        metadata: expect.objectContaining({
          reason: 'oauth_code_exchange_failed',
        }),
      })
    );
  });

  it('세션이 생성되지 않으면 no_session으로 리다이렉트한다', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: { session: null } satisfies ExchangeSessionPayload,
      error: null,
    });

    const request = new NextRequest(
      'https://openmanager.test/auth/callback?code=abc123'
    );

    const response = await GET(request);
    const location = getLocationUrl(response);

    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('no_session');
    expect(mockRecordLoginEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        metadata: expect.objectContaining({
          reason: 'oauth_session_missing',
        }),
      })
    );
  });

  it('콜백 처리 중 예외가 나면 callback_exception으로 리다이렉트하고 실패 이력을 남긴다', async () => {
    mockExchangeCodeForSession.mockRejectedValue(
      new Error('callback exploded')
    );

    const request = new NextRequest(
      'https://openmanager.test/auth/callback?code=abc123'
    );

    const response = await GET(request);
    const location = getLocationUrl(response);

    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('error')).toBe('callback_exception');
    expect(mockRecordLoginEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorMessage: 'callback exploded',
        metadata: expect.objectContaining({
          reason: 'oauth_callback_exception',
        }),
      })
    );
  });
});
