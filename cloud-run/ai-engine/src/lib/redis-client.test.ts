import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RedisClient,
  getRedisCircuitState,
  isRedisDegraded,
  redisSet,
} from './redis-client';

// Cache layer depends on Redis config. Use a deterministic stub.
vi.mock('./config-parser', () => ({
  getUpstashConfig: vi.fn(() => ({
    url: 'https://example.com/redis',
    token: 'token',
  })),
}));

type JsonLike = { ok: boolean; json: () => Promise<unknown> };

function mockFetch(result: unknown, ok = true): void {
  const response: JsonLike = {
    ok,
    json: async () => ({ result }),
  };
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response as never);
}

describe('RedisClient.get', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns null when redis returns null', async () => {
    mockFetch(null);
    expect(await RedisClient.get('missing')).toBeNull();
  });

  it('returns empty string value from redis', async () => {
    mockFetch('');
    expect(await RedisClient.get('empty')).toBe('');
  });

  it('returns zero value from redis', async () => {
    mockFetch(0);
    expect(await RedisClient.get('zero')).toBe(0);
  });

  it('returns false value from redis', async () => {
    mockFetch(false);
    expect(await RedisClient.get('flag')).toBe(false);
  });

  it('returns raw string when JSON parse fails', async () => {
    // Upstash sends JSON in the response object, but the value itself may be non-JSON text.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'not-valid-json' }),
    } as never);

    expect(await RedisClient.get('raw')).toBe('not-valid-json');
  });

  it('returns null when redis call fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      text: async () => 'error',
    } as never);

    expect(await RedisClient.get('error')).toBeNull();
  });

  it('returns null when opt-in timeout aborts a stalled request', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(
      (_input, init) =>
        new Promise((_, reject) => {
          const abortError = new Error('Aborted');
          abortError.name = 'AbortError';
          const signal = init?.signal as AbortSignal | undefined;
          signal?.addEventListener(
            'abort',
            () => reject(abortError),
            { once: true }
          );
        }) as never
    );

    const pending = RedisClient.get('slow', { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);

    await expect(pending).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/redis',
      expect.objectContaining({
        signal: expect.any(Object),
      })
    );
  });
});

describe('RedisClient.del', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when Redis reports deletion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 1 }),
    } as never);

    expect(await RedisClient.del('key')).toBe(true);
  });

  it('returns false when Redis reports no deletion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 0 }),
    } as never);

    expect(await RedisClient.del('missing')).toBe(false);
  });
});

describe('RedisClient.set', () => {
  afterEach(() => {
    RedisClient.resetCircuitBreaker();
    vi.restoreAllMocks();
  });

  it('returns true when Redis confirms SET', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'OK' }),
    } as never);

    await expect(RedisClient.set('key', { value: 1 }, 60)).resolves.toBe(true);
  });

  it('returns false when Redis SET fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      text: async () => 'error',
    } as never);

    await expect(RedisClient.set('key', 'value', 60)).resolves.toBe(false);
  });

  it('redisSet reports false when circuit is open and write is skipped', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'error',
    } as never);

    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');

    await expect(redisSet('key', 'value', 60)).resolves.toBe(false);
  });
});

describe('RedisClient Circuit Breaker', () => {
  beforeEach(() => {
    RedisClient.resetCircuitBreaker();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    RedisClient.resetCircuitBreaker();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('3번 연속 실패 후 circuit이 open된다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'server error',
    } as never);

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

  it('circuit open 상태에서 fetch를 호출하지 않는다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'error',
    } as never);

    // circuit 열기
    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');
    expect(RedisClient.isCircuitOpen()).toBe(true);

    fetchSpy.mockClear();
    const result = await RedisClient.get('blocked');

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('30초 후 half-open probe를 허용하고, 성공 시 circuit이 닫힌다', async () => {
    vi.useFakeTimers();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'error',
    } as never);

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
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'pong' }),
    } as never);
    await RedisClient.get('probe');

    expect(RedisClient.isCircuitOpen()).toBe(false);
    expect(isRedisDegraded()).toBe(false);
    expect(getRedisCircuitState().state).toBe('closed');
  });

  it('half-open probe 실패 시 circuit이 다시 30초 열린다', async () => {
    vi.useFakeTimers();

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'error',
    } as never);

    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');

    vi.advanceTimersByTime(30_000);
    expect(getRedisCircuitState().state).toBe('half_open');

    // probe 실패
    await RedisClient.get('probe-fail');
    expect(RedisClient.isCircuitOpen()).toBe(true);

    // 다시 29초 → 여전히 open
    vi.advanceTimersByTime(29_000);
    expect(RedisClient.isCircuitOpen()).toBe(true);
  });

  it('health-style state reads do not consume the half-open probe', async () => {
    vi.useFakeTimers();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'error',
    } as never);

    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');
    vi.advanceTimersByTime(30_000);

    fetchSpy.mockClear();
    expect(isRedisDegraded()).toBe(true);
    expect(getRedisCircuitState().state).toBe('half_open');
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'pong' }),
    } as never);

    await expect(RedisClient.get('probe')).resolves.toBe('pong');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getRedisCircuitState().state).toBe('closed');
  });

  it('allows only one in-flight half-open probe', async () => {
    vi.useFakeTimers();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      text: async () => 'error',
    } as never);

    await RedisClient.get('k1');
    await RedisClient.get('k2');
    await RedisClient.get('k3');
    vi.advanceTimersByTime(30_000);

    let resolveProbe!: (value: unknown) => void;
    fetchSpy.mockClear();
    fetchSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve;
        }) as never
    );

    const firstProbe = RedisClient.get('probe');
    await Promise.resolve();

    expect(getRedisCircuitState()).toMatchObject({
      state: 'half_open',
      halfOpenProbeInFlight: true,
    });
    await expect(RedisClient.get('parallel-probe')).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    resolveProbe({
      ok: true,
      json: async () => ({ result: 'pong' }),
    });

    await expect(firstProbe).resolves.toBe('pong');
    expect(getRedisCircuitState().state).toBe('closed');
  });

  it('성공 후 실패 카운터가 초기화된다', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: false, text: async () => 'err' } as never)
      .mockResolvedValueOnce({ ok: false, text: async () => 'err' } as never)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'ok' }) } as never)
      .mockResolvedValueOnce({ ok: false, text: async () => 'err' } as never)
      .mockResolvedValueOnce({ ok: false, text: async () => 'err' } as never);

    await RedisClient.get('k1'); // fail 1
    await RedisClient.get('k2'); // fail 2
    await RedisClient.get('k3'); // success → reset
    await RedisClient.get('k4'); // fail 1
    await RedisClient.get('k5'); // fail 2 → circuit not open yet (< threshold)

    expect(RedisClient.isCircuitOpen()).toBe(false);
  });
});
