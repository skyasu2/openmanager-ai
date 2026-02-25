import { afterEach, describe, expect, it, vi } from 'vitest';

import { RedisClient } from './redis-client';

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
