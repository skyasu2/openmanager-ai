/**
 * Data Cache Layer for AI Engine
 *
 * Provides TTL-based caching for frequently accessed data:
 * - Metrics: 1 minute TTL (real-time but not excessive)
 * - RAG/Historical: 5 minutes TTL (context data)
 * - Analysis: 10 minutes TTL (computed results)
 */

import { logger } from './logger';

// ============================================================================
// 1. Types
// ============================================================================

export interface CacheConfig {
  ttl: {
    metrics: number;     // 메트릭 캐시 TTL (ms)
    rag: number;         // RAG/히스토리 캐시 TTL (ms)
    analysis: number;    // 분석 결과 캐시 TTL (ms)
  };
  maxSize: number;       // 최대 캐시 엔트리 수
}

interface CachedItem<T> {
  data: T;
  cachedAt: number;
  ttl: number;
  hits: number;
}

interface CacheStats {
  totalEntries: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

type CacheType = 'metrics' | 'rag' | 'analysis';

// ============================================================================
// 2. Default Configuration
// ============================================================================

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttl: {
    metrics: 60_000,      // 1분
    rag: 300_000,         // 5분
    analysis: 600_000,    // 10분
  },
  maxSize: 500,           // 최대 500개 엔트리
};

// ============================================================================
// 3. Cache Layer Implementation
// ============================================================================

