/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetRedisTimeoutMs,
  mockGetRedisClient,
  mockIsRedisEnabled,
  mockRunRedisWithTimeout,
  mockLoggerDebug,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockGetRedisTimeoutMs: vi.fn((profile: string) =>
    profile === 'standard' ? 2222 : 1200
  ),
  mockGetRedisClient: vi.fn(),
  mockIsRedisEnabled: vi.fn(),
  mockRunRedisWithTimeout: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/config/redis-timeouts', () => ({
  getRedisTimeoutMs: mockGetRedisTimeoutMs,
}));

vi.mock('@/lib/redis/client', () => ({
  getRedisClient: mockGetRedisClient,
  isRedisEnabled: mockIsRedisEnabled,
  runRedisWithTimeout: mockRunRedisWithTimeout,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    debug: mockLoggerDebug,
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}));

describe('upstash-resumable timeout wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisEnabled.mockReturnValue(true);
    mockRunRedisWithTimeout.mockImplementation(
      async (_operation: string, promiseFactory: () => Promise<unknown>) =>
        promiseFactory()
    );
  });

  it('uses the standard timeout bucket when initializing stream metadata', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
      rpush: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      get: vi.fn(),
      lrange: vi.fn(),
      del: vi.fn(),
    };
    mockGetRedisClient.mockReturnValue(redis);

    const { createUpstashResumableContext } = await import(
      './upstash-resumable'
    );
    const context = createUpstashResumableContext();

    await context.createNewResumableStream('stream-1', () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      })
    );

    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'resumable SET ai:resumable:stream-1:meta',
      expect.any(Function),
      { timeoutMs: 2222 }
    );
  });

  it('uses the standard timeout bucket when resuming buffered chunks', async () => {
    const redis = {
      set: vi.fn(),
      rpush: vi.fn(),
      expire: vi.fn(),
      get: vi
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({
            status: 'completed',
            totalChunks: 1,
            startedAt: Date.now(),
            completedAt: Date.now(),
          })
        ),
      lrange: vi.fn().mockResolvedValue(['chunk-1']),
      del: vi.fn(),
    };
    mockGetRedisClient.mockReturnValue(redis);

    const { createUpstashResumableContext } = await import(
      './upstash-resumable'
    );
    const context = createUpstashResumableContext();
    const stream = await context.resumeExistingStream('stream-1', 0);

    expect(stream).not.toBeNull();
    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'resumable GET ai:resumable:stream-1:meta',
      expect.any(Function),
      { timeoutMs: 2222 }
    );
    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'resumable LRANGE ai:resumable:stream-1:data',
      expect.any(Function),
      { timeoutMs: 2222 }
    );
  });

  it('uses the standard timeout bucket when clearing resumable state', async () => {
    const redis = {
      set: vi.fn(),
      rpush: vi.fn(),
      expire: vi.fn(),
      get: vi.fn(),
      lrange: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
    };
    mockGetRedisClient.mockReturnValue(redis);

    const { createUpstashResumableContext } = await import(
      './upstash-resumable'
    );
    const context = createUpstashResumableContext();
    await context.clearStream('stream-1');

    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'resumable DEL ai:resumable:stream-1:data',
      expect.any(Function),
      { timeoutMs: 2222 }
    );
    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'resumable DEL ai:resumable:stream-1:meta',
      expect.any(Function),
      { timeoutMs: 2222 }
    );
  });
});
