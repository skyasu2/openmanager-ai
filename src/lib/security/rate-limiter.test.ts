import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withRateLimit } from '@/lib/security/rate-limiter';

afterEach(() => {
  vi.restoreAllMocks();
});

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
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const now = Date.now();
    const mockRateLimiter = {
      config: {
        maxRequests: 10,
      },
      checkLimit: vi.fn().mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: now + 2000,
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

    const payload = (await response.json()) as {
      error: string;
      source: string;
      limitScope: string;
      remaining: number;
    };
    expect(mockRateLimiter.checkLimit).toHaveBeenCalledOnce();
    expect(mockHandler).not.toHaveBeenCalled();
    expect(response.status).toBe(429);
    expect(payload.error).toBe('Too Many Requests');
    expect(payload.source).toBe('frontend-gateway');
    expect(payload.limitScope).toBe('minute');
    expect(payload.remaining).toBe(0);
    expect(payload.retryAfter).toBe(4);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('Retry-After')).toBe('4');
  });

  it('일일 제한 응답에는 retry-after jitter를 추가하지 않는다', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const now = Date.now();
    const mockRateLimiter = {
      config: {
        maxRequests: 10,
        dailyLimit: 100,
      },
      checkLimit: vi.fn().mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetTime: now + 86_400_000,
        daily: {
          remaining: 0,
          resetTime: now + 86_400_000,
        },
      }),
    };

    const wrapped = withRateLimit(
      mockRateLimiter as unknown as Parameters<typeof withRateLimit>[0],
      vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    );
    const response = await wrapped(
      new NextRequest('http://localhost/api/ai/jobs')
    );
    const payload = (await response.json()) as {
      limitScope: string;
      retryAfter: number;
      dailyLimitExceeded: boolean;
    };

    expect(response.status).toBe(429);
    expect(payload.limitScope).toBe('daily');
    expect(payload.dailyLimitExceeded).toBe(true);
    expect(payload.retryAfter).toBe(86400);
    expect(response.headers.get('Retry-After')).toBe('86400');
  });
});
