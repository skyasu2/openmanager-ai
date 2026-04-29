import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RedisJobProgress } from '@/types/ai-jobs';

const {
  mockCheckAPIAuth,
  mockGetRedisClient,
  mockRedisGet,
  mockGetSystemRunningFlag,
  mockRedisMGet,
  mockRunRedisWithTimeout,
  mockGetRedisTimeoutMs,
  mockIsJobOwnedByRequester,
} = vi.hoisted(() => ({
  mockCheckAPIAuth: vi.fn(),
  mockGetRedisClient: vi.fn(),
  mockRedisGet: vi.fn(),
  mockGetSystemRunningFlag: vi.fn(),
  mockRedisMGet: vi.fn(),
  mockRunRedisWithTimeout: vi.fn(),
  mockGetRedisTimeoutMs: vi.fn((profile: string) =>
    profile === 'standard' ? 987 : 1200
  ),
  mockIsJobOwnedByRequester: vi.fn(() => true),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  checkAPIAuth: mockCheckAPIAuth,
}));

vi.mock('@/lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
  getSystemRunningFlag: mockGetSystemRunningFlag,
  redisGet: mockRedisGet,
}));

vi.mock('@/lib/redis/client', () => ({
  runRedisWithTimeout: mockRunRedisWithTimeout,
}));

vi.mock('@/config/redis-timeouts', () => ({
  getRedisTimeoutMs: mockGetRedisTimeoutMs,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../job-ownership', () => ({
  isJobOwnedByRequester: mockIsJobOwnedByRequester,
}));

import { GET } from './route';
import {
  buildProgressEventData,
  getPollIntervalFromEnv,
} from './stream-helpers';

