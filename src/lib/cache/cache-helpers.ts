/**
 * 캐시 헬퍼 함수들
 *
 * unified-cache.ts의 UnifiedCacheService를 래핑하는 유틸리티 함수
 * 하위 호환성 + 간편 API 제공
 */

import {
  CacheNamespace,
  CacheTTL,
  SWRPreset,
  type SWRPresetKey,
  UnifiedCacheService,
} from './unified-cache';

// ============================================================================
// 해시 유틸리티 (djb2 알고리즘 — 빠르고 충돌이 적음)
// ============================================================================

export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ============================================================================
// 기본 캐시 유틸리티
// ============================================================================

export async function getCachedData<T>(key: string): Promise<T | null> {
  const cache = UnifiedCacheService.getInstance();
  return await cache.get<T>(key, CacheNamespace.GENERAL);
}

export async function setCachedData<T>(
  key: string,
  data: T,
  ttlSeconds: number = 300
): Promise<void> {
  const cache = UnifiedCacheService.getInstance();
  await cache.set(key, data, { ttlSeconds, namespace: CacheNamespace.GENERAL });
}

export async function cacheOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: {
    ttl?: number;
    force?: boolean;
  }
): Promise<T> {
  const cache = UnifiedCacheService.getInstance();
  return cache.getOrFetch(key, fetcher, {
    ttlSeconds: options?.ttl,
    force: options?.force,
    namespace: CacheNamespace.GENERAL,
  });
}

export async function invalidateCache(pattern?: string): Promise<void> {
  const cache = UnifiedCacheService.getInstance();
  return cache.invalidate(pattern);
}

export function getCacheStats() {
  const cache = UnifiedCacheService.getInstance();
  return cache.getStats();
}

// ============================================================================
// AI 쿼리 캐시 유틸리티 (v3.2)
// ============================================================================

export async function getAIQueryCache<T>(query: string): Promise<T | null> {
  const cache = UnifiedCacheService.getInstance();
  return cache.getAIQueryCache<T>(query);
}

export async function setAIQueryCache<T>(
  query: string,
  value: T,
  options?: { ttlSeconds?: number; metadata?: Record<string, unknown> }
): Promise<void> {
  const cache = UnifiedCacheService.getInstance();
  return cache.setAIQueryCache(query, value, options);
}

export async function getOrFetchAIQuery<T>(
  query: string,
  fetcher: () => Promise<T>,
  options?: { ttlSeconds?: number; force?: boolean }
): Promise<T> {
  const cache = UnifiedCacheService.getInstance();
  return cache.getOrFetchAIQuery(query, fetcher, options);
}

export function normalizeQueryForCache(query: string): string {
  const cache = UnifiedCacheService.getInstance();
  return cache.normalizeQueryForCache(query);
}

// ============================================================================
// Fallback / Wrapper 유틸리티
// ============================================================================

export async function getCachedDataWithFallback<T>(
  key: string,
  fallback: () => Promise<T>,
  ttlSeconds: number = 300,
  namespace: CacheNamespace = CacheNamespace.GENERAL
): Promise<T> {
  const cache = UnifiedCacheService.getInstance();
  return cache.getOrFetch(key, fallback, { ttlSeconds, namespace });
}

export function cacheWrapper<T extends unknown[], R>(
  key: string,
  fn: (...args: T) => Promise<R>,
  ttlSeconds: number = 300
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const cache = UnifiedCacheService.getInstance();
    const cacheKey = `${key}:${JSON.stringify(args)}`;
    return cache.getOrFetch(cacheKey, () => fn(...args), {
      ttlSeconds,
      namespace: CacheNamespace.GENERAL,
    });
  };
}

// ============================================================================
// HTTP 캐시 헤더 유틸리티 (v3.1)
// ============================================================================

export function createCacheHeaders(
  options: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    isPrivate?: boolean;
  } = {}
): Record<string, string> {
  const {
    maxAge = 0,
    sMaxAge = CacheTTL.SHORT,
    staleWhileRevalidate = CacheTTL.SHORT * 2,
    isPrivate = false,
  } = options;

  const cacheControl = [
    isPrivate ? 'private' : 'public',
    `max-age=${maxAge}`,
    `s-maxage=${sMaxAge}`,
    `stale-while-revalidate=${staleWhileRevalidate}`,
  ].join(', ');

  return {
    'Cache-Control': cacheControl,
    'CDN-Cache-Control': `public, s-maxage=${sMaxAge}`,
    'Vercel-CDN-Cache-Control': `public, s-maxage=${sMaxAge}`,
  };
}

export function createCacheHeadersFromPreset(
  preset: SWRPresetKey,
  isPrivate = false
): Record<string, string> {
  const config = SWRPreset[preset];
  return createCacheHeaders({ ...config, isPrivate });
}

export function createCachedResponse<T>(
  data: T,
  options:
    | {
        status?: number;
        maxAge?: number;
        sMaxAge?: number;
        staleWhileRevalidate?: number;
        isPrivate?: boolean;
      }
    | { status?: number; preset: SWRPresetKey; isPrivate?: boolean } = {}
): Response {
  let cacheOptions: {
    maxAge?: number;
    sMaxAge?: number;
    staleWhileRevalidate?: number;
    isPrivate?: boolean;
  };

  if ('preset' in options) {
    cacheOptions = {
      ...SWRPreset[options.preset],
      isPrivate: options.isPrivate,
    };
  } else {
    cacheOptions = options;
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...createCacheHeaders(cacheOptions),
  });

  return new Response(JSON.stringify(data), {
    status: options.status ?? 200,
    headers,
  });
}
