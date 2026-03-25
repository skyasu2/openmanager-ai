import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRedisGet, mockRedisSet, mockIsJobOwnedByRequester } = vi.hoisted(
  () => ({
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockIsJobOwnedByRequester: vi.fn(() => true),
  })
);

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: vi.fn(),
  };
});

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/utils/security/csrf', () => ({
  withCSRFProtection: (handler: unknown) => handler,
}));

vi.mock('@/lib/redis', () => ({
  redisGet: mockRedisGet,
  redisSet: mockRedisSet,
}));

vi.mock('../../job-ownership', () => ({
  isJobOwnedByRequester: mockIsJobOwnedByRequester,
}));

async function importRoute() {
  const mod = await import('./route');
  return { POST: mod.POST };
}

describe('POST /api/ai/jobs/[id]/retry trigger readiness', () => {
  const originalEnabled = process.env.CLOUD_RUN_ENABLED;
  const originalUrl = process.env.CLOUD_RUN_AI_URL;
  const originalSecret = process.env.CLOUD_RUN_API_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisGet.mockResolvedValue({
      id: 'job-1',
      query: 'server health',
      type: 'analysis',
      status: 'failed',
      error: 'previous failure',
      progress: 100,
      currentStep: 'done',
      result: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: new Date().toISOString(),
      sessionId: 'session-1234',
      metadata: { retryCount: 0 },
    });
    mockRedisSet.mockResolvedValue(true);
    process.env.CLOUD_RUN_ENABLED = 'false';
    process.env.CLOUD_RUN_AI_URL = 'https://example-ai.run.app';
    process.env.CLOUD_RUN_API_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.CLOUD_RUN_ENABLED = originalEnabled;
    process.env.CLOUD_RUN_AI_URL = originalUrl;
    process.env.CLOUD_RUN_API_SECRET = originalSecret;
  });

  it('Cloud Run readiness가 false면 retry triggerStatus를 skipped로 반환한다', async () => {
    const { POST } = await importRoute();
    const request = new NextRequest(
      'http://localhost/api/ai/jobs/job-1/retry',
      {
        method: 'POST',
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: 'job-1' }),
    });
    const body = (await response.json()) as {
      triggerStatus: string;
      status: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe('queued');
    expect(body.triggerStatus).toBe('skipped');
  });
});
