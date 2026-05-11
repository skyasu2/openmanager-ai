import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckLimit, mockGetRequiredCloudRunConfig, mockFetch } = vi.hoisted(
  () => ({
    mockCheckLimit: vi.fn(),
    mockGetRequiredCloudRunConfig: vi.fn(),
    mockFetch: vi.fn(),
  })
);

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    dataGenerator: {
      checkLimit: mockCheckLimit,
    },
  },
}));

vi.mock('@/lib/ai-proxy/cloud-run-config', () => ({
  getRequiredCloudRunConfig: mockGetRequiredCloudRunConfig,
}));

import { POST } from './route';

describe('/api/ai/wake-up route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockCheckLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
    mockGetRequiredCloudRunConfig.mockReturnValue({
      ok: true,
      url: 'https://ai.example.test',
    });
    mockFetch.mockResolvedValue(new Response(null, { status: 204 }));
  });

  it('rate limit 초과 시 warmup fetch를 실행하지 않고 429를 반환한다', async () => {
    mockCheckLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    });

    const response = await POST(
      new NextRequest('http://localhost/api/ai/wake-up', { method: 'POST' })
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.status).toBe('rate_limited');
    expect(response.headers.get('Retry-After')).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('Cloud Run warmup 성공 시 warmed_up 상태를 반환한다', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/ai/wake-up', {
        method: 'POST',
        headers: { 'x-ai-warmup-source': 'test-suite' },
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: 'warmed_up' });
    expect(mockFetch).toHaveBeenCalledWith('https://ai.example.test/warmup', {
      method: 'GET',
      signal: expect.any(AbortSignal),
    });
  });

  it('warmup timeout은 부분 성공 starting 상태로 반환한다', async () => {
    mockFetch.mockRejectedValueOnce(
      new DOMException('operation timed out', 'AbortError')
    );

    const response = await POST(
      new NextRequest('http://localhost/api/ai/wake-up', { method: 'POST' })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ status: 'starting' });
  });
});
