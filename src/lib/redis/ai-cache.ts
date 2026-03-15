/**
 * AI Response Cache
 *
 * Cloud Run 호출 최소화 & Google AI RPD 절감
 * - 쿼리 해시 기반 exact 캐싱
 * - exact miss 시 semantic fallback 매칭 (token-hash embedding)
 * - TTL: 1시간 (신선도 유지)
 * - 캐시 히트 시 Cloud Run 호출 생략
 *
 * @module redis/ai-cache
 */

import type { Redis } from '@upstash/redis';
import { hashString, normalizeQueryForCache } from '@/lib/cache/cache-helpers';
import { logger } from '@/lib/logging';
import {
  getRedisClient,
  isRedisDisabled,
  isRedisEnabled,
  runRedisWithTimeout,
} from './client';

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
  semanticScore?: number;
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
  SEMANTIC_CACHE: {
    EMBEDDING_DIMENSION: 64,
    MAX_SCAN_CANDIDATES: 12,
    MIN_COMPOSITE_SCORE: 0.82,
    TOKEN_OVERLAP_WEIGHT: 0.2,
    COSINE_WEIGHT: 0.8,
  },
} as const;

const REDIS_TIMEOUTS = {
  GET: 800,
  SET: 1_200,
  SCAN: 1_500,
  DELETE: 1_500,
  BATCH_READ: 1_500,
} as const;

type SemanticAlgorithm = 'token-hash-v1';

interface SemanticCacheMetadata {
  algorithm: SemanticAlgorithm;
  normalizedQuery: string;
  embedding: number[];
  createdAt: number;
}

export interface SemanticQueryEmbedding {
  algorithm: SemanticAlgorithm;
  normalizedQuery: string;
  vector: number[];
}

function hashToInt(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(
    vector.reduce((sum, value) => sum + value * value, 0)
  );
  if (magnitude === 0) {
    return vector;
  }
  return vector.map((value) => value / magnitude);
}

function addHashedFeature(
  vector: number[],
  feature: string,
  weight: number
): void {
  const dimension = vector.length;
  const index = hashToInt(feature) % dimension;
  const current = vector[index] ?? 0;
  vector[index] = current + weight;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
  }
  return Math.max(0, Math.min(1, dot));
}

export function tokenOverlapRatio(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(Boolean));
  const tokensB = new Set(b.split(' ').filter(Boolean));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }

  return intersection / Math.max(tokensA.size, tokensB.size);
}

export function buildSemanticQueryEmbedding(
  query: string
): SemanticQueryEmbedding {
  const normalizedQuery = normalizeQueryForCache(query);
  const vector = new Array<number>(
    CACHE_CONFIG.SEMANTIC_CACHE.EMBEDDING_DIMENSION
  ).fill(0);

  if (!normalizedQuery) {
    return {
      algorithm: 'token-hash-v1',
      normalizedQuery,
      vector,
    };
  }

  const tokens = normalizedQuery.split(' ').filter(Boolean);

  for (const token of tokens) {
    addHashedFeature(vector, `tok:${token}`, 1);
    addHashedFeature(vector, `len:${token.length}`, 0.2);
  }

  for (let i = 0; i < tokens.length - 1; i++) {
    const left = tokens[i]!;
    const right = tokens[i + 1]!;
    addHashedFeature(vector, `bi:${left}_${right}`, 0.6);
  }

  for (let i = 0; i < normalizedQuery.length - 2; i++) {
    const triGram = normalizedQuery.slice(i, i + 3);
    addHashedFeature(vector, `tri:${triGram}`, 0.1);
  }

  return {
    algorithm: 'token-hash-v1',
    normalizedQuery,
    vector: normalizeVector(vector),
  };
}

function extractSemanticMetadata(
  response: CachedAIResponse | null
): SemanticCacheMetadata | null {
  const metadata =
    response?.metadata && typeof response.metadata === 'object'
      ? response.metadata
      : null;

  if (!metadata) {
    return null;
  }

  const semantic = metadata.__semanticCache;
  if (!semantic || typeof semantic !== 'object') {
    return null;
  }

  const algorithm = (semantic as { algorithm?: string }).algorithm;
  const normalizedQuery = (semantic as { normalizedQuery?: string })
    .normalizedQuery;
  const embedding = (semantic as { embedding?: unknown }).embedding;
  const createdAt = (semantic as { createdAt?: number }).createdAt;

  if (
    algorithm !== 'token-hash-v1' ||
    typeof normalizedQuery !== 'string' ||
    !Array.isArray(embedding) ||
    embedding.some((value) => typeof value !== 'number') ||
    typeof createdAt !== 'number'
  ) {
    return null;
  }

  return {
    algorithm,
    normalizedQuery,
    embedding: embedding as number[],
    createdAt,
  };
}

