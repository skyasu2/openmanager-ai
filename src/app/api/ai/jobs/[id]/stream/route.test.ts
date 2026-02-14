import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckAPIAuth,
  mockGetRedisClient,
  mockRedisGet,
  mockGetSystemRunningFlag,
  mockRedisMGet,
} = vi.hoisted(() => ({
  mockCheckAPIAuth: vi.fn(),
  mockGetRedisClient: vi.fn(),
  mockRedisGet: vi.fn(),
  mockGetSystemRunningFlag: vi.fn(),
  mockRedisMGet: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  checkAPIAuth: mockCheckAPIAuth,
}));

vi.mock('@/lib/redis', () => ({
  getRedisClient: mockGetRedisClient,
  getSystemRunningFlag: mockGetSystemRunningFlag,
  redisGet: mockRedisGet,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { GET, getPollIntervalFromEnv } from './route';

describe('AI Job Stream Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckAPIAuth.mockResolvedValue(null);
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
  });
});
