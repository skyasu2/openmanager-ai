import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRedisGet, mockRedisMGet } = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisMGet: vi.fn(),
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    default: {},
    aiAnalysis: {},
  },
  withRateLimit: (_cfg: unknown, handler: unknown) => handler,
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/lib/redis', () => ({
  redisGet: mockRedisGet,
  redisMGet: mockRedisMGet,
}));

import { GET } from './route';

describe('GET /api/ai/jobs', () => {
  const now = new Date().toISOString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('요청 sessionId 미존재 시 400을 반환한다', async () => {
    const request = new NextRequest('http://localhost/api/ai/jobs');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe('sessionId is required for job list query');
  });

  it('limit이 정수 1-50 범위를 벗어나면 400을 반환한다', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/jobs?sessionId=session-1&limit=abc'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe('limit must be an integer between 1 and 50');
  });

  it('limit=0이면 400을 반환한다', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/jobs?sessionId=session-1&limit=0'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe('limit must be an integer between 1 and 50');
  });

  it('limit 소수점이면 400을 반환한다', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/jobs?sessionId=session-1&limit=1.5'
    );
    const response = await GET(request);

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe('limit must be an integer between 1 and 50');
  });

  it('limit=1로 요청 시 첫 번째 항목만 반환한다', async () => {
    mockRedisGet.mockResolvedValue(['job-1', 'job-2']);
    mockRedisMGet.mockResolvedValue([
      {
        id: 'job-1',
        type: 'analysis',
        status: 'completed',
        progress: 100,
        currentStep: 'done',
        result: 'result text',
        error: null,
        createdAt: now,
        startedAt: now,
        completedAt: now,
      },
      null,
    ]);

    const request = new NextRequest(
      'http://localhost/api/ai/jobs?sessionId=session-1&limit=1'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      jobs: unknown[];
      total: number;
      hasMore: boolean;
    };

    expect(payload.jobs).toHaveLength(1);
    expect(payload.total).toBe(2);
    expect(payload.hasMore).toBe(true);
  });
});
