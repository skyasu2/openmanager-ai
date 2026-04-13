import { tool } from 'ai';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { embedText, searchWithEmbedding } from '../../lib/embedding';
import { hybridGraphSearch } from '../../lib/graphrag-service';
import { logger } from '../../lib/logger';
import { expandQueryWithHyDE, shouldUseHyDE } from '../../lib/query-expansion';
import { isRerankerAvailable, rerankDocuments } from '../../lib/reranker';
import {
  enhanceWithWebSearch,
  type HybridRAGDocument,
  isTavilyAvailable,
} from '../../lib/tavily-hybrid-rag';
import { getSupabaseClient } from './knowledge-client';
import {
  getDynamicSearchWeights,
  getDynamicThreshold,
  mapSeverityFilter,
  rebalanceRagResultsForMonitoring,
} from './knowledge-helpers';
import type { RAGResultItem, ToolSeverityFilter } from './knowledge-types';

const KNOWLEDGE_SEARCH_CACHE_TTL_MS = 30_000;
const DEFAULT_PRODUCTION_GRAPHRAG_TELEMETRY_SAMPLE_RATE = 0.1;

type KnowledgeSearchInput = {
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
  useGraphRAG?: boolean;
  fastMode?: boolean;
  includeWebSearch?: boolean;
};

