/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRedisConstructor,
  mockPing,
  mockGet,
  mockSet,
  mockDel,
  mockMGet,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockRedisConstructor: vi.fn(),
  mockPing: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockDel: vi.fn(),
  mockMGet: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    ping = mockPing;
    get = mockGet;
    set = mockSet;
    del = mockDel;
    mget = mockMGet;

    constructor(options?: unknown) {
      mockRedisConstructor(options);
    }
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

function createPendingPromise<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

describe('redis/client timeouts', () => {
  const originalUrl = process.env.KV_REST_API_URL;
  const originalToken = process.env.KV_REST_API_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    process.env.KV_REST_API_URL = 'https://example.com/redis';
    process.env.KV_REST_API_TOKEN = 'token';

    mockRedisConstructor.mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env.KV_REST_API_URL = originalUrl;
    process.env.KV_REST_API_TOKEN = originalToken;
  });

  it('redisGet returns null when GET exceeds timeout budget', async () => {
    mockGet.mockReturnValueOnce(createPendingPromise());
    const { redisGet } = await import('./client');

    const pending = redisGet('slow:key', { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[Redis] GET failed for slow:key:',
      expect.any(Error)
    );
  });

  it('redisMGet returns null placeholders when MGET exceeds timeout budget', async () => {
    mockMGet.mockReturnValueOnce(createPendingPromise());
    const { redisMGet } = await import('./client');

    const pending = redisMGet(['a', 'b'], { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toEqual([null, null]);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[Redis] MGET failed for 2 keys:',
      expect.any(Error)
    );
  });

  it('checkRedisHealth reports unavailable when ping exceeds timeout budget', async () => {
    mockPing.mockReturnValueOnce(createPendingPromise());
    const { checkRedisHealth } = await import('./client');

    const pending = checkRedisHealth(true, { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toMatchObject({
      available: false,
      error: expect.stringContaining('timed out'),
    });
  });
});
