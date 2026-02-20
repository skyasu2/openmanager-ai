/**
 * 🚀 통합 캐시 시스템 v3.1
 *
 * 3개의 중복 캐시 시스템을 하나로 통합
 * - Memory 기반 LRU 캐시
 * - AI 쿼리 패턴 캐시 (query-cache-manager.ts)
 * - AI 응답 캐시 (CacheManager.ts)
 *
 * 특징:
 * - 단일 인터페이스로 모든 캐시 기능 제공
 * - 타입별 네임스페이스 지원
 * - 패턴 학습 및 예측
 * - 자동 TTL 관리
 * - LRU 정책
 * - 통계 및 메트릭
 *
 * v3.1 변경사항 (2025-12-10):
 * - TTL 계층화 상수 추가 (SHORT/MEDIUM/LONG/STATIC)
 * - SWR 전략 프리셋 추가
 * - Vercel CDN 헤더 최적화
 */

// 타입 정의
import { logger } from '@/lib/logging';
import { normalizeSemanticCacheQuery } from './query-normalizer';
import {
  type CacheItem,
  CacheNamespace,
  type CacheStats,
  type QueryPattern,
} from './unified-cache.types';

export type { SWRPresetKey } from './unified-cache.types';
export { CacheNamespace, CacheTTL, SWRPreset } from './unified-cache.types';

/**
 * 통합 캐시 서비스
 */
