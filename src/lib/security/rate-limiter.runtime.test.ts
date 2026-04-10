/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckRedisRateLimit = vi.fn();
const mockEdgeLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
const mockAppLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../redis/rate-limiter', () => ({
  checkRedisRateLimit: mockCheckRedisRateLimit,
}));

vi.mock('../runtime/edge-runtime-utils', () => ({
  EdgeLogger: {
    getInstance: () => mockEdgeLogger,
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: mockAppLogger,
}));

describe('rate-limiter runtime fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('Redis가 null을 반환하면 In-Memory fallback이 일일 제한 정보와 함께 동작한다', async () => {
    mockCheckRedisRateLimit.mockResolvedValue(null);

    const { rateLimiters } = await import('./rate-limiter');
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    const firstResult = await rateLimiters.aiAnalysis.checkLimit(request);
    const secondResult = await rateLimiters.aiAnalysis.checkLimit(request);

    expect(firstResult.allowed).toBe(true);
    expect(firstResult.remaining).toBe(9);
    expect(firstResult.daily?.remaining).toBe(99);
    expect(secondResult.allowed).toBe(true);
    expect(secondResult.remaining).toBe(8);
    expect(secondResult.daily?.remaining).toBe(98);
    expect(mockCheckRedisRateLimit).toHaveBeenCalledTimes(2);
    expect(mockEdgeLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Redis 비활성화 - In-Memory Fallback 사용')
    );
  });

  it('Redis가 예외를 던져도 In-Memory fallback으로 허용한다', async () => {
    mockCheckRedisRateLimit.mockRejectedValue(new Error('redis unavailable'));

    const { rateLimiters } = await import('./rate-limiter');
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      headers: { 'x-forwarded-for': '203.0.113.11' },
    });

    const result = await rateLimiters.aiAnalysis.checkLimit(request);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.daily?.remaining).toBe(99);
    expect(mockEdgeLogger.warn).toHaveBeenCalledWith(
      '[Rate Limit] Redis 실패, In-Memory fallback 사용',
      expect.any(Error)
    );
  });
});
