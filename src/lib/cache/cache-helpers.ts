/**
 * 캐시 헬퍼 함수들
 *
 * unified-cache.ts의 UnifiedCacheService를 래핑하는 유틸리티 함수
 * 하위 호환성 + 간편 API 제공
 */

import {
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

export function getCacheStats() {
  const cache = UnifiedCacheService.getInstance();
  return cache.getStats();
}

export function normalizeQueryForCache(query: string): string {
  const cache = UnifiedCacheService.getInstance();
  return cache.normalizeQueryForCache(query);
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
