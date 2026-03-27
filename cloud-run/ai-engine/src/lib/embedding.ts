/**
 * Mistral Embedding Utility (Consolidated)
 * AI SDK @ai-sdk/mistral 사용 — 유일한 임베딩 모듈
 *
 * Model: mistral-embed (1024 dimensions)
 * - Context window: 8,000 tokens
 * - MTEB retrieval score: 55.26
 * - Price: $0.10 / 1M tokens (affordable)
 *
 * ## Consolidation (2026-02-18)
 * - Merged services/embedding/embedding-service.ts into this file
 * - Added: local fallback, 3h cache TTL, 5000 cache entries, stats tracking
 * - HTTP route (routes/embedding.ts) now imports from this module
 *
 * ## Migration from Gemini (2025-12-31)
 * - Changed from Google text-embedding-004 (384d) to Mistral mistral-embed (1024d)
 */

import { createHash } from 'crypto';
import { embed, embedMany } from 'ai';
import { logger } from './logger';
import { getMistralProvider } from './mistral-provider';

// ============================================================================
// Constants
// ============================================================================

const EMBEDDING_DIMENSION = 1024;
const EMBEDDING_CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3 hours (reduces API calls)
const EMBEDDING_CACHE_MAX_SIZE = 5000;

// ============================================================================
// Cache
// ============================================================================

interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
  source: 'mistral' | 'local-fallback';
}

const embeddingCache = new Map<string, EmbeddingCacheEntry>();

function getCacheKey(text: string): string {
  return createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
}

function getCachedEmbedding(text: string): EmbeddingCacheEntry | null {
  const key = getCacheKey(text);
  const cached = embeddingCache.get(key);

  if (cached && Date.now() - cached.timestamp < EMBEDDING_CACHE_TTL_MS) {
    embeddingStats.cacheHits++;
    // LRU: re-insert to move to end (most recently used)
    embeddingCache.delete(key);
    embeddingCache.set(key, cached);
    return cached;
  }

  if (cached) embeddingCache.delete(key);
  return null;
}

function setCachedEmbedding(
  text: string,
  embedding: number[],
  source: 'mistral' | 'local-fallback'
): void {
  if (embeddingCache.size >= EMBEDDING_CACHE_MAX_SIZE) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey) embeddingCache.delete(oldestKey);
  }
  embeddingCache.set(getCacheKey(text), {
    embedding,
    timestamp: Date.now(),
    source,
  });
}

export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

// ============================================================================
// Stats
// ============================================================================

const embeddingStats = {
  requests: 0,
  cacheHits: 0,
  mistralCalls: 0,
  localFallbacks: 0,
  errors: 0,
};

const EMBEDDING_CACHE_WARN_THRESHOLD = 3000;
const ESTIMATED_BYTES_PER_ENTRY = 8 * 1024; // ~8KB per 1024-dim float64 + overhead

export function getEmbeddingStats() {
  const cacheSize = embeddingCache.size;
  const estimatedMemoryMB = Math.round((cacheSize * ESTIMATED_BYTES_PER_ENTRY) / (1024 * 1024) * 10) / 10;

  if (cacheSize > EMBEDDING_CACHE_WARN_THRESHOLD) {
    logger.warn(`[Embedding] Cache size ${cacheSize} exceeds ${EMBEDDING_CACHE_WARN_THRESHOLD} (~${estimatedMemoryMB}MB)`);
  }

  return {
    ...embeddingStats,
    cacheSize,
    estimatedMemoryMB,
    cacheHitRate:
      embeddingStats.requests > 0
        ? Math.round((embeddingStats.cacheHits / embeddingStats.requests) * 100)
        : 0,
    provider: 'mistral',
    dimension: EMBEDDING_DIMENSION,
  };
}

// ============================================================================
// Local Fallback (API key 미설정 또는 API 장애 시)
// ============================================================================