describe('AI Job Stream Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAPIAuth.mockResolvedValue(null);
    mockIsJobOwnedByRequester.mockReturnValue(true);
    mockGetRedisTimeoutMs.mockImplementation((profile: string) =>
      profile === 'standard' ? 987 : 1200
    );
    mockRunRedisWithTimeout.mockImplementation(
      async (_operation: string, promiseFactory: () => Promise<unknown>) =>
        promiseFactory()
    );
    mockGetRedisClient.mockReturnValue({
      mget: mockRedisMGet,
    });
    mockRedisGet.mockResolvedValue({
      status: 'queued',
      startedAt: new Date().toISOString(),
    });
  });

  describe('getPollIntervalFromEnv', () => {
    it('should return default when env is missing', () => {
      const key = 'TEST_STREAM_POLL_MISSING';
      delete process.env[key];
      expect(getPollIntervalFromEnv(key, 250)).toBe(250);
    });

    it('should clamp poll interval to min/max', () => {
      const key = 'TEST_STREAM_POLL_CLAMP';

      process.env[key] = '50';
      expect(getPollIntervalFromEnv(key, 250)).toBe(100);

      process.env[key] = '999999';
      expect(getPollIntervalFromEnv(key, 250)).toBe(5000);

      delete process.env[key];
    });
  });

  describe('buildProgressEventData', () => {
    it('should normalize pending state with missing progress to initializing 5%', () => {
      expect(
        buildProgressEventData({
          jobId: 'job-pending',
          status: 'pending',
          progressState: null,
          elapsedMs: 1234,
        })
      ).toEqual({
        jobId: 'job-pending',
        status: 'pending',
        progress: 5,
        stage: 'initializing',
        message: 'AI 에이전트 초기화 중...',
        elapsedMs: 1234,
      });
    });

    it('should fall back to queued defaults for blank or invalid progress payloads', () => {
      expect(
        buildProgressEventData({
          jobId: 'job-queued',
          status: 'queued',
          progressState: {
            stage: '   ',
            progress: Number.NaN,
            message: '   ',
            updatedAt: new Date().toISOString(),
          } as unknown as RedisJobProgress,
          elapsedMs: 50,
        })
      ).toEqual({
        jobId: 'job-queued',
        status: 'queued',
        progress: 0,
        stage: 'init',
        message: '요청 대기열에 추가됨...',
        elapsedMs: 50,
      });
    });

    it('should preserve explicit stage, progress, and message values', () => {
      expect(
        buildProgressEventData({
          jobId: 'job-processing',
          status: 'processing',
          progressState: {
            stage: 'routing',
            progress: 28,
            message: '라우팅 중...',
            updatedAt: new Date().toISOString(),
          },
          elapsedMs: 2200,
        })
      ).toEqual({
        jobId: 'job-processing',
        status: 'processing',
        progress: 28,
        stage: 'routing',
        message: '라우팅 중...',
        elapsedMs: 2200,
      });
    });

    it('should preserve agent path metadata when provided', () => {
      expect(
        buildProgressEventData({
          jobId: 'job-agent-path',
          status: 'processing',
          progressState: {
            stage: 'analyst',
            progress: 62,
            message: '심층 분석으로 전달 중...',
            agent: 'analyst',
            handoffFrom: 'supervisor',
            handoffTo: 'analyst',
            executionPath: ['supervisor', 'analyst'],
            handoffCount: 1,
            stageLabel: '심층 분석',
            stageDetail: '분석 조율 → 심층 분석',
            updatedAt: new Date().toISOString(),
          },
          elapsedMs: 3300,
        })
      ).toEqual({
        jobId: 'job-agent-path',
        status: 'processing',
        progress: 62,
        stage: 'analyst',
        message: '심층 분석으로 전달 중...',
        elapsedMs: 3300,
        agent: 'analyst',
        handoffFrom: 'supervisor',
        handoffTo: 'analyst',
        executionPath: ['supervisor', 'analyst'],
        handoffCount: 1,
        stageLabel: '심층 분석',
        stageDetail: '분석 조율 → 심층 분석',
      });
    });

    it('should use stage-based defaults when progress number is missing', () => {
      expect(
        buildProgressEventData({
          jobId: 'job-finalizing',
          status: 'processing',
          progressState: {
            stage: 'finalizing',
            progress: Number.NaN,
            message: '',
            updatedAt: new Date().toISOString(),
          } as unknown as RedisJobProgress,
          elapsedMs: 9100,
        })
      ).toEqual({
        jobId: 'job-finalizing',
        status: 'processing',
        progress: 95,
        stage: 'finalizing',
        message: '응답 완료 처리 중...',
        elapsedMs: 9100,
      });
    });
  });

  it('should reject stream connection when Redis system flag is stopped', async () => {
    mockGetSystemRunningFlag.mockResolvedValue(false);

    const request = new NextRequest(
      'http://localhost/api/ai/jobs/job-1/stream'
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'job-1' }),
    });

    expect(response.status).toBe(409);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const payload = (await response.json()) as {
      error: string;
      message: string;
    };
    expect(payload.error).toBe('System is not running');
    expect(payload.message).toContain('시스템 시작 후 다시 시도');
  });

  it('should reject stream connection when job owner does not match', async () => {
    mockIsJobOwnedByRequester.mockReturnValue(false);

    const request = new NextRequest(
      'http://localhost/api/ai/jobs/job-0/stream'
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'job-0' }),
    });

    expect(response.status).toBe(404);
    const payload = (await response.json()) as {
      error: string;
      jobId: string;
    };
    expect(payload.error).toBe('Job not found');
    expect(payload.jobId).toBe('job-0');
  });

  it('should allow completed job stream even when Redis system flag is stopped', async () => {
    mockGetSystemRunningFlag.mockResolvedValue(false);
    mockRedisGet.mockResolvedValue({
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    mockRedisMGet.mockResolvedValue([
      {
        status: 'completed',
        result: 'done',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
      null,
    ]);

    const request = new NextRequest(
      'http://localhost/api/ai/jobs/job-2/stream'
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'job-2' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    await response.text();
    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'job-stream MGET job-2',
      expect.any(Function),
      { timeoutMs: 987 }
    );
  });

  it('should include structured errorDetails in failed job stream events', async () => {
    mockGetSystemRunningFlag.mockResolvedValue(true);
    mockRedisGet.mockResolvedValue({
      status: 'failed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: 'Cloud Run AI 엔진 요청 제한으로 12초 후 다시 시도해주세요.',
      errorDetails: {
        kind: 'rate-limit',
        message: 'Cloud Run AI 엔진 요청 제한으로 12초 후 다시 시도해주세요.',
        source: 'cloud-run-ai',
        scope: 'minute',
        retryAfterSeconds: 12,
        remaining: 0,
      },
    });
    mockRedisMGet.mockResolvedValue([
      {
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: 'Cloud Run AI 엔진 요청 제한으로 12초 후 다시 시도해주세요.',
        errorDetails: {
          kind: 'rate-limit',
          message: 'Cloud Run AI 엔진 요청 제한으로 12초 후 다시 시도해주세요.',
          source: 'cloud-run-ai',
          scope: 'minute',
          retryAfterSeconds: 12,
          remaining: 0,
        },
      },
      null,
    ]);

    const request = new NextRequest(
      'http://localhost/api/ai/jobs/job-3/stream'
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'job-3' }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"errorDetails"');
    expect(text).toContain('"source":"cloud-run-ai"');
    expect(text).toContain('"retryAfterSeconds":12');
  });

  it('should stream sanitized provider telemetry without owner metadata', async () => {
    mockGetSystemRunningFlag.mockResolvedValue(true);
    mockRedisGet.mockResolvedValue({
      status: 'completed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      metadata: {
        ownerKey: 'owner-secret',
      },
    });
    mockRedisMGet.mockResolvedValue([
      {
        status: 'completed',
        result: 'done',
        targetAgent: 'Analyst Agent',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        metadata: {
          ownerKey: 'owner-secret',
          complexity: 'complex',
          provider: 'cerebras',
          modelId: 'qwen-3-235b-a22b-instruct-2507',
          usedFallback: false,
          providerAttempts: [
            {
              provider: 'cerebras',
              modelId: 'qwen-3-235b-a22b-instruct-2507',
              attempt: 1,
              durationMs: 801,
            },
          ],
        },
      },
      null,
    ]);

    const request = new NextRequest(
      'http://localhost/api/ai/jobs/job-provider/stream'
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'job-provider' }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('"provider":"cerebras"');
    expect(text).toContain('"modelId":"qwen-3-235b-a22b-instruct-2507"');
    expect(text).not.toContain('owner-secret');
    expect(text).not.toContain('"complexity"');
  });
});
