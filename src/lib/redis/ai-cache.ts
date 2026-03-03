/**
 * AI Response Cache
 *
 * Cloud Run 호출 최소화 & Google AI RPD 절감
 * - 쿼리 해시 기반 캐싱
 * - TTL: 1시간 (신선도 유지)
 * - 캐시 히트 시 Cloud Run 호출 생략
 *
 * @module redis/ai-cache
 */

import type { Redis } from '@upstash/redis';
import { hashString, normalizeQueryForCache } from '@/lib/cache/cache-helpers';
import { logger } from '@/lib/logging';
import { getRedisClient, isRedisDisabled, isRedisEnabled } from './client';

// ==============================================
// 🎯 타입 정의
// ==============================================

/** Redis 캐시용 AI 응답 (경량 구조) */
export interface CachedAIResponse {
  content: string;
  model?: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface CacheResult<T> {
  hit: boolean;
  data: T | null;
  latencyMs?: number;
  ttlRemaining?: number;
}

// ==============================================
// 🔧 설정
// ==============================================

const CACHE_CONFIG = {
  /** AI 응답 캐시 TTL (1시간) */
  AI_RESPONSE_TTL_SECONDS: 3600,
  /** 캐시 키 prefix (v2: endpoint 격리 적용) */
  PREFIX: {
    AI_RESPONSE: 'v2:ai:response',
    SESSION: 'session',
  },
} as const;

// ==============================================
/**
 * AI 쿼리 해시 생성
 * 세션 ID + 쿼리 내용 + endpoint 조합 (v2: endpoint 격리)
 */
export function generateQueryHash(
  sessionId: string,
  query: string,
  endpoint?: string
): string {
  const normalized = normalizeQueryForCache(query);
  const endpointSegment = endpoint ? `${endpoint}:` : '';
  return `${endpointSegment}${hashString(sessionId)}:${hashString(normalized)}`;
}

// ==============================================
// 🔍 SCAN 유틸리티 (KEYS 대체)
// ==============================================

/**
 * SCAN으로 키 패턴 조회 (Upstash O(N) KEYS 블로킹 방지)
 */
async function scanKeys(client: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await client.scan(cursor, {
      match: pattern,
      count: 100,
    });
    cursor = Number(nextCursor);
    keys.push(...batch);
  } while (cursor !== 0);
  return keys;
}

/**
 * 세션 무효화용 SCAN 패턴 생성
 * - endpoint 포함 키: v2:ai:response:{endpoint}:{sessionHash}:{queryHash}
 * - endpoint 없는 키: v2:ai:response:{sessionHash}:{queryHash}
 */
export function getSessionScanPatterns(sessionId: string): [string, string] {
  const sessionHash = hashString(sessionId);
  const prefix = CACHE_CONFIG.PREFIX.AI_RESPONSE;
  return [`${prefix}:*:${sessionHash}:*`, `${prefix}:${sessionHash}:*`];
}

// ==============================================
// 🎯 AI 응답 캐시
// ==============================================

/**
 * AI 응답 캐시에서 조회
 *
 * @param sessionId 세션 ID
 * @param query 사용자 쿼리
 * @returns 캐시 결과 (hit/miss)
 */
export async function getAIResponseCache(
  sessionId: string,
  query: string,
  endpoint?: string
): Promise<CacheResult<CachedAIResponse>> {
  // Redis 비활성화 시 miss 반환
  if (isRedisDisabled() || !isRedisEnabled()) {
    return { hit: false, data: null };
  }

  const client = getRedisClient();
  if (!client) {
    return { hit: false, data: null };
  }

  const startTime = performance.now();
  const queryHash = generateQueryHash(sessionId, query, endpoint);
  const cacheKey = `${CACHE_CONFIG.PREFIX.AI_RESPONSE}:${queryHash}`;

  try {
    const cached = await client.get<CachedAIResponse>(cacheKey);
    const latencyMs = Math.round(performance.now() - startTime);

    if (cached) {
      // 🎯 Free Tier 최적화: TTL 조회 제거 (Redis 커맨드 ~30% 절약)
      // Note: Production(LOG_LEVEL=warn)에서는 이 로그가 보이지 않음
      logger.info(
        `[AI Cache] HIT - Key: ${queryHash}, Latency: ${latencyMs}ms`
      );

      return {
        hit: true,
        data: cached,
        latencyMs,
        // ttlRemaining 생략 - Upstash 10K commands/day 절약
      };
    }

    logger.info(`[AI Cache] MISS - Key: ${queryHash}, Latency: ${latencyMs}ms`);
    return { hit: false, data: null, latencyMs };
  } catch (error) {
    logger.error('[AI Cache] Get error:', error);
    return { hit: false, data: null };
  }
}

