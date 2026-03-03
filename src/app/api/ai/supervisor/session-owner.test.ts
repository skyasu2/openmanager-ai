import { describe, expect, it, vi } from 'vitest';
import {
  createFallbackSessionId,
  getSessionOwnerKey,
  resolveScopedSessionIds,
} from './session-owner';

vi.mock('@/lib/auth/api-auth', () => ({
  getAPIAuthContext: vi.fn(),
}));

import { getAPIAuthContext } from '@/lib/auth/api-auth';

interface ReqOptions {
  headerSessionId?: string;
  querySessionId?: string;
  cookieHeader?: string;
  authSessionCookie?: string;
  cookies?: Array<{ name: string; value: string }>;
}

function makeReq(opts: ReqOptions = {}) {
  const url = new URL('https://example.com/api/ai/supervisor');
  if (opts.querySessionId) {
    url.searchParams.set('sessionId', opts.querySessionId);
  }

  const headerMap = new Map<string, string>();
  if (opts.headerSessionId) {
    headerMap.set('X-Session-Id', opts.headerSessionId);
  }
  if (opts.cookieHeader) {
    headerMap.set('cookie', opts.cookieHeader);
  }

  return {
    url: url.toString(),
    headers: {
      get: (key: string) => headerMap.get(key) ?? null,
    },
    cookies: {
      get: (key: string) =>
        key === 'auth_session_id' && opts.authSessionCookie
          ? { value: opts.authSessionCookie }
          : undefined,
      getAll: () => opts.cookies ?? [],
    },
  } as never;
}

describe('session-owner', () => {
  it('createFallbackSessionId는 session-uuid 형식이다', () => {
    const sessionId = createFallbackSessionId();
    expect(sessionId.startsWith('session-')).toBe(true);
    expect(sessionId.length).toBeGreaterThan(20);
  });

  it('resolveScopedSessionIds는 인증 사용자 기준 owner key를 붙인다', () => {
    vi.mocked(getAPIAuthContext).mockReturnValueOnce({
      authType: 'supabase',
      userId: 'user-123',
    });

    const req = makeReq({ headerSessionId: 'session-12345678' });
    const result = resolveScopedSessionIds(req, undefined, 'session-fallback');

    expect(result.sessionId).toBe('session-12345678');
    expect(result.ownerKey.startsWith('user:')).toBe(true);
    expect(result.ownerKey.includes('user-123')).toBe(false);
    expect(result.cacheSessionId).toBe(`${result.ownerKey}:${result.sessionId}`);
  });

  it('유효하지 않은 sessionId는 fallback으로 대체한다', () => {
    vi.mocked(getAPIAuthContext).mockReturnValueOnce({
      authType: 'guest',
    });

    const req = makeReq({ headerSessionId: 'invalid with spaces' });
    const result = resolveScopedSessionIds(req, undefined, 'session-fallback-123');

    expect(result.sessionId).toBe('session-fallback-123');
    expect(result.cacheSessionId.endsWith(':session-fallback-123')).toBe(true);
  });

  it('getSessionOwnerKey는 인증정보가 없으면 auth_session_id 쿠키를 사용한다', () => {
    vi.mocked(getAPIAuthContext).mockReturnValueOnce(null);
    const req = makeReq({ authSessionCookie: 'guest-session-id-123' });

    const ownerKey = getSessionOwnerKey(req);

    expect(ownerKey.startsWith('guest:')).toBe(true);
    expect(ownerKey.includes('guest-session-id-123')).toBe(false);
  });
});
