import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckLimit } = vi.hoisted(() => ({
  mockCheckLimit: vi.fn(),
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    monitoring: {},
  },
  withRateLimit:
    (_limiter: unknown, handler: (request: NextRequest) => Promise<Response>) =>
    async (request: NextRequest) => {
      const result = await mockCheckLimit(request);
      if (!result.allowed) {
        return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return handler(request);
    },
}));

import { GET } from './route';

describe('/api/csrf-token route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLimit.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetTime: Date.now() + 60_000,
    });
  });

  it('CSRF token 발급 성공 시 JSON 응답과 csrf_token 쿠키를 반환한다', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/csrf-token')
    );
    const payload = await response.json();
    const setCookie = response.headers.get('set-cookie');

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      message: 'CSRF token issued',
    });
    expect(setCookie).toContain('csrf_token=');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).toContain('Max-Age=86400');
  });

  it('rate limit 초과 시 토큰 쿠키를 발급하지 않는다', async () => {
    mockCheckLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/csrf-token')
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error).toBe('Too Many Requests');
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
