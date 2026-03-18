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

import { buildProgressEventData, GET, getPollIntervalFromEnv } from './route';

describe('AI Job Stream Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAPIAuth.mockResolvedValue(null);
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
});
