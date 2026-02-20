/**
 * AI Response Cache Integration
 *
 * @description
 * Memory → Redis 다층 캐시를 통해 AI 응답을 캐싱
 * Cloud Run 호출 최소화 및 응답 속도 개선
 *
 * @flow
 * 1. Memory Cache 조회 (Fastest, ~1ms)
 * 2. Redis Cache 조회 (Fast, ~10ms)
 * 3. Cache Miss → Cloud Run 호출
 * 4. 응답 저장 (Memory + Redis 동시 저장)
 *
 * @created 2025-12-30
 */

import { hashString } from '@/lib/cache/cache-helpers';
import {
  CacheNamespace,
  CacheTTL,
  normalizeQueryForCache,
  unifiedCache,
} from '@/lib/cache/unified-cache';
import { logger } from '@/lib/logging';
import {
  type CacheResult,
  getAIResponseCache,
  invalidateSessionCache,
  type CachedAIResponse as RedisAIResponse,
  setAIResponseCache,
} from '@/lib/redis/ai-cache';

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 캐시 가능한 AI 응답 타입
 */
export interface CacheableAIResponse {
  success: boolean;
  response?: string;
  data?: unknown;
  source?: string;
  [key: string]: unknown;
}

/**
 * 캐시 조회 결과
 */
export interface AIResponseCacheResult {
  hit: boolean;
  data: CacheableAIResponse | null;
  source: 'memory' | 'redis' | 'none';
  latencyMs?: number;
}

/**
 * 엔드포인트별 TTL 설정 (초)
 */
export const AI_CACHE_TTL = {
  /** 일반 supervisor 응답: 5분 (대화 맥락 민감) */
  supervisor: 300,
  /** 상태 조회 응답: 1분 (서버 상태는 빈번히 변경) */
  'supervisor-status': 60,
  /** 지능형 모니터링: 30분 (예측 안정적) */
  'intelligent-monitoring': 1800,
  /** 인시던트 보고서: 1시간 (보고서 고정) */
  'incident-report': 3600,
} as const;

export type AIEndpoint = keyof typeof AI_CACHE_TTL;

// ============================================================================
// 캐시 키 생성
// ============================================================================

/**
 * AI 응답 캐시 키 생성
 *
 * @description
 * unified-cache.ts의 normalizeQueryForCache 함수를 사용하여
 * 쿼리 정규화 로직을 통일합니다. (v7.1.3)
 *
 * @param sessionId - 세션 ID
 * @param query - 사용자 쿼리
 * @param endpoint - AI 엔드포인트 (선택)
 * @returns 캐시 키
 */
export function generateCacheKey(
  sessionId: string,
  query: string,
  endpoint?: AIEndpoint
): string {
  // unified-cache.ts의 정규화 함수 사용 (구두점 제거, 다중 공백 정규화 등)
  const normalizedQuery = normalizeQueryForCache(query);
  const endpointPrefix = endpoint ? `${endpoint}:` : '';
  return `${endpointPrefix}${hashString(sessionId)}:${hashString(normalizedQuery)}`;
}

// ============================================================================
// 캐시 조회
// ============================================================================

/**
 * AI 응답 캐시 조회 (Memory → Redis)
 *
 * @param sessionId - 세션 ID
 * @param query - 사용자 쿼리
 * @param endpoint - AI 엔드포인트 (TTL 결정용)
 * @returns 캐시 결과
 */
export async function getAICache(
  sessionId: string,
  query: string,
  endpoint?: AIEndpoint
): Promise<AIResponseCacheResult> {
  const cacheKey = generateCacheKey(sessionId, query, endpoint);
  const startTime = performance.now();

  // 1. Memory Cache 조회 (Fastest)
  try {
    const memoryResult = await unifiedCache.get<CacheableAIResponse>(
      cacheKey,
      CacheNamespace.AI_RESPONSE
    );

    if (memoryResult) {
      const latencyMs = Math.round(performance.now() - startTime);
      logger.info(
        `[AI Cache] Memory HIT - Key: ${cacheKey.slice(0, 20)}..., Latency: ${latencyMs}ms`
      );
      return {
        hit: true,
        data: memoryResult,
        source: 'memory',
        latencyMs,
      };
    }
  } catch (error) {
    logger.warn('[AI Cache] Memory cache error:', error);
  }

  // 2. Redis Cache 조회 (Fallback)
  try {
    const redisResult: CacheResult<RedisAIResponse> = await getAIResponseCache(
      sessionId,
      query,
      endpoint
    );

    if (redisResult.hit && redisResult.data) {
      const latencyMs = Math.round(performance.now() - startTime);

      // Redis 히트 → Memory에 복사 (다음 조회 가속)
      const cacheableData: CacheableAIResponse = {
        success: true,
        response: redisResult.data.content,
        data: redisResult.data.metadata,
        source: 'redis-cache',
      };

      // Memory에 저장 (짧은 TTL)
      await unifiedCache.set(cacheKey, cacheableData, {
        ttlSeconds: CacheTTL.SHORT, // 30초
        namespace: CacheNamespace.AI_RESPONSE,
      });

      logger.info(
        `[AI Cache] Redis HIT - Key: ${cacheKey.slice(0, 20)}..., Latency: ${latencyMs}ms`
      );
      return {
        hit: true,
        data: cacheableData,
        source: 'redis',
        latencyMs,
      };
    }
  } catch (error) {
    logger.warn('[AI Cache] Redis cache error:', error);
  }

  // 3. Cache Miss
  const latencyMs = Math.round(performance.now() - startTime);
  logger.info(
    `[AI Cache] MISS - Key: ${cacheKey.slice(0, 20)}..., Latency: ${latencyMs}ms`
  );
  return {
    hit: false,
    data: null,
    source: 'none',
    latencyMs,
  };
}

