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
  getTopQueryPatterns,
  learnQueryPattern,
} from './unified-cache.patterns';
import {
  buildCacheStats,
  createInitialStatsState,
  type UnifiedCacheStatsState,
} from './unified-cache.stats';
import {
  cleanupExpiredEntries,
  evictLeastRecentlyUsed,
  invalidateCacheEntries,
  touchCacheEntry,
} from './unified-cache.store';
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
  private readonly maxPatternSize = 500;
  private maxSize = 5000; // v7.1.0: 1000 → 5000 (반복 API 호출 감소)
  private stats: UnifiedCacheStatsState = createInitialStatsState();
  private inflight = new Map<string, Promise<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

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
    this.destroyed = true;
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.patterns.clear();
    this.inflight.clear();
  }

  private static cleanupRegistered = false;

  static getInstance(): UnifiedCacheService {
    if (!UnifiedCacheService.instance) {
      UnifiedCacheService.instance = new UnifiedCacheService();

      // process.on 핸들러는 최초 1회만 등록 (resetForTesting 반복 시 누적 방지)
      if (
        !UnifiedCacheService.cleanupRegistered &&
        typeof process !== 'undefined' &&
        process.on
      ) {
        UnifiedCacheService.cleanupRegistered = true;
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

    // LRU 순서 갱신: delete + set으로 Map 끝으로 이동 (O(1))
    touchCacheEntry(this.cache, fullKey, item);

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
    if (this.destroyed) return;

    const {
      ttlSeconds = 300,
      namespace = CacheNamespace.GENERAL,
      pattern,
      metadata,
    } = options;

    const fullKey = `${namespace}:${key}`;
    const isOverwrite = this.cache.has(fullKey);

    if (isOverwrite) {
      // 기존 키 갱신: delete → set으로 Map 끝으로 이동 (recency 갱신)
      // 사이즈 불변이므로 eviction 불필요
      this.cache.delete(fullKey);
    } else if (this.cache.size >= this.maxSize) {
      // 신규 키: 용량 초과 시에만 LRU eviction
      evictLeastRecentlyUsed(this.cache, this.stats);
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

    this.stats.sets++;

    // 패턴 학습 (AI 쿼리인 경우)
    if (namespace === CacheNamespace.AI_QUERY && pattern) {
      learnQueryPattern(this.patterns, pattern, metadata, this.maxPatternSize);
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
    if (this.destroyed) return fetcher();

    const { force = false, namespace = CacheNamespace.GENERAL } = options;
    const fullKey = `${namespace}:${key}`;

    if (!force) {
      const cached = await this.get<T>(key, namespace);
      if (cached !== null) {
        return cached;
      }
    }

    // Deduplicate concurrent fetches for the same key
    const existing = this.inflight.get(fullKey);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fetcher()
      .then(async (data) => {
        await this.set(key, data, options);
        return data;
      })
      .finally(() => {
        this.inflight.delete(fullKey);
      });

    this.inflight.set(fullKey, promise);
    return promise;
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
    invalidateCacheEntries(this.cache, this.stats, pattern, namespace);
  }

  /**
   * 만료된 항목 정리
   */
  cleanup(): void {
    cleanupExpiredEntries(this.cache, this.stats);
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
    return buildCacheStats(this.stats, this.cache, this.maxSize);
  }

  /**
   * 패턴 통계 가져오기
   */
  getPatternStats(): QueryPattern[] {
    return getTopQueryPatterns(this.patterns, 10);
  }

  /**
   * 통계 리셋
   */
  resetStats(): void {
    this.stats = createInitialStatsState();
  }
}

// 글로벌 인스턴스 export
export const unifiedCache = UnifiedCacheService.getInstance();

// cache-helpers.ts 공개 API re-export
export {
  createCacheHeaders,
  createCacheHeadersFromPreset,
  getCacheStats,
  normalizeQueryForCache,
} from './cache-helpers';
