import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCSRFHeaders,
  ensureCSRFToken,
  getCSRFTokenFromCookie,
} from './csrf-client';

describe('csrf-client', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'document', {
      value: { cookie: '' },
      writable: true,
      configurable: true,
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error - 테스트 정리
    delete global.document;
  });

  it('기존 쿠키가 있으면 발급 API를 다시 호출하지 않는다', async () => {
    global.document.cookie = 'csrf_token=existing-token';

    const headers = await createCSRFHeaders({
      'Content-Type': 'application/json',
    });

    expect(headers.get('X-CSRF-Token')).toBe('existing-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('토큰이 없으면 발급 API 호출 후 쿠키 값을 사용한다', async () => {
    vi.mocked(fetch).mockImplementation(async () => {
      global.document.cookie = 'csrf_token=issued-token';
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const token = await ensureCSRFToken();

    expect(token).toBe('issued-token');
    expect(fetch).toHaveBeenCalledWith('/api/csrf-token', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('발급 API가 실패하면 에러를 던진다', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false }), { status: 500 })
    );

    await expect(ensureCSRFToken()).rejects.toThrow(
      'Failed to issue CSRF token: 500'
    );
  });

  it('쿠키 파싱 실패 시 빈 문자열을 반환한다', () => {
    global.document.cookie = 'session_id=abc123';

    expect(getCSRFTokenFromCookie()).toBe('');
  });
});