function generateLocalEmbedding(text: string): number[] {
  const hash = createHash('sha256').update(text).digest('hex');
  const embedding = new Array(EMBEDDING_DIMENSION);

  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const charCode = hash.charCodeAt(i % hash.length);
    const textChar = text.charCodeAt(i % text.length) || 0;
    embedding[i] =
      (Math.sin(charCode * (i + 1)) + Math.cos(textChar * (i + 1))) /
      Math.sqrt(EMBEDDING_DIMENSION);
  }

  const magnitude = Math.sqrt(
    embedding.reduce((sum: number, val: number) => sum + val * val, 0)
  );
  return magnitude > 0
    ? embedding.map((val: number) => val / magnitude)
    : embedding;
}

// Supabase 클라이언트 인터페이스 (동적 import 호환)
interface SupabaseClientLike {
  rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

// ============================================================================
// Core API
// ============================================================================

interface EmbedResult {
  embedding: number[];
  source: 'mistral' | 'local-fallback';
}

/**
 * 텍스트를 1024차원 벡터로 임베딩 (source 포함)
 * Mistral API 실패 시 local fallback 사용
 */
async function embedTextWithSource(text: string): Promise<EmbedResult> {
  embeddingStats.requests++;

  const cached = getCachedEmbedding(text);
  if (cached) return { embedding: cached.embedding, source: cached.source };

  const mistral = getMistralProvider();
  if (!mistral) {
    logger.warn('[Embedding] No Mistral API key, using local fallback');
    embeddingStats.localFallbacks++;
    const fallback = generateLocalEmbedding(text);
    setCachedEmbedding(text, fallback, 'local-fallback');
    return { embedding: fallback, source: 'local-fallback' };
  }

  try {
    const model = mistral.embedding('mistral-embed');
    const { embedding } = await embed({
      model,
      value: text,
      experimental_telemetry: { isEnabled: false },
    });

    embeddingStats.mistralCalls++;
    setCachedEmbedding(text, embedding, 'mistral');
    return { embedding, source: 'mistral' };
  } catch (e) {
    logger.error('[Embedding] Mistral API failed, using fallback:', e);
    embeddingStats.errors++;
    embeddingStats.localFallbacks++;
    const fallback = generateLocalEmbedding(text);
    setCachedEmbedding(text, fallback, 'local-fallback');
    return { embedding: fallback, source: 'local-fallback' };
  }
}

/**
 * 텍스트를 1024차원 벡터로 임베딩
 * Mistral API 실패 시 local fallback 사용
 */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embedTextWithSource(text);
  return embedding;
}

