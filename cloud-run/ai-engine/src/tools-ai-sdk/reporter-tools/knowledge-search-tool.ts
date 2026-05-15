import { tool } from 'ai';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  retrieveKnowledgeEvidence,
  type KnowledgeRetrievalLiteResult,
} from '../../lib/knowledge-retrieval-lite';
import { logger } from '../../lib/logger';
import {
  createRetrievalMetadata,
  type EvidenceSourceType,
  EvidenceCard,
  RetrievalMetadata,
} from '../../lib/retrieval-contract';
import { getSupabaseClient } from './knowledge-client';
import { rebalanceRagResultsForMonitoring } from './knowledge-helpers';
import type { RAGResultItem, ToolSeverityFilter } from './knowledge-types';

const KNOWLEDGE_SEARCH_CACHE_TTL_MS = 30_000;
const DEFAULT_PRODUCTION_RETRIEVAL_TELEMETRY_SAMPLE_RATE = 0.1;
const DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT = 5;

type KnowledgeSearchRuntimeInput = {
  query: string;
  category?:
    | 'troubleshooting'
    | 'security'
    | 'performance'
    | 'incident'
    | 'best_practice'
    | 'command'
    | 'architecture';
  severity?: ToolSeverityFilter;
  fastMode?: boolean;
  includeWebSearch?: boolean;
};

type KnowledgeSearchToolInput = KnowledgeSearchRuntimeInput;

type KnowledgeSearchResult = {
  success: boolean;
  results: RAGResultItem[];
  totalFound: number;
  _source: string;
  systemMessage?: string;
  suggestedAgentAction?: string;
  evidenceCards?: EvidenceCard[];
  retrieval?: RetrievalMetadata;
  fastMode?: boolean;
  webSearchTriggered?: boolean;
};

const knowledgeSearchCache = new Map<
  string,
  { expiresAt: number; promise: Promise<KnowledgeSearchResult> }
>();

function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildQueryFingerprint(query: string): string {
  return createHash('sha256')
    .update(normalizeSearchQuery(query))
    .digest('hex')
    .slice(0, 12);
}

function getKnowledgeRetrievalTelemetrySampleRate(): number {
  const raw = process.env.KNOWLEDGE_RETRIEVAL_TELEMETRY_SAMPLE_RATE;
  if (!raw) {
    return process.env.NODE_ENV === 'production'
      ? DEFAULT_PRODUCTION_RETRIEVAL_TELEMETRY_SAMPLE_RATE
      : 1;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return process.env.NODE_ENV === 'production'
      ? DEFAULT_PRODUCTION_RETRIEVAL_TELEMETRY_SAMPLE_RATE
      : 1;
  }

  return Math.min(1, Math.max(0, parsed));
}

function shouldEmitKnowledgeRetrievalTelemetry(): boolean {
  return Math.random() < getKnowledgeRetrievalTelemetrySampleRate();
}

function emitKnowledgeRetrievalTelemetry(
  input: Pick<
    KnowledgeSearchRuntimeInput,
    'query' | 'category' | 'fastMode' | 'includeWebSearch'
  >,
  result: KnowledgeSearchResult,
  options: { cacheHit: boolean }
): void {
  if (!shouldEmitKnowledgeRetrievalTelemetry()) {
    return;
  }

  const payload = {
    event: 'knowledge_retrieval_lite_search',
    component: 'reporter_tools',
    queryFingerprint: buildQueryFingerprint(input.query),
    queryCategory: input.category ?? 'all',
    fastMode: input.fastMode ?? true,
    includeWebSearch: input.includeWebSearch ?? false,
    cacheHit: options.cacheHit,
    success: result.success,
    source: result._source,
    totalFound: result.totalFound,
    retrievalMode: result.retrieval?.retrievalMode ?? 'lite',
    evidenceCount: result.retrieval?.evidenceCount ?? result.results.length,
    webUsed: result.retrieval?.webUsed ?? false,
    webSearchTriggered: result.webSearchTriggered ?? false,
  };

  if (process.env.NODE_ENV === 'production') {
    logger.warn(payload, '[Reporter Tools] Knowledge Retrieval Lite telemetry');
    return;
  }

  logger.info(payload, '[Reporter Tools] Knowledge Retrieval Lite telemetry');
}

function buildKnowledgeSearchCacheKey(
  input: Pick<KnowledgeSearchRuntimeInput, 'query' | 'category' | 'severity'>
): string {
  return JSON.stringify({
    query: normalizeSearchQuery(input.query),
    category: input.category ?? null,
    severity: input.severity ?? null,
  });
}

