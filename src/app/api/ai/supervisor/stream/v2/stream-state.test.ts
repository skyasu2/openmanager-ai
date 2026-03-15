/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetRedisTimeoutMs,
  mockGetRedisClient,
  mockIsRedisEnabled,
  mockRunRedisWithTimeout,
} = vi.hoisted(() => ({
  mockGetRedisTimeoutMs: vi.fn(),
  mockGetRedisClient: vi.fn(),
  mockIsRedisEnabled: vi.fn(),
  mockRunRedisWithTimeout: vi.fn(),
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
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('stream-state timeout wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedisTimeoutMs.mockImplementation((profile: string) =>
      profile === 'standard' ? 2222 : 1200
    );
    mockIsRedisEnabled.mockReturnValue(true);
    mockRunRedisWithTimeout.mockImplementation(
      async (_operation: string, promiseFactory: () => Promise<unknown>) =>
        promiseFactory()
    );
  });

  it('uses the standard timeout bucket when saving stream state', async () => {
    const redis = {
      set: vi.fn().mockResolvedValue('OK'),
    };
    mockGetRedisClient.mockReturnValue(redis);

    const { saveActiveStreamId } = await import('./stream-state');
    await saveActiveStreamId('session-1234', 'stream-1', 'owner-key');

    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'stream-state SET session-1234',
      expect.any(Function),
      { timeoutMs: 2222 }
    );
  });

  it('uses the standard timeout bucket when reading stream state', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue('stream-1'),
    };
    mockGetRedisClient.mockReturnValue(redis);

    const { getActiveStreamId } = await import('./stream-state');
    await expect(getActiveStreamId('session-1234', 'owner-key')).resolves.toBe(
      'stream-1'
    );

    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'stream-state GET session-1234',
      expect.any(Function),
      { timeoutMs: 2222 }
    );
  });

  it('uses the standard timeout bucket when clearing stream state', async () => {
    const redis = {
      del: vi.fn().mockResolvedValue(1),
    };
    mockGetRedisClient.mockReturnValue(redis);

    const { clearActiveStreamId } = await import('./stream-state');
    await clearActiveStreamId('session-1234', 'owner-key');

    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'stream-state DEL session-1234',
      expect.any(Function),
      { timeoutMs: 2222 }
    );
  });
});
