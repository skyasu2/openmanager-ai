import type { CacheItem, CacheStats } from './unified-cache.types';

export interface UnifiedCacheStatsState {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  namespaces: Record<string, number>;
}

export function createInitialStatsState(): UnifiedCacheStatsState {
  return {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    namespaces: {},
  };
}

export function incrementNamespaceCount(
  stats: UnifiedCacheStatsState,
  namespace: string
): void {
  stats.namespaces[namespace] = (stats.namespaces[namespace] || 0) + 1;
}

export function decrementNamespaceCount(
  stats: UnifiedCacheStatsState,
  namespace: string
): void {
  const currentCount = stats.namespaces[namespace];
  if (currentCount !== undefined && currentCount > 0) {
    stats.namespaces[namespace] = currentCount - 1;
  }
}

export function buildCacheStats(
  stats: UnifiedCacheStatsState,
  cache: Map<string, CacheItem<unknown>>,
  maxSize: number
): CacheStats {
  const totalRequests = stats.hits + stats.misses;
  const namespaceCount: Record<string, number> = {};

  for (const item of cache.values()) {
    namespaceCount[item.namespace] = (namespaceCount[item.namespace] || 0) + 1;
  }

  return {
    ...stats,
    size: cache.size,
    maxSize,
    hitRate: totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0,
    memoryUsage: `${Math.round(cache.size * 0.5)}KB`,
    namespaces: namespaceCount,
  };
}