export class UnifiedCacheService {
  private cache = new Map<string, CacheItem<unknown>>();
  private patterns = new Map<string, QueryPattern>();
  private maxSize = 5000; // v7.1.0: 1000 → 5000 (반복 API 호출 감소)
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    namespaces: {} as Record<string, number>,
  };
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Singleton 인스턴스
  private static instance: UnifiedCacheService;

  private constructor() {
    // Runtime별 cleanup 전략
    this.initCleanupStrategy();
  }

  private initCleanupStrategy() {
    try {
      // Edge Runtime 감지 (setInterval 제한 여부 확인)
      if (
        typeof setInterval === 'function' &&
        typeof process !== 'undefined' &&
        process.env.NODE_ENV !== 'test'
      ) {
        // Node.js Runtime: 5분마다 자동 정리
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
      } else {
        // Edge Runtime: 요청별 정리 (cleanup은 수동으로 호출됨)
        // 빌드 시에는 아무것도 하지 않음
      }
    } catch {
      // setInterval 사용 불가 환경: 수동 cleanup만 사용
      logger.warn(
        'Automatic cache cleanup disabled: setInterval not available'
      );
    }
  }

  /**
   * 타이머 정리 및 캐시 해제
   * 프로세스 종료 시 고아 타이머 방지
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.patterns.clear();
  }

  static getInstance(): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService();

      if (typeof process !== 'undefined' && process.on) {
        const cleanup = () => UnifiedCacheService.instance?.destroy();
        process.on('beforeExit', cleanup);
        process.on('SIGTERM', cleanup);
      }
    }
    return UnifiedCacheService.instance;
  }

  /** 테스트 격리용: 싱글톤 인스턴스 리셋 */
  static resetForTesting(): void {
    if (process.env.NODE_ENV !== 'test') return;
    UnifiedCacheService.instance?.destroy();
    UnifiedCacheService.instance = undefined as unknown as UnifiedCacheService;
  }

  /**
   * 캐시에서 값 가져오기
   */
  async get<T>(
    key: string,
    namespace: CacheNamespace = CacheNamespace.GENERAL
  ): Promise<T | null> {
    const fullKey = `${namespace}:${key}`;
    const item = this.cache.get(fullKey);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > item.expires) {
      this.cache.delete(fullKey);
      this.stats.misses++;
      return null;
    }

    item.hits++;
    this.stats.hits++;
    return item.value as T;
  }

  /**
   * 여러 키를 한 번에 조회 (배치 조회)
   */
  async mget<T>(
    keys: string[],
    namespace: CacheNamespace = CacheNamespace.GENERAL
  ): Promise<(T | null)[]> {
    const results: (T | null)[] = [];

    for (const key of keys) {
      const value = await this.get<T>(key, namespace);
      results.push(value);
    }

    return results;
  }

  /**
   * 캐시에 값 저장
   */
  async set<T>(
    key: string,
    value: T,
    options: {
      ttlSeconds?: number;
      namespace?: CacheNamespace;
      pattern?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    const {
      ttlSeconds = 300,
      namespace = CacheNamespace.GENERAL,
      pattern,
      metadata,
    } = options;

    const fullKey = `${namespace}:${key}`;

    // LRU 정책 적용
    if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    this.cache.set(fullKey, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
      created: Date.now(),
      hits: 0,
      namespace: String(namespace),
      pattern,
      metadata,
    });

    // 네임스페이스별 통계 업데이트
    const namespaceKey = String(namespace);
    this.stats.namespaces[namespaceKey] =
      (this.stats.namespaces[namespaceKey] || 0) + 1;
    this.stats.sets++;

    // 패턴 학습 (AI 쿼리인 경우)
    if (namespace === CacheNamespace.AI_QUERY && pattern) {
      this.learnPattern(pattern, metadata);
    }
  }

  /**
   * 캐시 또는 페칭 패턴
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: {
      ttlSeconds?: number;
      namespace?: CacheNamespace;
      force?: boolean;
    } = {}
  ): Promise<T> {
    const { force = false, namespace = CacheNamespace.GENERAL } = options;

    if (!force) {
      const cached = await this.get<T>(key, namespace);
      if (cached !== null) {
        return cached;
      }
    }

    const data = await fetcher();
    await this.set(key, data, options);
    return data;
  }

  /**
   * 패턴 학습 (AI 쿼리용)
   */
  private learnPattern(
    pattern: string,
    metadata?: Record<string, unknown>
  ): void {
    const patternKey = this.normalizePattern(pattern);
    const existing = this.patterns.get(patternKey);

    if (existing) {
      existing.frequency++;
      existing.hits++;
      existing.lastUsed = new Date();
      if (metadata?.responseTime) {
        existing.avgResponseTime =
          (existing.avgResponseTime * (existing.hits - 1) +
            (metadata.responseTime as number)) /
          existing.hits;
      }
    } else {
      this.patterns.set(patternKey, {
        id: patternKey,
        regex: pattern,
        frequency: 1,
        avgResponseTime: (metadata?.responseTime as number) || 0,
        lastUsed: new Date(),
        hits: 1,
      });
    }
  }

  /**
   * 패턴 정규화
   */
  private normalizePattern(pattern: string): string {
    return pattern
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .trim();
  }

  /** AI 쿼리 정규화 키 생성 (구두점/공백/대소문자 표준화) */
  normalizeQueryForCache(query: string): string {
    return normalizeSemanticCacheQuery(query);
  }

  /**
   * 캐시 무효화
   */
  async invalidate(
    pattern?: string,
    namespace?: CacheNamespace
  ): Promise<void> {
    if (!pattern && !namespace) {
      this.cache.clear();
      this.stats.deletes += this.cache.size;
      return;
    }

    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      const item = this.cache.get(key) ?? null;
      if (!item) continue;

      // 네임스페이스 매칭
      if (namespace && item.namespace !== String(namespace)) continue;

      // 패턴 매칭
      if (pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        if (!regex.test(key)) continue;
      }

      keysToDelete.push(key);
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.stats.deletes++;
    });
  }

  /**
   * LRU 정책으로 가장 오래된/적게 사용된 항목 제거
   */
  private evictLeastRecentlyUsed(): void {
    let leastUsedKey = '';
    let leastHits = Infinity;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (
        item.hits < leastHits ||
        (item.hits === leastHits && item.created < oldestTime)
      ) {
        leastHits = item.hits;
        oldestTime = item.created;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      const item = this.cache.get(leastUsedKey);
      if (item?.namespace && typeof item.namespace === 'string') {
        const currentCount = this.stats.namespaces[item.namespace];
        if (currentCount !== undefined && currentCount > 0) {
          this.stats.namespaces[item.namespace] = currentCount - 1;
        }
      }
      this.cache.delete(leastUsedKey);
      this.stats.deletes++;
    }
  }

  /**
   * 만료된 항목 정리
   */
  cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, item] of this.cache.entries()) {
      if (item?.expires <= now) {
        expiredKeys.push(key);
        if (item?.namespace && typeof item.namespace === 'string') {
          const currentCount = this.stats.namespaces[item.namespace];
          if (currentCount !== undefined && currentCount > 0) {
            this.stats.namespaces[item.namespace] = currentCount - 1;
          }
        }
      }
    }

    expiredKeys.forEach((key) => {
      this.cache.delete(key);
      this.stats.deletes++;
    });
  }

  /**
   * AI 쿼리 캐시 조회 (정규화된 키 사용) - v3.2
   *
   * @description
   * 쿼리를 정규화하여 캐시 히트율 향상
   * "상태?", "상태!", "상태" 모두 동일한 캐시 응답 반환
   */
  async getAIQueryCache<T>(query: string): Promise<T | null> {
    const normalizedKey = this.normalizeQueryForCache(query);
    return this.get<T>(normalizedKey, CacheNamespace.AI_QUERY);
  }

  /**
   * AI 쿼리 캐시 저장 (정규화된 키 사용) - v3.2
   */
  async setAIQueryCache<T>(
    query: string,
    value: T,
    options: {
      ttlSeconds?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    const normalizedKey = this.normalizeQueryForCache(query);
    await this.set(normalizedKey, value, {
      ttlSeconds: options.ttlSeconds ?? 300,
      namespace: CacheNamespace.AI_QUERY,
      pattern: query, // 원본 쿼리는 패턴 학습용으로 보존
      metadata: options.metadata,
    });
  }

  /**
   * AI 쿼리 캐시 또는 페칭 (정규화된 키 사용) - v3.2
   */
  async getOrFetchAIQuery<T>(
    query: string,
    fetcher: () => Promise<T>,
    options: {
      ttlSeconds?: number;
      force?: boolean;
    } = {}
  ): Promise<T> {
    const normalizedKey = this.normalizeQueryForCache(query);
    return this.getOrFetch(normalizedKey, fetcher, {
      ttlSeconds: options.ttlSeconds ?? 300,
      namespace: CacheNamespace.AI_QUERY,
      force: options.force,
    });
  }

  /**
   * 통계 정보 가져오기
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const namespaceCount: Record<string, number> = {};

    // 현재 네임스페이스별 카운트
    for (const item of this.cache.values()) {
      namespaceCount[item.namespace] =
        (namespaceCount[item.namespace] || 0) + 1;
    }

    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      memoryUsage: `${Math.round(this.cache.size * 0.5)}KB`,
      namespaces: namespaceCount,
    };
  }

  /**
   * 패턴 통계 가져오기
   */
  getPatternStats(): QueryPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10 패턴
  }

  /**
   * 통계 리셋
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      namespaces: {},
    };
  }
}

// 글로벌 인스턴스 export
export const unifiedCache = UnifiedCacheService.getInstance();

// 하위 호환성을 위한 wrapper 함수들 (구현은 cache-helpers.ts에 위치)
export {
  cacheOrFetch,
  cacheWrapper,
  createCachedResponse,
  createCacheHeaders,
  createCacheHeadersFromPreset,
  getAIQueryCache,
  getCachedData,
  getCachedDataWithFallback,
  getCacheStats,
  getOrFetchAIQuery,
  invalidateCache,
  normalizeQueryForCache,
  setAIQueryCache,
  setCachedData,
} from './cache-helpers';