function getCachedKnowledgeSearch(
  key: string
): Promise<KnowledgeSearchResult> | null {
  const cached = knowledgeSearchCache.get(key);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    knowledgeSearchCache.delete(key);
    return null;
  }

  return cached.promise;
}

function setCachedKnowledgeSearch(
  key: string,
  promise: Promise<KnowledgeSearchResult>
): void {
  knowledgeSearchCache.set(key, {
    expiresAt: Date.now() + KNOWLEDGE_SEARCH_CACHE_TTL_MS,
    promise,
  });
}

export function resetKnowledgeSearchCacheForTest(): void {
  knowledgeSearchCache.clear();
}

const booleanToolFlagSchema = z
  .union([z.boolean(), z.string().regex(/^(true|false)$/i)])
  .transform((value) =>
    typeof value === 'boolean' ? value : value.toLowerCase() === 'true'
  );

function mapEvidenceCardsToRagResults(
  evidenceCards: EvidenceCard[]
): RAGResultItem[] {
  return evidenceCards.map((card) => ({
    id: card.id,
    title: card.title,
    content: card.summary,
    category: card.category ?? card.sourceType,
    similarity: card.score,
    sourceType: card.sourceType,
    hopDistance: 0,
    ...(card.url && { url: card.url }),
  }));
}

function mapRagSourceTypeToEvidenceSourceType(
  result: RAGResultItem
): EvidenceSourceType {
  if (result.sourceType === 'web') return 'web';
  if (result.sourceType === 'incident' || result.category === 'incident') {
    return 'incident';
  }
  if (
    result.sourceType === 'runbook' ||
    result.category === 'troubleshooting' ||
    result.category === 'best_practice' ||
    result.category === 'command'
  ) {
    return 'runbook';
  }
  return 'knowledge';
}

function clampEvidenceScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(1, Math.max(0, score));
}

function mapBalancedResultsToEvidenceCards(
  results: RAGResultItem[],
  originalCards: EvidenceCard[]
): EvidenceCard[] {
  const cardsById = new Map(originalCards.map((card) => [card.id, card]));

  return results.map((result) => {
    const original = cardsById.get(result.id);
    if (original) {
      return {
        ...original,
        category: result.category,
        score: clampEvidenceScore(result.similarity),
        ...(result.url && { url: result.url }),
      };
    }

    return {
      id: result.id,
      title: result.title,
      summary: result.content,
      sourceType: mapRagSourceTypeToEvidenceSourceType(result),
      score: clampEvidenceScore(result.similarity),
      category: result.category,
      ...(result.url && { url: result.url }),
    };
  });
}

function buildUnavailableResult(
  retrievalResult: KnowledgeRetrievalLiteResult
): KnowledgeSearchResult {
  return {
    success: false,
    results: [],
    totalFound: 0,
    _source: retrievalResult._source,
    evidenceCards: retrievalResult.evidenceCards,
    retrieval: retrievalResult.metadata,
    webSearchTriggered: false,
    systemMessage: `TOOL_EXECUTION_FAILED: 지식 베이스 검색 중 오류가 발생했습니다. (오류: ${retrievalResult.error ?? 'unknown'})`,
    suggestedAgentAction:
      '사용자에게 "지식 베이스 검색 중 오류가 발생하여 내재된 기본 지식으로 답변을 제공합니다"라고 알리고, 본래 보유한 기술적 지식 기반으로 구체적인 답변이나 팁을 제공하세요.',
  };
}

