import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DataCacheLayer,
  DEFAULT_CACHE_CONFIG,
  getDataCache,
  resetDataCache,
} from './cache-layer';

vi.mock('./redis-client', () => ({
  RedisClient: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    del: vi.fn(async () => undefined),
  },
}));

describe('DataCacheLayer', () => {
  let cache: DataCacheLayer;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new DataCacheLayer();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetDataCache();
  });

  it('stores and retrieves values', async () => {
    await cache.set('metrics', 'server-01', { cpu: 45, memory: 60 });
    await expect(cache.get('metrics', 'server-01')).resolves.toEqual({
      cpu: 45,
      memory: 60,
    });
  });

  it('returns null for missing keys', async () => {
    await expect(cache.get('metrics', 'missing')).resolves.toBeNull();
  });

  it('supports getOrCompute memoization', async () => {
    const compute = vi.fn().mockResolvedValue({ cpu: 99 });

    await expect(cache.getOrCompute('metrics', 'k1', compute)).resolves.toEqual({
      cpu: 99,
    });
    await expect(cache.getOrCompute('metrics', 'k1', compute)).resolves.toEqual({
      cpu: 99,
    });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('expires metrics by TTL', async () => {
    await cache.set('metrics', 'k1', 'value');
    await expect(cache.get('metrics', 'k1')).resolves.toBe('value');

    vi.advanceTimersByTime(61_000);
    await expect(cache.get('metrics', 'k1')).resolves.toBeNull();
  });

  it('invalidates single entry', async () => {
    await cache.set('metrics', 'k1', 'value1');
    await cache.set('metrics', 'k2', 'value2');

    await expect(cache.invalidate('metrics', 'k1')).resolves.toBe(true);
    await expect(cache.get('metrics', 'k1')).resolves.toBeNull();
    await expect(cache.get('metrics', 'k2')).resolves.toBe('value2');
  });

  it('invalidates entries by type', async () => {
    await cache.set('metrics', 'k1', 'v1');
    await cache.set('metrics', 'k2', 'v2');
    await cache.set('rag', 'k3', 'v3');

    await expect(cache.invalidateByType('metrics')).resolves.toBe(2);
    await expect(cache.get('metrics', 'k1')).resolves.toBeNull();
    await expect(cache.get('rag', 'k3')).resolves.toBe('v3');
  });

  it('clears all entries and resets counters', async () => {
    await cache.set('metrics', 'k1', 'v1');
    await cache.get('metrics', 'k1');
    await cache.get('metrics', 'k2');
    await cache.clear();

    const stats = cache.getStats();
    expect(stats.totalEntries).toBe(0);
    expect(stats.hitCount).toBe(0);
    expect(stats.missCount).toBe(0);
  });

  it('returns stats and debug info', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    await cache.set('metrics', 'k1', 'v1');
    vi.advanceTimersByTime(1000);
    await cache.set('rag', 'k2', 'v2');
    await cache.get('metrics', 'k1');
    await cache.get('metrics', 'missing');

    const stats = cache.getStats();
    expect(stats.hitCount).toBe(1);
    expect(stats.missCount).toBe(1);
    expect(stats.totalEntries).toBe(2);
    expect(stats.oldestEntry).toBe(now);
    expect(stats.newestEntry).toBe(now + 1000);

    const debug = cache.getDebugInfo();
    expect(debug.entriesByType.metrics).toBe(1);
    expect(debug.entriesByType.rag).toBe(1);
    expect(debug.entriesByType.analysis).toBe(0);
    expect(debug.config.ttl.metrics).toBe(DEFAULT_CACHE_CONFIG.ttl.metrics);
  });

  it('enforces max size with cleanup', async () => {
    const small = new DataCacheLayer({ maxSize: 2 });
    await small.set('metrics', 'k1', 'v1');
    await small.set('metrics', 'k2', 'v2');
    await small.set('metrics', 'k3', 'v3');

    expect(small.getStats().totalEntries).toBeLessThanOrEqual(2);
  });

  it('uses singleton instance and reset', async () => {
    resetDataCache();
    const one = getDataCache();
    const two = getDataCache();
    expect(one).toBe(two);

    await one.set('metrics', 'k1', 'v1');
    resetDataCache();
    const three = getDataCache();
    await expect(three.get('metrics', 'k1')).resolves.toBeNull();
  });
});

