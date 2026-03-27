import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockSignInWithOAuth,
  mockValidateRedirectUrl,
  mockLoggerInfo,
  mockLoggerError,
  mockLoggerWarn,
  mockLoggerDebug,
} = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn(),
  mockValidateRedirectUrl: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: vi.fn(() => ({
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  })),
}));

vi.mock('@/lib/security/secure-cookies', () => ({
  validateRedirectUrl: mockValidateRedirectUrl,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
    debug: mockLoggerDebug,
  },
}));

import { signInWithOAuthProvider } from './supabase-auth-oauth';

describe('signInWithOAuthProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://openmanager-live.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_live_123',
    };
    mockValidateRedirectUrl.mockReturnValue(true);
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://openmanager-live.supabase.co/auth/v1/authorize' },
      error: null,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('GitHub OAuth 요청 옵션 계약을 만족한다', async () => {
    const result = await signInWithOAuthProvider('github');

    expect(result.error).toBeNull();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: expect.objectContaining({
        redirectTo: expect.stringMatching(/\/auth\/callback$/),
        scopes: 'read:user user:email',
        skipBrowserRedirect: false,
      }),
    });
  });

  it('Google OAuth 요청 옵션 계약을 만족한다', async () => {
    const result = await signInWithOAuthProvider('google');

    expect(result.error).toBeNull();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        redirectTo: expect.stringMatching(/\/auth\/callback$/),
        scopes: 'email profile openid',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
        skipBrowserRedirect: false,
      }),
    });
  });

  it('리다이렉트 URL 검증 실패 시 OAuth 요청을 차단한다', async () => {
    mockValidateRedirectUrl.mockReturnValue(false);

    const result = await signInWithOAuthProvider('github');

    expect(result.data).toBeNull();
    expect(String(result.error)).toContain('리다이렉트 URL');
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it('Supabase 키가 없으면 OAuth 요청을 차단한다', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const result = await signInWithOAuthProvider('google');

    expect(result.data).toBeNull();
    expect(String(result.error)).toContain('Supabase Publishable/Anon Key');
    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
  });

  it('OAuth SDK 오류를 호출자에게 반환한다', async () => {
    const oauthError = new Error('oauth failed');
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: oauthError,
    });

    const result = await signInWithOAuthProvider('github');

    expect(result.data).toBeNull();
    expect(result.error).toBe(oauthError);
  });
});