export const searchKnowledgeBase = tool({
  description:
    '과거 장애 이력, 운영 런북, 사용 가이드, 토폴로지 문서를 검색합니다 (Knowledge Retrieval Lite: BM25 + metadata boost)',
  inputSchema: z.object({
    query: z.string().describe('검색 쿼리'),
    category: z
      .enum([
        'troubleshooting',
        'security',
        'performance',
        'incident',
        'best_practice',
        'command',
        'architecture',
      ])
      .optional()
      .describe('카테고리 필터'),
    severity: z
      .enum(['low', 'medium', 'high', 'critical', 'info', 'warning'])
      .optional()
      .describe('심각도 필터'),
    fastMode: booleanToolFlagSchema
      .optional()
      .default(true)
      .describe(
        'Deprecated compatibility flag. Lite retrieval is always fast.'
      ),
    includeWebSearch: booleanToolFlagSchema
      .optional()
      .default(false)
      .describe(
        'Deprecated compatibility flag. Web search is handled only by searchWeb.'
      ),
  }),
  execute: async ({
    query,
    category,
    severity,
    fastMode = true,
    includeWebSearch = false,
  }: KnowledgeSearchToolInput) => {
    const cacheKey = buildKnowledgeSearchCacheKey({
      query,
      category,
      severity,
    });

    const cached = getCachedKnowledgeSearch(cacheKey);
    if (cached) {
      logger.info(
        `[Reporter Tools] Knowledge Retrieval Lite cache hit: ${normalizeSearchQuery(query)}`
      );
      return cached.then((result) => {
        emitKnowledgeRetrievalTelemetry(
          { query, category, fastMode, includeWebSearch },
          result,
          { cacheHit: true }
        );
        return result;
      });
    }

    const executionPromise = (async (): Promise<KnowledgeSearchResult> => {
      logger.info(
        `[Reporter Tools] Knowledge Retrieval Lite search: ${query} (category: ${category ?? 'all'})`
      );

      const supabase = await getSupabaseClient();

      if (!supabase) {
        logger.warn('[Reporter Tools] Supabase unavailable, using fallback');
        return {
          success: false,
          results: [] as RAGResultItem[],
          totalFound: 0,
          _source: 'Fallback (No Supabase)',
          evidenceCards: [],
          retrieval: createRetrievalMetadata({
            retrievalEnabled: true,
            retrievalUsed: false,
            retrievalMode: 'lite',
            suppressedReason: 'unavailable',
            evidenceCount: 0,
            webUsed: false,
          }),
          webSearchTriggered: false,
          systemMessage:
            'TOOL_EXECUTION_FAILED: Supabase 데이터베이스 연결 실패로 사내 런북 및 장애 이력을 검색할 수 없습니다.',
          suggestedAgentAction:
            '사용자에게 "현재 사내 지식 문서를 검색할 수 없어 일반적인 지식망을 바탕으로 추론합니다"라고 안내한 뒤, LLM에 내재된 지식만으로 조치 방안을 제시하세요.',
        };
      }

      try {
        const retrievalResult = await retrieveKnowledgeEvidence(
          {
            query,
            category,
            severity,
            limit: DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT,
          },
          { client: supabase }
        );

        if (!retrievalResult.success) {
          const response = buildUnavailableResult(retrievalResult);
          knowledgeSearchCache.delete(cacheKey);
          emitKnowledgeRetrievalTelemetry(
            { query, category, fastMode, includeWebSearch },
            response,
            { cacheHit: false }
          );
          return response;
        }

        const ragResults = mapEvidenceCardsToRagResults(
          retrievalResult.evidenceCards
        );
        const balancedResults = rebalanceRagResultsForMonitoring(
          ragResults,
          query,
          category,
          DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT
        );
        const balancedEvidenceCards = mapBalancedResultsToEvidenceCards(
          balancedResults,
          retrievalResult.evidenceCards
        );

        const response: KnowledgeSearchResult = {
          success: true,
          results: balancedResults,
          totalFound: balancedEvidenceCards.length,
          _source: retrievalResult._source,
          evidenceCards: balancedEvidenceCards,
          retrieval: {
            ...retrievalResult.metadata,
            evidenceCount: balancedEvidenceCards.length,
          },
          fastMode,
          webSearchTriggered: false,
        };

        emitKnowledgeRetrievalTelemetry(
          { query, category, fastMode, includeWebSearch },
          response,
          { cacheHit: false }
        );
        return response;
      } catch (error) {
        knowledgeSearchCache.delete(cacheKey);
        logger.error('[Reporter Tools] Knowledge Retrieval Lite error:', error);

        const response: KnowledgeSearchResult = {
          success: false,
          results: [] as RAGResultItem[],
          totalFound: 0,
          _source: 'Knowledge Retrieval Lite (Unavailable)',
          evidenceCards: [],
          retrieval: createRetrievalMetadata({
            retrievalEnabled: true,
            retrievalUsed: false,
            retrievalMode: 'lite',
            suppressedReason: 'unavailable',
            evidenceCount: 0,
            webUsed: false,
          }),
          webSearchTriggered: false,
          systemMessage: `TOOL_EXECUTION_FAILED: 지식 베이스 검색 중 오류가 발생했습니다. (오류: ${String(error)})`,
          suggestedAgentAction:
            '사용자에게 "지식 베이스 검색 중 오류가 발생하여 내재된 기본 지식으로 답변을 제공합니다"라고 알리고, 본래 보유한 기술적 지식 기반으로 구체적인 답변이나 팁을 제공하세요.',
        };
        emitKnowledgeRetrievalTelemetry(
          { query, category, fastMode, includeWebSearch },
          response,
          { cacheHit: false }
        );
        return response;
      }
    })();

    setCachedKnowledgeSearch(cacheKey, executionPromise);
    return executionPromise;
  },
});