function getSemanticScanPattern(sessionId: string, endpoint?: string): string {
  const sessionHash = hashString(sessionId);
  const prefix = CACHE_CONFIG.PREFIX.AI_RESPONSE;

  if (endpoint) {
    return `${prefix}:${endpoint}:${sessionHash}:*`;
  }

  return `${prefix}:${sessionHash}:*`;
}

async function findSemanticMatch(
  client: Redis,
  sessionId: string,
  query: string,
  endpoint: string | undefined,
  exactCacheKey: string
): Promise<{ response: CachedAIResponse; score: number } | null> {
  const target = buildSemanticQueryEmbedding(query);
  if (!target.normalizedQuery) {
    return null;
  }

  const pattern = getSemanticScanPattern(sessionId, endpoint);
  const keys = await scanKeys(
    client,
    pattern,
    CACHE_CONFIG.SEMANTIC_CACHE.MAX_SCAN_CANDIDATES + 1
  );
  const candidates = keys
    .filter((key) => key !== exactCacheKey)
    .slice(0, CACHE_CONFIG.SEMANTIC_CACHE.MAX_SCAN_CANDIDATES);

  if (candidates.length === 0) {
    return null;
  }

  const responses = await Promise.all(
    candidates.map((key) =>
      runRedisWithTimeout(
        `AI cache GET ${key}`,
        () => client.get<CachedAIResponse>(key),
        { timeoutMs: REDIS_TIMEOUTS.BATCH_READ }
      )
    )
  );

  let bestScore = 0;
  let bestResponse: CachedAIResponse | null = null;

  for (const response of responses) {
    if (!response) {
      continue;
    }

    const semantic = extractSemanticMetadata(response);
    if (!semantic) {
      continue;
    }

    const overlap = tokenOverlapRatio(
      target.normalizedQuery,
      semantic.normalizedQuery
    );
    if (overlap === 0) {
      continue;
    }

    const cosine = cosineSimilarity(target.vector, semantic.embedding);
    const compositeScore =
      cosine * CACHE_CONFIG.SEMANTIC_CACHE.COSINE_WEIGHT +
      overlap * CACHE_CONFIG.SEMANTIC_CACHE.TOKEN_OVERLAP_WEIGHT;

    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      bestResponse = response;
    }
  }

  if (
    !bestResponse ||
    bestScore < CACHE_CONFIG.SEMANTIC_CACHE.MIN_COMPOSITE_SCORE
  ) {
    return null;
  }

  return {
    response: bestResponse,
    score: bestScore,
  };
}

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
async function scanKeys(
  client: Redis,
  pattern: string,
  limit?: number
): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const remaining =
      typeof limit === 'number' ? Math.max(limit - keys.length, 0) : undefined;
    const [nextCursor, batch] = await runRedisWithTimeout(
      `AI cache SCAN ${pattern}`,
      () =>
        client.scan(cursor, {
          match: pattern,
          count: remaining ? Math.min(100, remaining) : 100,
        }),
      { timeoutMs: REDIS_TIMEOUTS.SCAN }
    );
    cursor = Number(nextCursor);
    keys.push(...batch);
    if (typeof limit === 'number' && keys.length >= limit) {
      return keys.slice(0, limit);
    }
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
    const cached = await runRedisWithTimeout(
      `AI cache GET ${cacheKey}`,
      () => client.get<CachedAIResponse>(cacheKey),
      { timeoutMs: REDIS_TIMEOUTS.GET }
    );

    if (cached) {
      const latencyMs = Math.round(performance.now() - startTime);
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

    const semanticMatch = await findSemanticMatch(
      client,
      sessionId,
      query,
      endpoint,
      cacheKey
    );

    if (semanticMatch) {
      const latencyMs = Math.round(performance.now() - startTime);
      logger.info(
        `[AI Cache] SEMANTIC HIT - Score: ${semanticMatch.score.toFixed(3)}, Latency: ${latencyMs}ms`
      );

      return {
        hit: true,
        data: semanticMatch.response,
        latencyMs,
        semanticScore: Number(semanticMatch.score.toFixed(3)),
      };
    }

    const latencyMs = Math.round(performance.now() - startTime);
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
    const semantic = buildSemanticQueryEmbedding(query);
    const responseWithSemanticMetadata: CachedAIResponse = {
      ...response,
      metadata: {
        ...(response.metadata ?? {}),
        __semanticCache: {
          algorithm: semantic.algorithm,
          normalizedQuery: semantic.normalizedQuery,
          embedding: semantic.vector,
          createdAt: Date.now(),
        } satisfies SemanticCacheMetadata,
      },
    };

    await runRedisWithTimeout(
      `AI cache SET ${cacheKey}`,
      () =>
        client.set(cacheKey, responseWithSemanticMetadata, {
          ex: ttlSeconds,
        }),
      { timeoutMs: REDIS_TIMEOUTS.SET }
    );

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
    await runRedisWithTimeout(
      `AI cache DEL ${keys.length} keys`,
      () => client.del(...keys),
      { timeoutMs: REDIS_TIMEOUTS.DELETE }
    );

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