type KnowledgeSearchResult = {
  success: boolean;
  results: RAGResultItem[];
  totalFound: number;
  _source: string;
  systemMessage?: string;
  suggestedAgentAction?: string;
  graphStats?: {
    vectorResults: number;
    graphResults: number;
    webResults?: number;
  };
  hydeApplied?: boolean;
  reranked?: boolean;
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

function getGraphRAGTelemetrySampleRate(): number {
  const raw = process.env.GRAPH_RAG_TELEMETRY_SAMPLE_RATE;
  if (!raw) {
    return process.env.NODE_ENV === 'production'
      ? DEFAULT_PRODUCTION_GRAPHRAG_TELEMETRY_SAMPLE_RATE
      : 1;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return process.env.NODE_ENV === 'production'
      ? DEFAULT_PRODUCTION_GRAPHRAG_TELEMETRY_SAMPLE_RATE
      : 1;
  }

  return Math.min(1, Math.max(0, parsed));
}

function shouldEmitGraphRAGTelemetry(): boolean {
  return Math.random() < getGraphRAGTelemetrySampleRate();
}

function emitGraphRAGTelemetry(
  input: Pick<
    KnowledgeSearchInput,
    'query' | 'category' | 'useGraphRAG' | 'fastMode' | 'includeWebSearch'
  >,
  result: KnowledgeSearchResult,
  options: { cacheHit: boolean }
): void {
  if (!shouldEmitGraphRAGTelemetry()) {
    return;
  }

  const payload = {
    event: 'graph_rag_search',
    component: 'reporter_tools',
    queryFingerprint: buildQueryFingerprint(input.query),
    queryCategory: input.category ?? 'all',
    useGraphRAG: input.useGraphRAG ?? true,
    fastMode: input.fastMode ?? true,
    includeWebSearch: input.includeWebSearch ?? false,
    cacheHit: options.cacheHit,
    success: result.success,
    source: result._source,
    totalFound: result.totalFound,
    vectorResults: result.graphStats?.vectorResults ?? 0,
    graphResults: result.graphStats?.graphResults ?? 0,
    webResults: result.graphStats?.webResults ?? 0,
    hydeApplied: result.hydeApplied ?? false,
    reranked: result.reranked ?? false,
    webSearchTriggered: result.webSearchTriggered ?? false,
  };

  if (process.env.NODE_ENV === 'production') {
    logger.warn(payload, '[Reporter Tools] GraphRAG telemetry');
    return;
  }

  logger.info(payload, '[Reporter Tools] GraphRAG telemetry');
}

function buildKnowledgeSearchCacheKey(input: KnowledgeSearchInput): string {
  return JSON.stringify({
    query: normalizeSearchQuery(input.query),
    category: input.category ?? null,
    severity: input.severity ?? null,
    useGraphRAG: input.useGraphRAG ?? true,
    fastMode: input.fastMode ?? true,
    includeWebSearch: input.includeWebSearch ?? false,
  });
}

function getCachedKnowledgeSearch(
  key: string,
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
  promise: Promise<KnowledgeSearchResult>,
): void {
  knowledgeSearchCache.set(key, {
    expiresAt: Date.now() + KNOWLEDGE_SEARCH_CACHE_TTL_MS,
    promise,
  });
}

export function resetKnowledgeSearchCacheForTest(): void {
  knowledgeSearchCache.clear();
}

export const searchKnowledgeBase = tool({
  description:
    '과거 장애 이력 및 해결 방법을 검색합니다 (GraphRAG: Vector + Graph)',
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
    useGraphRAG: z
      .boolean()
      .default(true)
      .describe('GraphRAG 하이브리드 검색 사용 여부'),
    fastMode: z
      .boolean()
      .default(true)
      .describe(
        'Fast mode (default: true): HyDE expansion과 LLM reranking을 스킵하여 1-2초 내 응답. 과거 장애 이력 심층 분석 등 정밀도가 필요한 경우에만 false로 설정',
      ),
    includeWebSearch: z
      .boolean()
      .default(false)
      .describe(
        'KB 결과 부족 시 웹 검색 자동 보강 (개인정보 보호를 위해 기본 비활성화)',
      ),
  }),
  execute: async ({
    query,
    category,
    severity,
    useGraphRAG = true,
    fastMode = true,
    includeWebSearch = false,
  }: {
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
    useGraphRAG?: boolean;
    fastMode?: boolean;
    includeWebSearch?: boolean;
  }) => {
    const cacheKey = buildKnowledgeSearchCacheKey({
      query,
      category,
      severity,
      useGraphRAG,
      fastMode,
      includeWebSearch,
    });

    const cached = getCachedKnowledgeSearch(cacheKey);
    if (cached) {
      logger.info(
        `[Reporter Tools] GraphRAG cache hit: ${normalizeSearchQuery(query)}`,
      );
      return cached.then((result) => {
        emitGraphRAGTelemetry(
          { query, category, useGraphRAG, fastMode, includeWebSearch },
          result,
          { cacheHit: true }
        );
        return result;
      });
    }

    const executionPromise = (async (): Promise<KnowledgeSearchResult> => {
      const initialThreshold = getDynamicThreshold(query, category);
      let searchQuery = query;
      let hydeApplied = false;

      if (!fastMode && shouldUseHyDE(query)) {
        try {
          searchQuery = await expandQueryWithHyDE(query);
          hydeApplied = searchQuery !== query;
          if (hydeApplied) {
            logger.info(
              `[Reporter Tools] HyDE applied: "${query}" -> "${searchQuery.substring(0, 50)}..."`,
            );
          }
        } catch (err) {
          logger.warn(
            '[Reporter Tools] HyDE expansion failed, using original query:',
            err,
          );
        }
      }

      if (fastMode) {
        logger.info(
          '[Reporter Tools] Fast mode enabled: skipping HyDE + reranking',
        );
      }

      logger.info(
        `[Reporter Tools] GraphRAG search: ${query} (graph: ${useGraphRAG}, threshold: ${initialThreshold}, hyde: ${hydeApplied}, fast: ${fastMode})`,
      );

      const supabase = await getSupabaseClient();

      if (!supabase) {
        logger.warn('[Reporter Tools] Supabase unavailable, using fallback');
        return {
          success: false,
          results: [] as RAGResultItem[],
          totalFound: 0,
          _source: 'Fallback (No Supabase)',
          systemMessage: 'TOOL_EXECUTION_FAILED: Supabase 데이터베이스 연결 실패로 사내 런북 및 장애 이력을 검색할 수 없습니다.',
          suggestedAgentAction: '사용자에게 "현재 사내 지식 문서를 검색할 수 없어 일반적인 지식망을 바탕으로 추론합니다"라고 안내한 뒤, LLM에 내재된 지식만으로 조치 방안을 제시하세요.',
        };
      }

      try {
        const queryEmbedding = await embedText(searchQuery);

        if (useGraphRAG) {
          const maxVectorResults = fastMode ? 3 : 5;
          const maxGraphHops = fastMode ? 1 : 2;
          const maxTotalResults = fastMode ? 5 : 10;
          const searchWeights = getDynamicSearchWeights(query, category);

          let hybridResults = await hybridGraphSearch(queryEmbedding, {
            query,
            useBM25: true,
            similarityThreshold: initialThreshold,
            maxVectorResults,
            maxGraphHops,
            maxTotalResults,
            ...searchWeights,
          });

          if (hybridResults.length === 0 && initialThreshold > 0.25) {
            logger.info(
              '[Reporter Tools] No results, retrying with lower threshold (0.2)',
            );
            hybridResults = await hybridGraphSearch(queryEmbedding, {
              query,
              useBM25: true,
              similarityThreshold: 0.2,
              maxVectorResults,
              maxGraphHops,
              maxTotalResults,
              ...searchWeights,
            });
          }

          if (hybridResults.length > 0) {
            const graphEnhanced: RAGResultItem[] = hybridResults.map((r) => ({
              id: r.id,
              title: r.title,
              content: r.content.substring(0, 1500),
              category: r.category || category || 'auto',
              similarity: r.score,
              sourceType: r.sourceType as 'vector' | 'graph',
              hopDistance: r.hopDistance,
            }));

            const vectorCount = hybridResults.filter(
              (r) => r.sourceType === 'vector',
            ).length;
            const graphCount = hybridResults.filter(
              (r) => r.sourceType === 'graph',
            ).length;

            logger.info(
              `[Reporter Tools] GraphRAG: ${vectorCount} vector, ${graphCount} graph`,
            );

            let finalResults = graphEnhanced;
            let reranked = false;

            if (!fastMode && isRerankerAvailable() && graphEnhanced.length > 2) {
              try {
                const rerankedResults = await rerankDocuments(
                  query,
                  graphEnhanced.map((r) => ({
                    id: r.id,
                    title: r.title,
                    content: r.content,
                    originalScore: r.similarity,
                  })),
                  { topK: 5, minScore: 0.3 },
                );

                finalResults = rerankedResults.map((r) => ({
                  id: r.id,
                  title: r.title,
                  content: r.content,
                  category:
                    graphEnhanced.find((g) => g.id === r.id)?.category ||
                    category ||
                    'auto',
                  similarity: r.rerankScore,
                  sourceType:
                    graphEnhanced.find((g) => g.id === r.id)?.sourceType ||
                    'vector',
                  hopDistance:
                    graphEnhanced.find((g) => g.id === r.id)?.hopDistance || 0,
                })) as RAGResultItem[];

                reranked = true;
                logger.info(
                  `[Reporter Tools] Reranked ${graphEnhanced.length} -> ${finalResults.length} results`,
                );
              } catch (rerankError) {
                logger.warn(
                  '[Reporter Tools] Reranking failed, using original order:',
                  rerankError,
                );
              }
            }

            let webSearchTriggered = false;
            let webResultsCount = 0;

            if (includeWebSearch && isTavilyAvailable()) {
              try {
                const hybridDocs: HybridRAGDocument[] = finalResults.map((r) => ({
                  id: r.id,
                  title: r.title,
                  content: r.content,
                  score: r.similarity,
                  source: 'knowledge_base' as const,
                }));

                const webEnhanced = await enhanceWithWebSearch(
                  query,
                  hybridDocs,
                  {
                    minKBResults: 2,
                    minKBScore: 0.4,
                    maxWebResults: 3,
                  },
                );

                webSearchTriggered = webEnhanced.webSearchTriggered;
                webResultsCount = webEnhanced.webResultsCount;

                if (webSearchTriggered && webResultsCount > 0) {
                  finalResults = webEnhanced.results.map((r) => ({
                    id: r.id,
                    title: r.title,
                    content: r.content,
                    category:
                      r.source === 'web'
                        ? 'web-search'
                        : graphEnhanced.find((g) => g.id === r.id)?.category ||
                          category ||
                          'auto',
                    similarity: r.score,
                    sourceType:
                      r.source === 'web'
                        ? ('web' as const)
                        : graphEnhanced.find((g) => g.id === r.id)?.sourceType ||
                          'vector',
                    hopDistance:
                      r.source === 'web'
                        ? 0
                        : graphEnhanced.find((g) => g.id === r.id)?.hopDistance ||
                          0,
                    url: r.url,
                  })) as RAGResultItem[];

                  logger.info(
                    `[Reporter Tools] Web search added ${webResultsCount} results`,
                  );
                }
              } catch (webError) {
                logger.warn(
                  '[Reporter Tools] Web search enhancement failed:',
                  webError,
                );
              }
            }

            const balancedResults = rebalanceRagResultsForMonitoring(
              finalResults,
              query,
              category,
              maxTotalResults,
            );

            const response = {
              success: true,
              results: balancedResults,
              totalFound: balancedResults.length,
              _source: webSearchTriggered
                ? 'GraphRAG Hybrid + Web'
                : reranked
                  ? 'GraphRAG Hybrid + Rerank'
                  : 'GraphRAG Hybrid (Vector + Graph)',
              graphStats: {
                vectorResults: vectorCount,
                graphResults: graphCount,
                webResults: webResultsCount,
              },
              hydeApplied,
              reranked,
              fastMode,
              webSearchTriggered,
            };
            emitGraphRAGTelemetry(
              { query, category, useGraphRAG, fastMode, includeWebSearch },
              response,
              { cacheHit: false }
            );
            return response;
          }
        }

        const result = await searchWithEmbedding(supabase, query, {
          similarityThreshold: initialThreshold,
          maxResults: 5,
          category: category || undefined,
          severity: mapSeverityFilter(severity),
        });

        if (!result.success) {
          throw new Error(result.error || 'RAG search failed');
        }

        const vectorResults = result.results.map((r) => ({
          ...r,
          sourceType: 'vector' as const,
          hopDistance: 0,
        }));

        const balancedVectorResults = rebalanceRagResultsForMonitoring(
          vectorResults,
          query,
          category,
          5,
        );

        const response = {
          success: true,
          results: balancedVectorResults,
          totalFound: balancedVectorResults.length,
          _source: 'Supabase pgvector (Vector Only)',
          hydeApplied,
        };
        emitGraphRAGTelemetry(
          { query, category, useGraphRAG, fastMode, includeWebSearch },
          response,
          { cacheHit: false }
        );
        return response;
      } catch (error) {
        knowledgeSearchCache.delete(cacheKey);
        logger.error('[Reporter Tools] RAG search error:', error);

        return {
          success: false,
          results: [] as RAGResultItem[],
          totalFound: 0,
          _source: 'Error Fallback',
          systemMessage: `TOOL_EXECUTION_FAILED: 지식 베이스 검색 중 오류가 발생했습니다. (오류: ${String(error)})`,
          suggestedAgentAction: '사용자에게 "지식 베이스 검색 중 오류가 발생하여 내재된 기본 지식으로 답변을 제공합니다"라고 알리고, 본래 보유한 기술적 지식 기반으로 구체적인 답변이나 팁을 제공하세요.',
        };
      }
    })();

    setCachedKnowledgeSearch(cacheKey, executionPromise);
    return executionPromise;
  },
});
