/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CircuitState } from '@/lib/ai/circuit-breaker';

const {
  mockGetRedisClient,
  mockIsRedisEnabled,
  mockRunRedisWithTimeout,
  mockLoggerWarn,
  mockLoggerInfo,
  mockLoggerDebug,
} = vi.hoisted(() => ({
  mockGetRedisClient: vi.fn(),
  mockIsRedisEnabled: vi.fn(),
  mockRunRedisWithTimeout: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock('./client', () => ({
  getRedisClient: mockGetRedisClient,
  isRedisEnabled: mockIsRedisEnabled,
  runRedisWithTimeout: mockRunRedisWithTimeout,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: mockLoggerDebug,
  },
}));

const BASE_STATE: CircuitState = {
  state: 'OPEN',
  failures: 3,
  lastFailTime: 123456789,
  threshold: 3,
  resetTimeout: 60000,
};

describe('RedisCircuitBreakerStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisEnabled.mockReturnValue(true);
  });

  it('returns null when getState exceeds timeout budget', async () => {
    const redis = {
      hgetall: vi.fn(),
    };
    mockGetRedisClient.mockReturnValue(redis);
    mockRunRedisWithTimeout.mockRejectedValueOnce(new Error('timed out'));

    const { RedisCircuitBreakerStore } = await import(
      './circuit-breaker-store'
    );
    const store = new RedisCircuitBreakerStore();

    await expect(store.getState('groq')).resolves.toBeNull();
    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'HGETALL circuit:groq',
      expect.any(Function),
      { timeoutMs: 1000 }
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[CircuitBreakerStore] getState failed for groq:',
      expect.any(Error)
    );
  });

  it('swallows pipeline timeout during setState', async () => {
    const pipeline = {
      hset: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(),
    };
    const redis = {
      pipeline: vi.fn(() => pipeline),
    };
    mockGetRedisClient.mockReturnValue(redis);
    mockRunRedisWithTimeout.mockRejectedValueOnce(new Error('timed out'));

    const { RedisCircuitBreakerStore } = await import(
      './circuit-breaker-store'
    );
    const store = new RedisCircuitBreakerStore();

    await expect(store.setState('groq', BASE_STATE)).resolves.toBeUndefined();
    expect(pipeline.hset).toHaveBeenCalledWith('circuit:groq', {
      state: 'OPEN',
      failures: '3',
      lastFailTime: '123456789',
      threshold: '3',
      resetTimeout: '60000',
    });
    expect(pipeline.expire).toHaveBeenCalledWith('circuit:groq', 300);
    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'PIPELINE setState circuit:groq',
      expect.any(Function),
      { timeoutMs: 1000 }
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[CircuitBreakerStore] setState failed for groq:',
      expect.any(Error)
    );
  });

  it('returns zero when incrementFailures exceeds timeout budget', async () => {
    const pipeline = {
      hincrby: vi.fn(),
      hset: vi.fn(),
      expire: vi.fn(),
      exec: vi.fn(),
    };
    const redis = {
      pipeline: vi.fn(() => pipeline),
    };
    mockGetRedisClient.mockReturnValue(redis);
    mockRunRedisWithTimeout.mockRejectedValueOnce(new Error('timed out'));

    const { RedisCircuitBreakerStore } = await import(
      './circuit-breaker-store'
    );
    const store = new RedisCircuitBreakerStore();

    await expect(store.incrementFailures('groq')).resolves.toBe(0);
    expect(pipeline.hincrby).toHaveBeenCalledWith(
      'circuit:groq',
      'failures',
      1
    );
    expect(pipeline.expire).toHaveBeenCalledWith('circuit:groq', 300);
    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'PIPELINE incrementFailures circuit:groq',
      expect.any(Function),
      { timeoutMs: 1000 }
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[CircuitBreakerStore] incrementFailures failed for groq:',
      expect.any(Error)
    );
  });

  it('swallows resetState timeout and preserves graceful degradation', async () => {
    const redis = {
      del: vi.fn(),
    };
    mockGetRedisClient.mockReturnValue(redis);
    mockRunRedisWithTimeout.mockRejectedValueOnce(new Error('timed out'));

    const { RedisCircuitBreakerStore } = await import(
      './circuit-breaker-store'
    );
    const store = new RedisCircuitBreakerStore();

    await expect(store.resetState('groq')).resolves.toBeUndefined();
    expect(mockRunRedisWithTimeout).toHaveBeenCalledWith(
      'DEL circuit:groq',
      expect.any(Function),
      { timeoutMs: 1000 }
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      '[CircuitBreakerStore] resetState failed for groq:',
      expect.any(Error)
    );
  });
});
