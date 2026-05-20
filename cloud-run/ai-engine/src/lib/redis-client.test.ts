import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RedisClient,
  getRedisCircuitState,
  isRedisDegraded,
  redisSet,
} from './redis-client';

// ============================================================================
// @upstash/redis SDK mock
// vi.fn() constructor mock은 반드시 일반 function 사용 (화살표 함수는 new 불가)
// ============================================================================

const mockSdk = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  pexpire: vi.fn(),
  pttl: vi.fn(),
  eval: vi.fn(),
};

vi.mock('@upstash/redis', () => ({
  // eslint-disable-next-line prefer-arrow-callback
  Redis: vi.fn().mockImplementation(function () {
    return mockSdk;
  }),
}));

vi.mock('./config-parser', () => ({
  getUpstashConfig: vi.fn(() => ({
    url: 'https://example.upstash.io',
    token: 'test-token',
  })),
}));

// ============================================================================
// Setup: 각 테스트 전 SDK 인스턴스·CB·mock 상태 초기화
// ============================================================================

beforeEach(() => {
  RedisClient.resetConfig();        // _sdk singleton 초기화 → 다음 호출에 mock 인스턴스 생성
  RedisClient.resetCircuitBreaker();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ============================================================================
// RedisClient.get
// ============================================================================

describe('RedisClient.get', () => {
  it('returns null when redis returns null (cache miss)', async () => {
    mockSdk.get.mockResolvedValue(null);
    expect(await RedisClient.get('missing')).toBeNull();
  });

  it('returns empty string value', async () => {
    mockSdk.get.mockResolvedValue('');
    expect(await RedisClient.get('empty')).toBe('');
  });

  it('returns zero value', async () => {
    mockSdk.get.mockResolvedValue(0);
    expect(await RedisClient.get('zero')).toBe(0);
  });

  it('returns false boolean value', async () => {
    mockSdk.get.mockResolvedValue(false);
    expect(await RedisClient.get('flag')).toBe(false);
  });

  it('returns object value parsed by SDK', async () => {
    const obj = { status: 'ok', count: 3 };
    mockSdk.get.mockResolvedValue(obj);
    expect(await RedisClient.get('obj')).toEqual(obj);
  });

  it('returns null when SDK throws (server error)', async () => {
    mockSdk.get.mockRejectedValue(new Error('WRONGTYPE'));
    expect(await RedisClient.get('error')).toBeNull();
  });

  it('returns null when opt-in timeout expires on a stalled request', async () => {
    vi.useFakeTimers();
    mockSdk.get.mockImplementation(() => new Promise(() => {})); // never resolves

    const pending = RedisClient.get('slow', { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toBeNull();
  });
});

// ============================================================================
// RedisClient.del
// ============================================================================

describe('RedisClient.del', () => {
  it('returns true when Redis deletes the key', async () => {
    mockSdk.del.mockResolvedValue(1);
    expect(await RedisClient.del('key')).toBe(true);
  });

  it('returns false when key does not exist', async () => {
    mockSdk.del.mockResolvedValue(0);
    expect(await RedisClient.del('missing')).toBe(false);
  });
});

// ============================================================================
// RedisClient.set
// ============================================================================

describe('RedisClient.set', () => {
  it('returns true when Redis confirms SET', async () => {
    mockSdk.set.mockResolvedValue('OK');
    await expect(RedisClient.set('key', { value: 1 }, 60)).resolves.toBe(true);
  });

  it('returns false when SDK throws on SET', async () => {
    mockSdk.set.mockRejectedValue(new Error('network error'));
    await expect(RedisClient.set('key', 'value', 60)).resolves.toBe(false);
  });

  it('redisSet reports false when circuit is open and write is skipped', async () => {
    mockSdk.get.mockRejectedValue(new Error('err'));

    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');

    // circuit open → redisSet must short-circuit (SDK set must not be called)
    mockSdk.set.mockResolvedValue('OK');
    await expect(redisSet('key', 'value', 60)).resolves.toBe(false);
    expect(mockSdk.set).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Circuit Breaker
// ============================================================================

describe('RedisClient Circuit Breaker', () => {
  it('3번 연속 실패 후 circuit이 open된다', async () => {
    mockSdk.get.mockRejectedValue(new Error('server error'));

    await RedisClient.get('k1');
    await RedisClient.get('k2');
    expect(RedisClient.isCircuitOpen()).toBe(false);
    await RedisClient.get('k3');
    expect(RedisClient.isCircuitOpen()).toBe(true);
    expect(isRedisDegraded()).toBe(true);
    expect(getRedisCircuitState()).toMatchObject({
      state: 'open',
      consecutiveFailures: 3,
    });
  });

  it('circuit open 상태에서 SDK를 호출하지 않는다', async () => {
    mockSdk.get.mockRejectedValue(new Error('error'));

    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');
    expect(RedisClient.isCircuitOpen()).toBe(true);

    vi.clearAllMocks();
    const result = await RedisClient.get('blocked');

    expect(result).toBeNull();
    expect(mockSdk.get).not.toHaveBeenCalled();
  });

  it('30초 후 half-open probe를 허용하고, 성공 시 circuit이 닫힌다', async () => {
    vi.useFakeTimers();

    mockSdk.get.mockRejectedValue(new Error('error'));
    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');
    expect(RedisClient.isCircuitOpen()).toBe(true);

    // 30초 경과 → half-open
    vi.advanceTimersByTime(30_000);
    expect(getRedisCircuitState()).toMatchObject({
      state: 'half_open',
      retryAfterMs: 0,
    });
    expect(isRedisDegraded()).toBe(true);

    // probe 성공
    mockSdk.get.mockResolvedValueOnce('pong');
    await RedisClient.get('probe');

    expect(RedisClient.isCircuitOpen()).toBe(false);
    expect(isRedisDegraded()).toBe(false);
    expect(getRedisCircuitState().state).toBe('closed');
  });

  it('half-open probe 실패 시 circuit이 다시 30초 열린다', async () => {
    vi.useFakeTimers();

    mockSdk.get.mockRejectedValue(new Error('error'));
    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');

    vi.advanceTimersByTime(30_000);
    expect(getRedisCircuitState().state).toBe('half_open');

    await RedisClient.get('probe-fail');
    expect(RedisClient.isCircuitOpen()).toBe(true);

    // 29초 후에도 여전히 open
    vi.advanceTimersByTime(29_000);
    expect(RedisClient.isCircuitOpen()).toBe(true);
  });

  it('health-style state reads do not consume the half-open probe', async () => {
    vi.useFakeTimers();

    mockSdk.get.mockRejectedValue(new Error('error'));
    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');
    vi.advanceTimersByTime(30_000);

    vi.clearAllMocks();
    expect(isRedisDegraded()).toBe(true);
    expect(getRedisCircuitState().state).toBe('half_open');
    expect(mockSdk.get).not.toHaveBeenCalled();

    mockSdk.get.mockResolvedValueOnce('pong');
    await expect(RedisClient.get('probe')).resolves.toBe('pong');
    expect(mockSdk.get).toHaveBeenCalledTimes(1);
    expect(getRedisCircuitState().state).toBe('closed');
  });

  it('allows only one in-flight half-open probe', async () => {
    vi.useFakeTimers();

    mockSdk.get.mockRejectedValue(new Error('error'));
    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');
    vi.advanceTimersByTime(30_000);

    vi.clearAllMocks();
    let resolveProbe!: (value: unknown) => void;
    mockSdk.get.mockImplementationOnce(
      () => new Promise((resolve) => { resolveProbe = resolve; })
    );

    const firstProbe = RedisClient.get('probe');
    await Promise.resolve();

    expect(getRedisCircuitState()).toMatchObject({
      state: 'half_open',
      halfOpenProbeInFlight: true,
    });
    await expect(RedisClient.get('parallel-probe')).resolves.toBeNull();
    expect(mockSdk.get).toHaveBeenCalledTimes(1);

    resolveProbe('pong');
    await expect(firstProbe).resolves.toBe('pong');
    expect(getRedisCircuitState().state).toBe('closed');
  });

  it('성공 후 실패 카운터가 초기화된다', async () => {
    mockSdk.get
      .mockRejectedValueOnce(new Error('err'))
      .mockRejectedValueOnce(new Error('err'))
      .mockResolvedValueOnce('ok')   // success → reset counter
      .mockRejectedValueOnce(new Error('err'))
      .mockRejectedValueOnce(new Error('err'));

    await RedisClient.get('k1'); // fail 1
    await RedisClient.get('k2'); // fail 2
    await RedisClient.get('k3'); // success → reset
    await RedisClient.get('k4'); // fail 1
    await RedisClient.get('k5'); // fail 2 → still below threshold

    expect(RedisClient.isCircuitOpen()).toBe(false);
  });
});
