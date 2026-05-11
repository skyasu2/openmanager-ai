import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRedisGet, mockRedisSet, mockRedisDel } = vi.hoisted(() => ({
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
}));

const { mockIsJobOwnedByRequester } = vi.hoisted(() => ({
  mockIsJobOwnedByRequester: vi.fn(() => true),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/utils/security/csrf', () => ({
  withCSRFProtection: (handler: unknown) => handler,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  redisGet: mockRedisGet,
  redisSet: mockRedisSet,
  redisDel: mockRedisDel,
}));

vi.mock('../job-ownership', () => ({
  isJobOwnedByRequester: mockIsJobOwnedByRequester,
}));

import { DELETE, GET } from './route';

describe('GET /api/ai/jobs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsJobOwnedByRequester.mockReturnValue(true);
  });

  it('failed job 응답에 structured errorDetails를 포함한다', async () => {
    const now = new Date().toISOString();
    mockRedisGet.mockResolvedValueOnce({
      id: 'job-1',
      type: 'analysis',
      sessionId: 'session-1',
      query: 'test',
      status: 'failed',
      progress: 100,
      currentStep: 'failed',
      result: null,
      error: 'Cloud Run AI 엔진 요청 제한으로 12초 후 다시 시도해주세요.',
      errorDetails: {
        kind: 'rate-limit',
        message: 'Cloud Run AI 엔진 요청 제한으로 12초 후 다시 시도해주세요.',
        source: 'cloud-run-ai',
        scope: 'minute',
        retryAfterSeconds: 12,
        remaining: 0,
      },
      createdAt: now,
      startedAt: now,
      completedAt: now,
      processingTimeMs: 1234,
      metadata: {
        complexity: 'complex',
        estimatedTime: 45,
        factors: {},
        ownerKey: 'owner-1',
      },
    });

    const request = new NextRequest('http://localhost/api/ai/jobs/job-1');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'job-1' }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      error: string | null;
      errorDetails: unknown;
      processingTimeMs: number | null;
    };

    expect(payload.error).toContain('12초 후');
    expect(payload.errorDetails).toEqual({
      kind: 'rate-limit',
      message: 'Cloud Run AI 엔진 요청 제한으로 12초 후 다시 시도해주세요.',
      source: 'cloud-run-ai',
      scope: 'minute',
      retryAfterSeconds: 12,
      remaining: 0,
    });
    expect(payload.processingTimeMs).toBe(1234);
  });

  it('completed job 응답에는 provider telemetry만 노출하고 ownerKey는 숨긴다', async () => {
    const now = new Date().toISOString();
    mockRedisGet.mockResolvedValueOnce({
      id: 'job-provider',
      type: 'analysis',
      sessionId: 'session-1',
      query: 'test',
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      result:
        '분석이 완료되었습니다. provider telemetry가 포함된 충분한 본문 응답을 함께 반환합니다.',
      error: null,
      createdAt: now,
      startedAt: now,
      completedAt: now,
      processingTimeMs: 987,
      metadata: {
        complexity: 'complex',
        estimatedTime: 45,
        factors: {},
        ownerKey: 'owner-secret',
        provider: 'cerebras',
        modelId: 'llama3.1-8b',
        usedFallback: false,
        durationMs: 900,
        providerAttempts: [
          {
            provider: 'cerebras',
            modelId: 'llama3.1-8b',
            attempt: 1,
            durationMs: 900,
          },
        ],
      },
    });

    const request = new NextRequest(
      'http://localhost/api/ai/jobs/job-provider'
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'job-provider' }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      metadata: Record<string, unknown> | null;
    };

    expect(payload.metadata).toMatchObject({
      provider: 'cerebras',
      modelId: 'llama3.1-8b',
      usedFallback: false,
      durationMs: 900,
      providerAttempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          attempt: 1,
          durationMs: 900,
        },
      ],
    });
    expect(payload.metadata).not.toHaveProperty('ownerKey');
    expect(payload.metadata).not.toHaveProperty('complexity');
  });

  it('completed job의 본문이 빈약하면 failed 상태로 노출한다', async () => {
    const now = new Date().toISOString();
    mockRedisGet.mockResolvedValueOnce({
      id: 'job-empty',
      type: 'analysis',
      sessionId: 'session-1',
      query: '지난 24시간 중 가장 부하가 높았던 시간대는 언제야?',
      status: 'completed',
      progress: 100,
      currentStep: 'completed',
      result: '# 분석 결과',
      error: null,
      createdAt: now,
      startedAt: now,
      completedAt: now,
      processingTimeMs: 1000,
      metadata: {
        complexity: 'complex',
        estimatedTime: 45,
        factors: {},
        ownerKey: 'owner-secret',
      },
    });

    const request = new NextRequest('http://localhost/api/ai/jobs/job-empty');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'job-empty' }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      status: string;
      result: unknown;
      error: string | null;
    };

    expect(payload.status).toBe('failed');
    expect(payload.result).toBeNull();
    expect(payload.error).toContain('substantive response body');
  });
});

describe('DELETE /api/ai/jobs/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsJobOwnedByRequester.mockReturnValue(true);
  });

  it('completed job delete는 멱등하게 200을 반환한다', async () => {
    mockRedisGet.mockResolvedValueOnce({
      id: 'job-2',
      type: 'analysis',
      sessionId: 'session-1',
      query: 'test',
      status: 'completed',
      progress: 100,
      currentStep: 'done',
      result: 'ok',
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      metadata: {
        complexity: 'simple',
        estimatedTime: 5,
        factors: {},
        ownerKey: 'owner-1',
      },
    });

    const request = new NextRequest('http://localhost/api/ai/jobs/job-2', {
      method: 'DELETE',
    });
    const response = await DELETE(request, {
      params: Promise.resolve({ id: 'job-2' }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { status: string };
    expect(payload.status).toBe('completed');
  });
});