/**
 * AI 응답을 캐시에 저장
 *
 * @param sessionId 세션 ID
 * @param query 사용자 쿼리
 * @param response AI 응답
 * @param ttlSeconds 캐시 TTL (기본 1시간)
 */
export async function setAIResponseCache(
  sessionId: string,
  query: string,
  response: CachedAIResponse,
  ttlSeconds: number = CACHE_CONFIG.AI_RESPONSE_TTL_SECONDS,
  endpoint?: string
): Promise<boolean> {
  // Redis 비활성화 시 무시
  if (isRedisDisabled() || !isRedisEnabled()) {
    return false;
  }

  const client = getRedisClient();
  if (!client) {
    return false;
  }

  const queryHash = generateQueryHash(sessionId, query, endpoint);
  const cacheKey = `${CACHE_CONFIG.PREFIX.AI_RESPONSE}:${queryHash}`;

  try {
    await client.set(cacheKey, response, { ex: ttlSeconds });

    logger.info(`[AI Cache] SET - Key: ${queryHash}, TTL: ${ttlSeconds}s`);

    return true;
  } catch (error) {
    logger.error('[AI Cache] Set error:', error);
    return false;
  }
}

/**
 * 특정 세션의 AI 캐시 삭제
 * (세션 종료 또는 컨텍스트 변경 시)
 */
export async function invalidateSessionCache(
  sessionId: string
): Promise<number> {
  if (isRedisDisabled() || !isRedisEnabled()) {
    return 0;
  }

  const client = getRedisClient();
  if (!client) {
    return 0;
  }

  try {
    // 세션 관련 키 패턴 조회 (SCAN으로 O(N) 블로킹 방지)
    const [withEndpointPattern, withoutEndpointPattern] =
      getSessionScanPatterns(sessionId);
    const [withEndpoint, withoutEndpoint] = await Promise.all([
      scanKeys(client, withEndpointPattern),
      scanKeys(client, withoutEndpointPattern),
    ]);
    const keys = [...new Set([...withEndpoint, ...withoutEndpoint])];

    if (keys.length === 0) {
      return 0;
    }

    // 일괄 삭제
    await client.del(...keys);

    logger.info(
      `[AI Cache] Invalidated ${keys.length} keys for session: ${sessionId}`
    );
    return keys.length;
  } catch (error) {
    logger.error('[AI Cache] Invalidate error:', error);
    return 0;
  }
}

// ==============================================
// 🎯 캐시 통계
// ==============================================

export interface CacheStats {
  enabled: boolean;
  aiResponseKeys: number;
}

/**
 * 캐시 통계 조회
 */
export async function getCacheStats(): Promise<CacheStats> {
  if (isRedisDisabled() || !isRedisEnabled()) {
    return { enabled: false, aiResponseKeys: 0 };
  }

  const client = getRedisClient();
  if (!client) {
    return { enabled: false, aiResponseKeys: 0 };
  }

  try {
    const aiKeys = await scanKeys(
      client,
      `${CACHE_CONFIG.PREFIX.AI_RESPONSE}:*`
    );

    return {
      enabled: true,
      aiResponseKeys: aiKeys.length,
    };
  } catch (error) {
    logger.error('[Cache Stats] Error:', error);
    return { enabled: false, aiResponseKeys: 0 };
  }
}
