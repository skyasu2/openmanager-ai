import { describe, expect, it } from 'vitest';
import {
  buildCacheStats,
  createInitialStatsState,
  type UnifiedCacheStatsState,
} from './unified-cache.stats';
import type { CacheItem } from './unified-cache.types';

function createItem(
  namespace: string,
  overrides?: Partial<CacheItem<unknown>>
): CacheItem<unknown> {
  return {
    value: null,
    expires: Date.now() + 60_000,
    created: Date.now(),
    hits: 0,
    namespace,
    ...overrides,
  };
}

describe('createInitialStatsState', () => {
  it('returns all zeros', () => {
    const state = createInitialStatsState();
    expect(state).toEqual({ hits: 0, misses: 0, sets: 0, deletes: 0 });
  });
});

describe('buildCacheStats', () => {
  it('returns correct hit rate', () => {
    const stats: UnifiedCacheStatsState = {
      hits: 3,
      misses: 4,
      sets: 5,
      deletes: 1,
    };
    const cache = new Map<string, CacheItem<unknown>>();
    const result = buildCacheStats(stats, cache, 100);
    // 3 / 7 * 100 = 42.857...
    expect(result.hitRate).toBeCloseTo(42.86, 1);
  });

  it('returns 0 hit rate when no requests', () => {
    const stats: UnifiedCacheStatsState = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
    const cache = new Map<string, CacheItem<unknown>>();
    const result = buildCacheStats(stats, cache, 50);
    expect(result.hitRate).toBe(0);
  });

  it('counts namespaces correctly', () => {
    const stats = createInitialStatsState();
    const cache = new Map<string, CacheItem<unknown>>([
      ['a', createItem('api')],
      ['b', createItem('api')],
      ['c', createItem('ai')],
    ]);
    const result = buildCacheStats(stats, cache, 100);
    expect(result.namespaces).toEqual({ api: 2, ai: 1 });
  });

  it('returns correct memoryUsage string', () => {
    const stats = createInitialStatsState();
    const cache = new Map<string, CacheItem<unknown>>([
      ['a', createItem('x')],
      ['b', createItem('x')],
      ['c', createItem('x')],
    ]);
    // 3 * 0.5 = 1.5 → Math.round → 2
    const result = buildCacheStats(stats, cache, 100);
    expect(result.memoryUsage).toBe('2KB');
  });

  it('passes through maxSize', () => {
    const stats = createInitialStatsState();
    const cache = new Map<string, CacheItem<unknown>>();
    const result = buildCacheStats(stats, cache, 256);
    expect(result.maxSize).toBe(256);
  });

  it('reports correct cache size', () => {
    const stats = createInitialStatsState();
    const cache = new Map<string, CacheItem<unknown>>([
      ['k1', createItem('ns')],
      ['k2', createItem('ns')],
    ]);
    const result = buildCacheStats(stats, cache, 100);
    expect(result.size).toBe(2);
  });

  it('passes through hits, misses, sets, and deletes', () => {
    const stats: UnifiedCacheStatsState = {
      hits: 10,
      misses: 5,
      sets: 20,
      deletes: 3,
    };
    const cache = new Map<string, CacheItem<unknown>>();
    const result = buildCacheStats(stats, cache, 100);
    expect(result.hits).toBe(10);
    expect(result.misses).toBe(5);
    expect(result.sets).toBe(20);
    expect(result.deletes).toBe(3);
  });
});