// ============================================================================
// 캐시 저장
// ============================================================================

/**
 * AI 응답 캐시 저장 (Memory + Redis 동시)
 *
 * @param sessionId - 세션 ID
 * @param query - 사용자 쿼리
 * @param response - AI 응답
 * @param endpoint - AI 엔드포인트 (TTL 결정용)
 */
export async function setAICache(
  sessionId: string,
  query: string,
  response: CacheableAIResponse,
  endpoint: AIEndpoint = 'supervisor'
): Promise<void> {
  const cacheKey = generateCacheKey(sessionId, query, endpoint);
  const ttlSeconds = AI_CACHE_TTL[endpoint];

  // 1. Memory Cache 저장 (빠른 조회용, 짧은 TTL)
  try {
    await unifiedCache.set(cacheKey, response, {
      ttlSeconds: Math.min(ttlSeconds, CacheTTL.MEDIUM), // 최대 5분
      namespace: CacheNamespace.AI_RESPONSE,
    });
  } catch (error) {
    logger.warn('[AI Cache] Memory set error:', error);
  }

  // 2. Redis Cache 저장 (지속성, 전체 TTL)
  try {
    const redisResponse: RedisAIResponse = {
      content: response.response ?? JSON.stringify(response.data),
      metadata: {
        success: response.success,
        source: response.source,
        ...(typeof response.data === 'object' ? response.data : {}),
      } as Record<string, unknown>,
    };

    await setAIResponseCache(
      sessionId,
      query,
      redisResponse,
      ttlSeconds as number,
      endpoint
    );
  } catch (error) {
    logger.warn('[AI Cache] Redis set error:', error);
  }

  logger.info(
    `[AI Cache] SET - Key: ${cacheKey.slice(0, 20)}..., TTL: ${ttlSeconds}s`
  );
}

// ============================================================================
// 캐시 무효화
// ============================================================================

/**
 * 세션의 AI 캐시 무효화
 *
 * @param sessionId - 세션 ID
 */
export async function invalidateAICache(sessionId: string): Promise<void> {
  const sessionHash = hashString(sessionId);

  // Memory Cache 무효화
  try {
    await unifiedCache.invalidate(
      `*${sessionHash}*`,
      CacheNamespace.AI_RESPONSE
    );
  } catch (error) {
    logger.warn('[AI Cache] Memory invalidate error:', error);
  }

  // Redis Cache 무효화
  try {
    await invalidateSessionCache(sessionId);
  } catch (error) {
    logger.warn('[AI Cache] Redis invalidate error:', error);
  }

  logger.info(`[AI Cache] Invalidated session: ${sessionId}`);
}

// ============================================================================
// 유틸리티
// ============================================================================

/**
 * 캐시를 통한 AI 요청 실행
 *
 * @param sessionId - 세션 ID
 * @param query - 사용자 쿼리
 * @param fetcher - Cloud Run 호출 함수
 * @param endpoint - AI 엔드포인트
 * @returns AI 응답
 */
export async function withAICache<T extends CacheableAIResponse>(
  sessionId: string,
  query: string,
  fetcher: () => Promise<T>,
  endpoint: AIEndpoint = 'supervisor'
): Promise<{ data: T; cached: boolean }> {
  // 1. 캐시 조회
  const cacheResult = await getAICache(sessionId, query, endpoint);

  if (cacheResult.hit && cacheResult.data) {
    return {
      data: { ...cacheResult.data, _cached: true } as unknown as T,
      cached: true,
    };
  }

  // 2. Fetcher 실행
  const response = await fetcher();

  // 3. 캐시 저장 (성공 응답만)
  if (response.success) {
    await setAICache(sessionId, query, response, endpoint);
  }

  return {
    data: response,
    cached: false,
  };
}
