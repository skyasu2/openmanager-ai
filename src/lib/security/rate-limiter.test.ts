import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { withRateLimit } from '@/lib/security/rate-limiter';

describe('withRateLimit', () => {
  it('허용되면 핸들러를 실행하고 레이트리밋 헤더를 부여한다', async () => {
    const mockRateLimiter = {
      config: {
        maxRequests: 10,
      },
      checkLimit: vi.fn().mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetTime: 1000,
      }),
    };

    const mockHandler = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withRateLimit(
      mockRateLimiter as unknown as Parameters<typeof withRateLimit>[0],
      mockHandler
    );
    const request = new NextRequest('http://localhost/api/ai/jobs');

    const response = await wrapped(request);

    expect(mockRateLimiter.checkLimit).toHaveBeenCalledOnce();
    expect(mockHandler).toHaveBeenCalledWith(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('9');
  });

  it('요청 초과 시 핸들러를 실행하지 않고 429를 반환한다', async () => {
    const mockRateLimiter = {
      config: {
        maxRequests: 10,
      },
      checkLimit: vi.fn().mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: 2000,
      }),
    };

    const mockHandler = vi
      .fn()
      .mockResolvedValue(new Response('ok', { status: 200 }));
    const wrapped = withRateLimit(
      mockRateLimiter as unknown as Parameters<typeof withRateLimit>[0],
      mockHandler
    );
    const request = new NextRequest('http://localhost/api/ai/jobs');

    const response = await wrapped(request);

    const payload = (await response.json()) as { error: string };
    expect(mockRateLimiter.checkLimit).toHaveBeenCalledOnce();
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    expect(payload.error).toBe('Too Many Requests');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });
});
