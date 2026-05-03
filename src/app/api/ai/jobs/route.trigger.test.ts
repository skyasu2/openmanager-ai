import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetRedisClient,
  mockRedisSet,
  mockResolveJobOwnerKey,
  mockAnalyzeJobQueryComplexity,
  mockInferJobType,
  mockAfter,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetRedisClient: vi.fn(),
  mockRedisSet: vi.fn(),
  mockResolveJobOwnerKey: vi.fn(() => 'owner-key-1'),
  mockAnalyzeJobQueryComplexity: vi.fn(),
  mockInferJobType: vi.fn(() => 'analysis'),
  mockAfter: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: mockAfter,
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
  getAPIAuthContext: () => null,
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
  const originalTriggerMode = process.env.AI_JOB_TRIGGER_MODE;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
    mockGetRedisClient.mockReturnValue({});
    mockRedisSet.mockResolvedValue(true);
    mockAnalyzeJobQueryComplexity.mockReturnValue({
      level: 'simple',
      estimatedTime: 15,
      factors: [],
    });
    mockFetch.mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    process.env.CLOUD_RUN_ENABLED = 'false';
    process.env.CLOUD_RUN_AI_URL = 'https://example-ai.run.app';
    process.env.CLOUD_RUN_API_SECRET = 'test-secret';
    delete process.env.AI_JOB_TRIGGER_MODE;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    process.env.CLOUD_RUN_ENABLED = originalEnabled;
    process.env.CLOUD_RUN_AI_URL = originalUrl;
    process.env.CLOUD_RUN_API_SECRET = originalSecret;
    process.env.AI_JOB_TRIGGER_MODE = originalTriggerMode;
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

  it('stores read-only routeDecision metadata for created jobs', async () => {
    mockAnalyzeJobQueryComplexity.mockReturnValue({
      level: 'complex',
      estimatedTime: 55,
      factors: { dataVolume: 'high' },
    });

    const { POST } = await importRoute();
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '전체 서버 장애 원인 분석 보고서 만들어줘',
        options: { sessionId: 'session-1234' },
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      routeDecision?: Record<string, unknown>;
    };

    expect(response.status).toBe(201);
    expect(body.routeDecision).toMatchObject({
      intent: 'job',
      executionPath: 'job',
      complexity: 'complex',
      reasonCodes: ['job_queue_api'],
      decidedBy: 'bff',
    });

    const savedJob = mockRedisSet.mock.calls.find(
      ([key]) =>
        typeof key === 'string' &&
        key.startsWith('job:') &&
        !key.startsWith('job:progress:') &&
        !key.startsWith('job:list:') &&
        !key.startsWith('job:trigger:')
    )?.[1] as { metadata?: Record<string, unknown> } | undefined;

    expect(savedJob?.metadata?.routeDecision).toMatchObject({
      intent: 'job',
      executionPath: 'job',
      complexity: 'complex',
      reasonCodes: ['job_queue_api'],
      decidedBy: 'bff',
    });
  });

  it('Cloud Run worker trigger forwards session-aware rate-limit identity', async () => {
    process.env.CLOUD_RUN_ENABLED = 'true';

    const { POST } = await importRoute();
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'auth_session_id=guest-session-xyz',
      },
      body: JSON.stringify({
        query: 'server health',
        options: { sessionId: 'session-1234' },
      }),
    });

    const response = await POST(request);
    const scheduled = mockAfter.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    await scheduled?.();

    expect(response.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(
      (
        mockFetch.mock.calls[0]?.[1] as {
          headers: Record<string, string>;
        }
      ).headers['X-Rate-Limit-Identity']
    ).toMatch(/^guest:/);
  });

  it('Cloud Run worker trigger forwards RAG, Web Search, and analysis mode options', async () => {
    process.env.CLOUD_RUN_ENABLED = 'true';

    const { POST } = await importRoute();
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'auth_session_id=guest-session-xyz',
      },
      body: JSON.stringify({
        query: 'server health',
        options: {
          sessionId: 'session-1234',
          metadata: {
            analysisMode: 'thinking',
            enableRAG: true,
            enableWebSearch: true,
          },
        },
      }),
    });

    const response = await POST(request);
    const scheduled = mockAfter.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    await scheduled?.();

    expect(response.status).toBe(201);
    const savedJob = mockRedisSet.mock.calls.find(
      ([key]) =>
        typeof key === 'string' &&
        key.startsWith('job:') &&
        !key.startsWith('job:progress:') &&
        !key.startsWith('job:list:') &&
        !key.startsWith('job:trigger:')
    )?.[1] as { metadata?: Record<string, unknown> } | undefined;
    expect(savedJob?.metadata).toMatchObject({
      analysisMode: 'thinking',
      enableRAG: true,
      enableWebSearch: true,
    });

    const workerBody = JSON.parse(
      (
        mockFetch.mock.calls[0]?.[1] as {
          body: string;
        }
      ).body
    ) as Record<string, unknown>;
    expect(workerBody).toMatchObject({
      sessionId: 'session-1234',
      analysisMode: 'thinking',
      enableRAG: true,
      enableWebSearch: true,
    });
  });

  it('stores and forwards the job creation data slot as queryAsOf', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T05:55:00.000Z'));
    process.env.CLOUD_RUN_ENABLED = 'true';
    process.env.AI_JOB_TRIGGER_MODE = 'cloud-tasks';

    const { POST } = await importRoute();
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'auth_session_id=guest-session-xyz',
      },
      body: JSON.stringify({
        query: '현재 DISK 70% 이상 서버 찾아줘',
        options: {
          sessionId: 'session-1234',
          metadata: {
            analysisMode: 'thinking',
            enableRAG: true,
          },
        },
      }),
    });

    const response = await POST(request);
    const scheduled = mockAfter.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    await scheduled?.();

    expect(response.status).toBe(201);

    const expectedQueryAsOf = {
      createdAt: '2026-04-29T05:55:00.000Z',
      source: 'vercel-static-otel',
      datasetVersion: '24h-rotating-v1.0.0',
      dataSlot: {
        slotIndex: 89,
        minuteOfDay: 890,
        timeLabel: '14:50 KST',
      },
    };

    const savedJob = mockRedisSet.mock.calls.find(
      ([key]) =>
        typeof key === 'string' &&
        key.startsWith('job:') &&
        !key.startsWith('job:progress:') &&
        !key.startsWith('job:list:') &&
        !key.startsWith('job:trigger:')
    )?.[1] as { metadata?: Record<string, unknown> } | undefined;

    expect(savedJob?.metadata?.queryAsOf).toEqual(expectedQueryAsOf);

    const workerBody = JSON.parse(
      (
        mockFetch.mock.calls[0]?.[1] as {
          body: string;
        }
      ).body
    ) as Record<string, unknown>;
    expect(workerBody.queryAsOf).toEqual(expectedQueryAsOf);
  });

  it('prefers the dashboard-provided data slot over the API creation boundary time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-29T13:00:45.000Z'));
    process.env.CLOUD_RUN_ENABLED = 'true';
    const { POST } = await importRoute();
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'auth_session_id=guest-session-xyz',
      },
      body: JSON.stringify({
        query: '현재 위험/경고 서버를 기준으로 조치 우선순위 알려줘',
        options: {
          sessionId: 'session-1234',
          metadata: {
            analysisMode: 'thinking',
            queryAsOfDataSlot: {
              slotIndex: 131,
              minuteOfDay: 1310,
              timeLabel: '21:50 KST',
            },
          },
        },
      }),
    });

    const response = await POST(request);
    const scheduled = mockAfter.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    await scheduled?.();

    expect(response.status).toBe(201);

    const expectedQueryAsOf = {
      createdAt: '2026-04-29T13:00:45.000Z',
      source: 'vercel-static-otel',
      datasetVersion: '24h-rotating-v1.0.0',
      dataSlot: {
        slotIndex: 131,
        minuteOfDay: 1310,
        timeLabel: '21:50 KST',
      },
    };

    const savedJob = mockRedisSet.mock.calls.find(
      ([key]) =>
        typeof key === 'string' &&
        key.startsWith('job:') &&
        !key.startsWith('job:progress:') &&
        !key.startsWith('job:list:') &&
        !key.startsWith('job:trigger:')
    )?.[1] as { metadata?: Record<string, unknown> } | undefined;

    expect(savedJob?.metadata?.queryAsOf).toEqual(expectedQueryAsOf);

    const workerBody = JSON.parse(
      (
        mockFetch.mock.calls[0]?.[1] as {
          body: string;
        }
      ).body
    ) as Record<string, unknown>;
    expect(workerBody.queryAsOf).toEqual(expectedQueryAsOf);
  });

  it('Cloud Tasks trigger mode dispatches to the short Cloud Run dispatcher endpoint', async () => {
    process.env.CLOUD_RUN_ENABLED = 'true';
    process.env.AI_JOB_TRIGGER_MODE = 'cloud-tasks';

    const { POST } = await importRoute();
    const request = new NextRequest('http://localhost/api/ai/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'auth_session_id=guest-session-xyz',
      },
      body: JSON.stringify({
        query: 'server health',
        options: {
          sessionId: 'session-1234',
          metadata: {
            analysisMode: 'thinking',
            enableRAG: true,
            enableWebSearch: true,
          },
        },
      }),
    });

    const response = await POST(request);
    const scheduled = mockAfter.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    await scheduled?.();

    expect(response.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[0]).toBe(
      'https://example-ai.run.app/api/jobs/dispatch'
    );

    const workerBody = JSON.parse(
      (
        mockFetch.mock.calls[0]?.[1] as {
          body: string;
        }
      ).body
    ) as Record<string, unknown>;
    expect(workerBody).toMatchObject({
      sessionId: 'session-1234',
      analysisMode: 'thinking',
      enableRAG: true,
      enableWebSearch: true,
    });
  });
});
