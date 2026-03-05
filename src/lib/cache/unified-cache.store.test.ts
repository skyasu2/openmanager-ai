import { describe, expect, it } from 'vitest';
import type { UnifiedCacheStatsState } from './unified-cache.stats';
import type { CacheItem } from './unified-cache.types';
import {
  cleanupExpiredEntries,
  evictLeastRecentlyUsed,
  invalidateCacheEntries,
  touchCacheEntry,
} from './unified-cache.store';

function createItem<T = string>(overrides: Partial<CacheItem<T>> = {}): CacheItem<T> {
  return {
    value: 'default' as unknown as T,
    expires: Date.now() + 60_000,
    created: Date.now(),
    hits: 0,
    namespace: 'test',
    ...overrides,
  };
}

function createStats(): UnifiedCacheStatsState {
  return { hits: 0, misses: 0, sets: 0, deletes: 0 };
}

describe('touchCacheEntry', () => {
  it('moves existing key to end of Map (LRU touch)', () => {
    const cache = new Map<string, CacheItem<string>>();
    const itemA = createItem<string>({ value: 'a' });
    const itemB = createItem<string>({ value: 'b' });
    cache.set('key-a', itemA);
    cache.set('key-b', itemB);

    const updatedA = createItem<string>({ value: 'a-updated' });
    touchCacheEntry(cache, 'key-a', updatedA);

    const keys = [...cache.keys()];
    expect(keys).toEqual(['key-b', 'key-a']);
    expect(cache.get('key-a')).toBe(updatedA);
  });

  it('adds new key if not present', () => {
    const cache = new Map<string, CacheItem<string>>();
    const item = createItem<string>({ value: 'new' });

    touchCacheEntry(cache, 'new-key', item);

    expect(cache.size).toBe(1);
    expect(cache.get('new-key')).toBe(item);
  });
});

describe('evictLeastRecentlyUsed', () => {
  it('removes first entry and increments stats.deletes', () => {
    const cache = new Map<string, CacheItem<unknown>>();
    cache.set('first', createItem({ value: 1 }));
    cache.set('second', createItem({ value: 2 }));
    const stats = createStats();

    evictLeastRecentlyUsed(cache, stats);

    expect(cache.size).toBe(1);
    expect(cache.has('first')).toBe(false);
    expect(cache.has('second')).toBe(true);
    expect(stats.deletes).toBe(1);
  });

  it('does nothing on empty cache', () => {
    const cache = new Map<string, CacheItem<unknown>>();
    const stats = createStats();

    evictLeastRecentlyUsed(cache, stats);

    expect(cache.size).toBe(0);
    expect(stats.deletes).toBe(0);
  });
});

describe('cleanupExpiredEntries', () => {
  it('removes expired entries and keeps non-expired', () => {
    const now = 1000;
    const cache = new Map<string, CacheItem<unknown>>();
    cache.set('expired', createItem({ value: 'old', expires: 500 }));
    cache.set('valid', createItem({ value: 'fresh', expires: 2000 }));
    const stats = createStats();

    cleanupExpiredEntries(cache, stats, now);

    expect(cache.size).toBe(1);
    expect(cache.has('expired')).toBe(false);
    expect(cache.has('valid')).toBe(true);
  });

  it('increments stats.deletes per expired entry', () => {
    const now = 1000;
    const cache = new Map<string, CacheItem<unknown>>();
    cache.set('exp1', createItem({ expires: 100 }));
    cache.set('exp2', createItem({ expires: 200 }));
    cache.set('exp3', createItem({ expires: 300 }));
    const stats = createStats();

    cleanupExpiredEntries(cache, stats, now);

    expect(stats.deletes).toBe(3);
    expect(cache.size).toBe(0);
  });
});

describe('invalidateCacheEntries', () => {
  it('clears all entries and returns count when no pattern or namespace', () => {
    const cache = new Map<string, CacheItem<unknown>>();
    cache.set('a', createItem());
    cache.set('b', createItem());
    cache.set('c', createItem());
    const stats = createStats();

    const count = invalidateCacheEntries(cache, stats);

    expect(count).toBe(3);
    expect(cache.size).toBe(0);
    expect(stats.deletes).toBe(3);
  });

  it('matches keys using glob pattern', () => {
    const cache = new Map<string, CacheItem<unknown>>();
    cache.set('api:users', createItem({ namespace: 'api' }));
    cache.set('api:posts', createItem({ namespace: 'api' }));
    cache.set('db:sessions', createItem({ namespace: 'db' }));
    const stats = createStats();

    const count = invalidateCacheEntries(cache, stats, 'api:*');

    expect(count).toBe(2);
    expect(cache.has('api:users')).toBe(false);
    expect(cache.has('api:posts')).toBe(false);
    expect(cache.has('db:sessions')).toBe(true);
    expect(stats.deletes).toBe(2);
  });

  it('filters by namespace only', () => {
    const cache = new Map<string, CacheItem<unknown>>();
    cache.set('key1', createItem({ namespace: 'ns-a' }));
    cache.set('key2', createItem({ namespace: 'ns-b' }));
    cache.set('key3', createItem({ namespace: 'ns-a' }));
    const stats = createStats();

    const count = invalidateCacheEntries(cache, stats, undefined, 'ns-a');

    expect(count).toBe(2);
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key3')).toBe(false);
    expect(cache.has('key2')).toBe(true);
  });

  it('combines pattern and namespace filtering', () => {
    const cache = new Map<string, CacheItem<unknown>>();
    cache.set('api:users', createItem({ namespace: 'api' }));
    cache.set('api:posts', createItem({ namespace: 'other' }));
    cache.set('db:users', createItem({ namespace: 'api' }));
    const stats = createStats();

    const count = invalidateCacheEntries(cache, stats, 'api:*', 'api');

    expect(count).toBe(1);
    expect(cache.has('api:users')).toBe(false);
    expect(cache.has('api:posts')).toBe(true);
    expect(cache.has('db:users')).toBe(true);
    expect(stats.deletes).toBe(1);
  });
});