/**
 * 여러 텍스트를 배치로 임베딩
 * 캐시 히트/미스를 분리하여 미스분만 API 호출 후 결과 병합
 * Mistral API 실패 시 local fallback 사용
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  embeddingStats.requests++;

  // Split into cache hits and misses
  const results: (number[] | null)[] = texts.map(t => {
    const cached = getCachedEmbedding(t);
    return cached ? cached.embedding : null;
  });

  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i] === null) {
      uncachedIndices.push(i);
      uncachedTexts.push(texts[i]);
    }
  }

  // All cached — no API call needed
  if (uncachedTexts.length === 0) {
    return results as number[][];
  }

  const mistral = getMistralProvider();
  if (!mistral) {
    logger.warn('[Embedding] No Mistral API key, batch using local fallback');
    embeddingStats.localFallbacks++;
    for (const idx of uncachedIndices) {
      const fallback = generateLocalEmbedding(texts[idx]);
      setCachedEmbedding(texts[idx], fallback, 'local-fallback');
      results[idx] = fallback;
    }
    return results as number[][];
  }

  try {
    const model = mistral.embedding('mistral-embed');
    const { embeddings } = await embedMany({
      model,
      values: uncachedTexts,
      experimental_telemetry: { isEnabled: false },
    });

    embeddingStats.mistralCalls++;
    for (let i = 0; i < uncachedIndices.length; i++) {
      const idx = uncachedIndices[i];
      results[idx] = embeddings[i];
      setCachedEmbedding(texts[idx], embeddings[i], 'mistral');
    }
    return results as number[][];
  } catch (e) {
    logger.error('[Embedding] Batch Mistral API failed, using fallback:', e);
    embeddingStats.errors++;
    embeddingStats.localFallbacks++;
    for (const idx of uncachedIndices) {
      const fallback = generateLocalEmbedding(texts[idx]);
      setCachedEmbedding(texts[idx], fallback, 'local-fallback');
      results[idx] = fallback;
    }
    return results as number[][];
  }
}

// ============================================================================
// HTTP Route 호환 API (routes/embedding.ts에서 사용)
// ============================================================================

export interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  embeddings?: number[][];
  error?: string;
  source?: 'mistral' | 'local-fallback';
  cached?: boolean;
}

export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  if (!text || text.trim().length === 0) {
    return { success: false, error: 'Empty text provided' };
  }

  const truncated = text.substring(0, 2000);
  const cachedResult = getCachedEmbedding(truncated);
  if (cachedResult) {
    return {
      success: true,
      embedding: cachedResult.embedding,
      source: cachedResult.source,
      cached: true,
    };
  }

  const { embedding, source } = await embedTextWithSource(truncated);
  return { success: true, embedding, source };
}

export async function createBatchEmbeddings(texts: string[]): Promise<EmbeddingResult> {
  if (!texts || texts.length === 0) {
    return { success: false, error: 'Empty texts array' };
  }

  const valid = texts.filter((t) => t && t.trim().length > 0).map((t) => t.substring(0, 2000));
  if (valid.length === 0) {
    return { success: false, error: 'No valid texts provided' };
  }

  const embeddings = await embedTexts(valid);
  const source = getMistralProvider() ? 'mistral' as const : 'local-fallback' as const;
  return { success: true, embeddings, source };
}

/**
 * 임베딩을 PostgreSQL vector 형식 문자열로 변환
 * Supabase RPC 호출 시 사용
 */
export function toVectorString(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * RAG 검색 결과 타입
 */
export interface RAGSearchResult {
  success: boolean;
  results: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    similarity: number;
  }>;
  error?: string;
}

/**
 * 쿼리 임베딩 + Supabase 검색을 한 번에 수행
 * Reporter Agent에서 직접 사용
 *
 * @param supabaseClient - Supabase 클라이언트
 * @param query - 검색할 쿼리 문자열 (최대 500자)
 * @param options - 검색 옵션 (threshold, limit, filters)
 */
export async function searchWithEmbedding(
  supabaseClient: SupabaseClientLike,
  query: string,
  options: {
    similarityThreshold?: number;
    maxResults?: number;
    category?: string;
    severity?: string;
  } = {}
): Promise<RAGSearchResult> {
  try {
    // 입력 검증: 쿼리 길이 제한 (500자)
    if (!query || query.length === 0) {
      return { success: false, results: [], error: 'Query is empty' };
    }
    if (query.length > 500) {
      return { success: false, results: [], error: 'Query too long (max 500 chars)' };
    }

    // 1. 쿼리 임베딩 생성 (Mistral mistral-embed)
    const queryEmbedding = await embedText(query);
    const vectorString = toVectorString(queryEmbedding);

    // 2. Supabase RPC로 유사도 검색
    const { data, error } = await supabaseClient.rpc('search_knowledge_base', {
      query_embedding: vectorString,
      similarity_threshold: options.similarityThreshold ?? 0.4,
      max_results: options.maxResults ?? 5,
      filter_category: options.category ?? null,
      filter_severity: options.severity ?? null,
    });

    if (error) {
      throw error;
    }

    // 3. 결과 매핑
    const results = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ''),
          title: String(row.title ?? ''),
          content: String(row.content ?? ''),
          category: String(row.category ?? 'general'),
          similarity: Number(row.similarity ?? 0),
        }))
      : [];

    return {
      success: true,
      results,
    };
  } catch (e) {
    logger.error('[Embedding] Search failed:', e);
    return {
      success: false,
      results: [],
      error: String(e),
    };
  }
}
