import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetRedisClient,
  mockRedisSet,
  mockResolveJobOwnerKey,
  mockAnalyzeJobQueryComplexity,
  mockInferJobType,
} = vi.hoisted(() => ({
  mockGetRedisClient: vi.fn(),
  mockRedisSet: vi.fn(),
  mockResolveJobOwnerKey: vi.fn(() => 'owner-key-1'),
  mockAnalyzeJobQueryComplexity: vi.fn(),
  mockInferJobType: vi.fn(() => 'analysis'),
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: vi.fn(),
  };
});

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

vi.mock('@/utils/security/csrf', () => ({
  withCSRFProtection: (handler: unknown) => handler,
}));

vi.mock('@/lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
  redisSet: mockRedisSet,
  redisGet: vi.fn(),
  redisMGet: vi.fn(),
}));

vi.mock('@/lib/ai/utils/query-complexity', () => ({
  analyzeJobQueryComplexity: mockAnalyzeJobQueryComplexity,
  inferJobType: mockInferJobType,
}));

vi.mock('./job-ownership', () => ({
  resolveJobOwnerKey: mockResolveJobOwnerKey,
  buildScopedJobListKey: vi.fn(() => 'job:list:owner-key-1:session-1234'),
}));

async function importRoute() {
  const mod = await import('./route');
  return { POST: mod.POST };
}

describe('POST /api/ai/jobs trigger readiness', () => {
  const originalEnabled = process.env.CLOUD_RUN_ENABLED;
  const originalUrl = process.env.CLOUD_RUN_AI_URL;
  const originalSecret = process.env.CLOUD_RUN_API_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedisClient.mockReturnValue({});
    mockRedisSet.mockResolvedValue(true);
    mockAnalyzeJobQueryComplexity.mockReturnValue({
      level: 'simple',
      estimatedTime: 15,
      factors: [],
    });
    process.env.CLOUD_RUN_ENABLED = 'false';
    process.env.CLOUD_RUN_AI_URL = 'https://example-ai.run.app';
    process.env.CLOUD_RUN_API_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.CLOUD_RUN_ENABLED = originalEnabled;
    process.env.CLOUD_RUN_AI_URL = originalUrl;
    process.env.CLOUD_RUN_API_SECRET = originalSecret;
  });

  it('Cloud Run readiness가 false면 초기 triggerStatus를 skipped로 반환한다', async () => {
    const { POST } = await importRoute();
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'server health',
        options: { sessionId: 'session-1234' },
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      triggerStatus: string;
      status: string;
    };

    expect(response.status).toBe(201);
    expect(body.status).toBe('queued');
    expect(body.triggerStatus).toBe('skipped');
    expect(response.headers.get('X-AI-Trigger-Status')).toBe('skipped');
  });
});
