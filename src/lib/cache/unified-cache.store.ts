import {
  decrementNamespaceCount,
  type UnifiedCacheStatsState,
} from './unified-cache.stats';
import type { CacheItem } from './unified-cache.types';

function buildGlobRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
}

export function touchCacheEntry<T>(
  cache: Map<string, CacheItem<T>>,
  fullKey: string,
  item: CacheItem<T>
): void {
  cache.delete(fullKey);
  cache.set(fullKey, item);
}

export function evictLeastRecentlyUsed(
  cache: Map<string, CacheItem<unknown>>,
  stats: UnifiedCacheStatsState
): void {
  const firstKey = cache.keys().next().value;
  if (firstKey === undefined) return;

  const item = cache.get(firstKey);
  if (item?.namespace) {
    decrementNamespaceCount(stats, item.namespace);
  }

  cache.delete(firstKey);
  stats.deletes++;
}

export function cleanupExpiredEntries(
  cache: Map<string, CacheItem<unknown>>,
  stats: UnifiedCacheStatsState,
  now = Date.now()
): void {
  const expiredKeys: string[] = [];

  for (const [key, item] of cache.entries()) {
    if (item.expires <= now) {
      expiredKeys.push(key);
      if (item.namespace) {
        decrementNamespaceCount(stats, item.namespace);
      }
    }
  }

  for (const key of expiredKeys) {
    cache.delete(key);
    stats.deletes++;
  }
}

export function invalidateCacheEntries(
  cache: Map<string, CacheItem<unknown>>,
  stats: UnifiedCacheStatsState,
  pattern?: string,
  namespace?: string
): number {
  if (!pattern && !namespace) {
    const size = cache.size;
    cache.clear();
    stats.deletes += size;
    return size;
  }

  const regex = pattern ? buildGlobRegex(pattern) : null;
  const keysToDelete: string[] = [];

  for (const [key, item] of cache.entries()) {
    if (namespace && item.namespace !== namespace) continue;
    if (regex && !regex.test(key)) continue;
    keysToDelete.push(key);
  }

  for (const key of keysToDelete) {
    const item = cache.get(key);
    if (item?.namespace) {
      decrementNamespaceCount(stats, item.namespace);
    }
    cache.delete(key);
    stats.deletes++;
  }

  return keysToDelete.length;
}