export class DataCacheLayer {
  private cache: Map<string, CachedItem<unknown>> = new Map();
  private config: CacheConfig;
  private hitCount = 0;
  private missCount = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      ttl: {
        ...DEFAULT_CACHE_CONFIG.ttl,
        ...config.ttl,
      },
      maxSize: config.maxSize ?? DEFAULT_CACHE_CONFIG.maxSize,
    };
  }

  // ============================================================================
  // 3.1 Core Cache Operations
  // ============================================================================

  /**
   * Generate cache key with type prefix
   */
  private generateKey(type: CacheType, identifier: string): string {
    return `${type}:${identifier}`;
  }

  /**
   * Get TTL for cache type
   */
  private getTTL(type: CacheType): number {
    return this.config.ttl[type];
  }

  /**
   * Check if cached item is still valid
   */
  private isValid<T>(item: CachedItem<T>): boolean {
    return Date.now() - item.cachedAt < item.ttl;
  }

  /**
   * Evict expired entries and enforce max size
   */
  private cleanup(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    // Find expired entries
    for (const [key, item] of this.cache.entries()) {
      if (now - item.cachedAt >= item.ttl) {
        entriesToDelete.push(key);
      }
    }

    // Delete expired entries
    for (const key of entriesToDelete) {
      this.cache.delete(key);
    }

    // Enforce max size (LRU-like: delete oldest entries first)
    if (this.cache.size > this.config.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].cachedAt - b[1].cachedAt);

      const deleteCount = this.cache.size - this.config.maxSize;
      for (let i = 0; i < deleteCount; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Get item from cache
   */
  get<T>(type: CacheType, identifier: string): T | null {
    const key = this.generateKey(type, identifier);
    const item = this.cache.get(key) as CachedItem<T> | undefined;

    if (!item) {
      this.missCount++;
      return null;
    }

    if (!this.isValid(item)) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    // Update hit count
    item.hits++;
    this.hitCount++;
    return item.data;
  }

  /**
   * Set item in cache
   * 🎯 P2-4 Fix: Cleanup BEFORE insert to prevent temporary maxSize overflow
   */
  set<T>(type: CacheType, identifier: string, data: T): void {
    const key = this.generateKey(type, identifier);

    // P2-4: Pre-insert size check and cleanup
    // If at or over capacity (before new insert), cleanup first
    if (this.cache.size >= this.config.maxSize) {
      this.cleanup();

      // 🎯 P2-6 Fix: If still at capacity after cleanup, force-evict oldest entry
      // TypeScript strict mode: iterator.next().value is T | undefined
      if (this.cache.size >= this.config.maxSize) {
        const iterator = this.cache.keys();
        const firstResult = iterator.next();
        if (!firstResult.done && firstResult.value !== undefined) {
          this.cache.delete(firstResult.value);
        }
      }
    }

    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
      ttl: this.getTTL(type),
      hits: 0,
    });
  }

  /**
   * Get or compute: returns cached value or computes and caches new value
   */
  async getOrCompute<T>(
    type: CacheType,
    identifier: string,
    compute: () => Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(type, identifier);
    if (cached !== null) {
      return cached;
    }

    const result = await compute();
    this.set(type, identifier, result);
    return result;
  }

  /**
   * Invalidate specific cache entry
   */
  invalidate(type: CacheType, identifier: string): boolean {
    const key = this.generateKey(type, identifier);
    return this.cache.delete(key);
  }

  /**
   * Invalidate all entries of a specific type
   */
  invalidateByType(type: CacheType): number {
    const prefix = `${type}:`;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  // ============================================================================
  // 3.2 High-Level Cache Methods
  // ============================================================================

  /**
   * Cache metrics data
   * @param serverId - Optional server ID for filtering
   * @param fetcher - Function to fetch metrics if not cached
   */
  async getMetrics<T>(
    serverId: string | undefined,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const identifier = serverId || 'all';
    return this.getOrCompute('metrics', identifier, fetcher);
  }

  /**
   * Cache historical context / RAG results
   * @param query - Query string or identifier
   * @param fetcher - Function to fetch if not cached
   */
  async getHistoricalContext<T>(
    query: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const identifier = this.hashQuery(query);
    return this.getOrCompute('rag', identifier, fetcher);
  }

  /**
   * Cache analysis results
   * @param analysisType - Type of analysis (e.g., 'anomaly', 'trend')
   * @param params - Analysis parameters
   * @param analyzer - Function to compute analysis if not cached
   */
  async getAnalysis<T>(
    analysisType: string,
    params: Record<string, unknown>,
    analyzer: () => Promise<T>
  ): Promise<T> {
    const identifier = `${analysisType}:${this.hashParams(params)}`;
    return this.getOrCompute('analysis', identifier, analyzer);
  }

  // ============================================================================
  // 3.3 Utility Methods
  // ============================================================================

  /**
   * Simple hash for query strings
   */
  private hashQuery(query: string): string {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Hash parameters object
   */
  private hashParams(params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .map(k => `${k}:${JSON.stringify(params[k])}`)
      .join('|');
    return this.hashQuery(sorted);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const total = this.hitCount + this.missCount;

    return {
      totalEntries: this.cache.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: total > 0 ? this.hitCount / total : 0,
      oldestEntry: entries.length > 0
        ? Math.min(...entries.map(e => e.cachedAt))
        : null,
      newestEntry: entries.length > 0
        ? Math.max(...entries.map(e => e.cachedAt))
        : null,
    };
  }

  /**
   * Get detailed cache info for debugging
   */
  getDebugInfo(): {
    stats: CacheStats;
    entriesByType: Record<CacheType, number>;
    config: CacheConfig;
  } {
    const entriesByType: Record<CacheType, number> = {
      metrics: 0,
      rag: 0,
      analysis: 0,
    };

    for (const key of this.cache.keys()) {
      const type = key.split(':')[0] as CacheType;
      if (type in entriesByType) {
        entriesByType[type]++;
      }
    }

    return {
      stats: this.getStats(),
      entriesByType,
      config: this.config,
    };
  }
}

// ============================================================================
// 4. Singleton Instance
// ============================================================================

let cacheInstance: DataCacheLayer | null = null;

/**
 * Get the global cache instance
 */
export function getDataCache(config?: Partial<CacheConfig>): DataCacheLayer {
  if (!cacheInstance) {
    cacheInstance = new DataCacheLayer(config);
    logger.info('[DataCache] Initialized with config:', {
      ttlMetrics: `${DEFAULT_CACHE_CONFIG.ttl.metrics / 1000}s`,
      ttlRag: `${DEFAULT_CACHE_CONFIG.ttl.rag / 1000}s`,
      ttlAnalysis: `${DEFAULT_CACHE_CONFIG.ttl.analysis / 1000}s`,
      maxSize: config?.maxSize ?? DEFAULT_CACHE_CONFIG.maxSize,
    });
  }
  return cacheInstance;
}

/**
 * Reset the global cache instance (for testing)
 */
export function resetDataCache(): void {
  if (cacheInstance) {
    cacheInstance.clear();
    cacheInstance = null;
    logger.info('[DataCache] Reset');
  }
}
