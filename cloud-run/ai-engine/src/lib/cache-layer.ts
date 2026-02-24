/**
 * Data Cache Layer for AI Engine (Hybrid Memory + Redis)
 *
 * Provides TTL-based caching for frequently accessed data:
 * - L1: In-Memory (Local Node.js)
 * - L2: Redis (Global Persistent / Shared)
 */

import { createHash } from 'node:crypto';
import { logger } from './logger';
import { RedisClient } from './redis-client';

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
  private memoryCache: Map<string, CachedItem<unknown>> = new Map();
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

  private generateKey(type: CacheType, identifier: string): string {
    return `${type}:${identifier}`;
  }

  private getTTL(type: CacheType): number {
    return this.config.ttl[type];
  }

  private isValid<T>(item: CachedItem<T>): boolean {
    return Date.now() - item.cachedAt < item.ttl;
  }

  /**
   * Get item from Hybrid Cache (L1 Memory -> L2 Redis)
   */
  async get<T>(type: CacheType, identifier: string): Promise<T | null> {
    const key = this.generateKey(type, identifier);
    
    // 1. Check L1 In-Memory Cache
    const item = this.memoryCache.get(key) as CachedItem<T> | undefined;
    if (item && this.isValid(item)) {
      item.hits++;
      this.hitCount++;
      logger.debug(`[Cache] L1 HIT: ${key}`);
      return item.data;
    }

    // 2. Check L2 Redis Cache
    try {
      const redisData = await RedisClient.get<T>(`global:cache:${key}`);
      if (redisData) {
        // Hydrate L1 cache from L2
        this.setLocal(type, identifier, redisData);
        this.hitCount++;
        logger.debug(`[Cache] L2 HIT (Redis): ${key}`);
        return redisData;
      }
    } catch (err) {
      logger.error(`[Cache] L2 Retrieval failed: ${key}`, err);
    }

    this.missCount++;
    logger.debug(`[Cache] MISS: ${key}`);
    return null;
  }

  /**
   * Set item in Hybrid Cache (Memory + Redis)
   */
  async set<T>(type: CacheType, identifier: string, data: T): Promise<void> {
    const key = this.generateKey(type, identifier);
    const ttlMs = this.getTTL(type);

    // 1. Set Local Memory (L1)
    this.setLocal(type, identifier, data);

    // 2. Set Global Redis (L2) - Async (do not await to minimize latency)
    RedisClient.set(`global:cache:${key}`, data, Math.floor(ttlMs / 1000)).catch(err => {
      logger.error(`[Cache] L2 Save failed: ${key}`, err);
    });
  }

  /**
   * Internal local set with size management
   */
  private setLocal<T>(type: CacheType, identifier: string, data: T): void {
    const key = this.generateKey(type, identifier);
    
    if (this.memoryCache.size >= this.config.maxSize) {
      this.cleanup();
    }

    this.memoryCache.set(key, {
      data,
      cachedAt: Date.now(),
      ttl: this.getTTL(type),
      hits: 0,
    });
  }

  private cleanup(): void {
    const now = Date.now();
    // 1. 만료된 항목 제거
    for (const [key, item] of this.memoryCache.entries()) {
      if (now - item.cachedAt >= item.ttl) {
        this.memoryCache.delete(key);
      }
    }
    // 2. 여전히 초과면 LRU 방식으로 최소 hit 항목 제거
    if (this.memoryCache.size > this.config.maxSize) {
      let lruKey: string | null = null;
      let lruHits = Infinity;
      for (const [key, item] of this.memoryCache.entries()) {
        if (item.hits < lruHits) {
          lruHits = item.hits;
          lruKey = key;
        }
      }
      if (lruKey) this.memoryCache.delete(lruKey);
    }
  }

  /**
   * Get or compute: returns cached value or computes and caches new value
   */
  async getOrCompute<T>(
    type: CacheType,
    identifier: string,
    compute: () => Promise<T>
  ): Promise<T> {
    const cached = await this.get<T>(type, identifier);
    if (cached !== null) {
      return cached;
    }

    const result = await compute();
    await this.set(type, identifier, result);
    return result;
  }

  /**
   * Invalidate specific cache entry (Both L1 and L2)
   */
  async invalidate(type: CacheType, identifier: string): Promise<boolean> {
    const key = this.generateKey(type, identifier);
    const deletedLocal = this.memoryCache.delete(key);
    await RedisClient.del(`global:cache:${key}`);
    return deletedLocal;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    // Note: Global clear not implemented to avoid accidental wide impact
    this.hitCount = 0;
    this.missCount = 0;
  }

  // ============================================================================
  // 3.2 High-Level Cache Methods
  // ============================================================================

  async getMetrics<T>(
    serverId: string | undefined,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const identifier = serverId || 'all';
    return this.getOrCompute('metrics', identifier, fetcher);
  }

  async getHistoricalContext<T>(
    query: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const identifier = this.hashQuery(query);
    return this.getOrCompute('rag', identifier, fetcher);
  }

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

  private hashQuery(query: string): string {
    return createHash('sha256').update(query).digest('hex').slice(0, 16);
  }

  private hashParams(params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
      .sort()
      .map(k => `${k}:${JSON.stringify(params[k])}`)
      .join('|');
    return this.hashQuery(sorted);
  }
}

// ============================================================================
// 4. Singleton Instance
// ============================================================================

let cacheInstance: DataCacheLayer | null = null;

export function getDataCache(config?: Partial<CacheConfig>): DataCacheLayer {
  if (!cacheInstance) {
    cacheInstance = new DataCacheLayer(config);
    logger.info('[DataCache] Initialized with Hybrid (Memory + Redis) mode');
  }
  return cacheInstance;
}

export function resetDataCache(): void {
  if (cacheInstance) {
    cacheInstance.clear();
    cacheInstance = null;
    logger.info('[DataCache] Reset');
  }
}
