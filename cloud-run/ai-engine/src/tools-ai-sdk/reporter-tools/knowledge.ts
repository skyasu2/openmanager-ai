/**
 * Reporter Tools - Knowledge Base Search & Command Recommendations
 *
 * RAG search with GraphRAG (Vector + Graph traversal) and CLI command recommendations.
 * Extracted from reporter-tools.ts for modularity.
 *
 * @version 1.0.0
 * @updated 2025-12-28
 */

import { tool } from 'ai';
import { z } from 'zod';
import { getSupabaseConfig } from '../../lib/config-parser';
import { searchWithEmbedding, embedText } from '../../lib/embedding';
import { hybridGraphSearch } from '../../lib/llamaindex-rag-service';
import { shouldUseHyDE, expandQueryWithHyDE } from '../../lib/query-expansion';
import { rerankDocuments, isRerankerAvailable } from '../../lib/reranker';
import { enhanceWithWebSearch, isTavilyAvailable, type HybridRAGDocument } from '../../lib/tavily-hybrid-rag';
import { logger } from '../../lib/logger';

// ============================================================================
// 1. Types
// ============================================================================

export interface SupabaseClientLike {
  rpc: (
    fn: string,
    params: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>;
}

export interface RAGResultItem {
  id: string;
  title: string;
  content: string;
  category: string;
  similarity: number;
  sourceType: 'vector' | 'graph' | 'web' | 'fallback';
  hopDistance: number;
  url?: string; // For web search results
}

export interface CommandRecommendation {
  command: string;
  description: string;
  keywords: string[];
}

// ============================================================================
// 2. Supabase Client Singleton
// ============================================================================

let supabaseInstance: SupabaseClientLike | null = null;

async function getSupabaseClient(): Promise<SupabaseClientLike | null> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const config = getSupabaseConfig();
  if (!config) {
    logger.warn('⚠️ [Reporter Tools] Supabase config missing');
    return null;
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseInstance = createClient(
      config.url,
      config.serviceRoleKey
    ) as unknown as SupabaseClientLike;
    return supabaseInstance;
  } catch (err) {
    logger.error('⚠️ [Reporter Tools] Supabase client init failed:', err);
    return null;
  }
}

// ============================================================================
// Dynamic Similarity Threshold (Cost Optimization)
// ============================================================================

/**
 * Calculate dynamic similarity threshold based on query context
 * - Urgent/incident queries: Lower threshold (more results)
 * - General queries: Higher threshold (precise results)
 */
export function getDynamicThreshold(query: string, category?: string): number {
  const q = query.toLowerCase();

  // Urgent keywords -> Lower threshold (more inclusive)
  const urgentKeywords = ['장애', '긴급', 'critical', 'urgent', '에러', 'error', 'incident', '다운'];
  if (urgentKeywords.some(k => q.includes(k)) || category === 'incident') {
    return 0.25;
  }

  // Security/performance -> Medium threshold
  if (category === 'security' || category === 'performance') {
    return 0.35;
  }

  // Default threshold
  return 0.4;
}

/**
 * Calculate dynamic search weights based on query characteristics.
 * - Exact keyword queries (e.g. "redis maxmemory"): boost BM25 text weight
 * - Conceptual/ambiguous queries (e.g. "서버 느려짐"): boost vector weight
 * - Troubleshooting queries with context: boost graph weight
 */
export function getDynamicSearchWeights(query: string, category?: string): {
  vectorWeight: number;
  textWeight: number;
  graphWeight: number;
} {
  const q = query.toLowerCase();

  // Technical keyword-heavy queries → boost BM25
  const technicalTerms = ['redis', 'nginx', 'docker', 'postgresql', 'mysql', 'kubernetes', 'k8s', 'oom', 'gc', 'ssl', 'tls', 'dns'];
  const hasTechnicalTerms = technicalTerms.filter(t => q.includes(t)).length >= 1;

  // Incident/troubleshooting → boost graph traversal for related knowledge
  if (category === 'incident' || category === 'troubleshooting') {
    return { vectorWeight: 0.4, textWeight: 0.25, graphWeight: 0.35 };
  }

  // Technical exact match queries → boost BM25
  if (hasTechnicalTerms) {
    return { vectorWeight: 0.35, textWeight: 0.45, graphWeight: 0.2 };
  }

  // Default balanced weights
  return { vectorWeight: 0.5, textWeight: 0.3, graphWeight: 0.2 };
}

const COMMAND_INTENT_KEYWORDS = [
  'command',
  'cmd',
  'cli',
  'shell',
  'terminal',
  '명령어',
  '터미널',
  '쉘',
  'kubectl',
  'docker',
  'systemctl',
  'journalctl',
  'ps ',
  'top ',
  'df ',
  'free ',
  'netstat',
  'tail ',
] as const;

const INCIDENT_ANALYSIS_KEYWORDS = [
  'incident',
  '장애',
  'error',
  '에러',
  '오류',
  '원인',
  '분석',
  '대응',
  '복구',
  'timeout',
  '지연',
] as const;

const DESTRUCTIVE_COMMAND_TITLES = [
  'docker system prune',
] as const;

const DESTRUCTIVE_COMMAND_QUERY_ALLOWLIST = [
  '정리',
  'cleanup',
  'clean up',
  '디스크',
  'disk',
  '용량',
  'space',
  'prune',
] as const;

type ToolSeverityFilter = 'low' | 'medium' | 'high' | 'critical' | 'info' | 'warning';

export function mapSeverityFilter(severity?: ToolSeverityFilter): 'info' | 'warning' | 'critical' | undefined {
  if (!severity) return undefined;
  if (severity === 'critical') return 'critical';
  if (severity === 'warning' || severity === 'high' || severity === 'medium') return 'warning';
  return 'info';
}

export function isCommandIntentQuery(query: string, category?: string): boolean {
  if (category === 'command') return true;
  const lowerQuery = query.toLowerCase();
  return COMMAND_INTENT_KEYWORDS.some((keyword) => lowerQuery.includes(keyword));
}

function isIncidentAnalysisQuery(query: string, category?: string): boolean {
  if (category === 'incident' || category === 'troubleshooting') return true;
  const lowerQuery = query.toLowerCase();
  return INCIDENT_ANALYSIS_KEYWORDS.some((keyword) => lowerQuery.includes(keyword));
}

function normalizeTitleForDedup(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function deduplicateRagResultsByTitle(results: RAGResultItem[]): RAGResultItem[] {
  const bestByTitle = new Map<string, RAGResultItem>();
  for (const result of results) {
    const key = normalizeTitleForDedup(result.title);
    const existing = bestByTitle.get(key);
    if (!existing || result.similarity > existing.similarity) {
      bestByTitle.set(key, result);
    }
  }
  return Array.from(bestByTitle.values());
}

export function rebalanceRagResultsForMonitoring(
  results: RAGResultItem[],
  query: string,
  category?: string,
  maxResults?: number
): RAGResultItem[] {
  if (results.length === 0) return results;

  const limit = maxResults && maxResults > 0 ? maxResults : results.length;
  const lowerQuery = query.toLowerCase();
  const allowDestructiveCommand = DESTRUCTIVE_COMMAND_QUERY_ALLOWLIST.some((keyword) =>
    lowerQuery.includes(keyword)
  );

  const deduplicated = deduplicateRagResultsByTitle(results)
    .filter((r) => {
      const title = r.title.trim().toLowerCase();
      if (!DESTRUCTIVE_COMMAND_TITLES.includes(title as typeof DESTRUCTIVE_COMMAND_TITLES[number])) {
        return true;
      }
      return allowDestructiveCommand || isCommandIntentQuery(query, category);
    })
    .sort((a, b) => b.similarity - a.similarity);

  if (isCommandIntentQuery(query, category)) {
    return deduplicated.slice(0, limit);
  }

  const incidentAnalysis = isIncidentAnalysisQuery(query, category);
  const rerankedForIntent = deduplicated
    .map((r) => {
      let adjustedScore = r.similarity;
      if (incidentAnalysis) {
        if (r.category === 'incident') adjustedScore += 0.08;
        else if (r.category === 'troubleshooting') adjustedScore += 0.05;
        else if (r.category === 'best_practice') adjustedScore += 0.03;
      }
      if (r.category === 'command') adjustedScore -= 0.04;
      return { ...r, similarity: adjustedScore };
    })
    .sort((a, b) => b.similarity - a.similarity);

  const nonCommand = rerankedForIntent.filter((r) => r.category !== 'command');
  const command = rerankedForIntent.filter((r) => r.category === 'command');

  // Monitoring/incident analysis query에서는 command 문서를 보조 맥락으로 최대 1개만 허용
  // (완전 차단하지 않아 운영 커맨드 힌트는 유지)
  if (nonCommand.length === 0) {
    return deduplicated.slice(0, Math.min(limit, 2));
  }

  const commandCandidate = command.find((r) => r.similarity >= 0.45);
  const merged = commandCandidate ? [...nonCommand, commandCandidate] : nonCommand;

  return merged.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
}

// ============================================================================
// 3. AI SDK Tools
// ============================================================================

/**
 * Search Knowledge Base Tool
 * Uses GraphRAG hybrid search (Vector + Graph traversal)
 * with dynamic similarity threshold
 */
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
      .describe('Fast mode (default: true): HyDE expansion과 LLM reranking을 스킵하여 1-2초 내 응답. 과거 장애 이력 심층 분석 등 정밀도가 필요한 경우에만 false로 설정'),
    includeWebSearch: z
      .boolean()
      .default(false)
      .describe('KB 결과 부족 시 웹 검색 자동 보강 (개인정보 보호를 위해 기본 비활성화)'),
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
    // Dynamic threshold based on query context
    const initialThreshold = getDynamicThreshold(query, category);

    // HyDE Query Expansion for short/ambiguous queries
    // Fast mode: Skip HyDE expansion (-5s latency saving)
    let searchQuery = query;
    let hydeApplied = false;

    if (!fastMode && shouldUseHyDE(query)) {
      try {
        searchQuery = await expandQueryWithHyDE(query);
        hydeApplied = searchQuery !== query;
        if (hydeApplied) {
          console.log(`🧠 [Reporter Tools] HyDE applied: "${query}" → "${searchQuery.substring(0, 50)}..."`);
        }
      } catch (err) {
        logger.warn(`⚠️ [Reporter Tools] HyDE expansion failed, using original query:`, err);
      }
    }

    if (fastMode) {
      console.log(`⚡ [Reporter Tools] Fast mode enabled: skipping HyDE + reranking`);
    }

    console.log(
      `🔍 [Reporter Tools] GraphRAG search: ${query} (graph: ${useGraphRAG}, threshold: ${initialThreshold}, hyde: ${hydeApplied}, fast: ${fastMode})`
    );

    const supabase = await getSupabaseClient();

    if (!supabase) {
      logger.warn('⚠️ [Reporter Tools] Supabase unavailable, using fallback');
      return {
        success: true,
        results: [
          {
            id: 'fallback-1',
            title: '기본 문제 해결 가이드',
            content:
              '일반적인 문제 해결 절차: 1. 로그 확인 2. 리소스 사용량 체크 3. 서비스 재시작',
            category: 'troubleshooting',
            similarity: 0.8,
            sourceType: 'fallback' as const,
            hopDistance: 0,
          },
        ] as RAGResultItem[],
        totalFound: 1,
        _source: 'Fallback (No Supabase)',
      };
    }

    try {
      // 1. Generate query embedding (uses cache, apply HyDE if expanded)
      const queryEmbedding = await embedText(searchQuery);

      // 2. Use hybrid GraphRAG search if enabled
      if (useGraphRAG) {
        // Fast mode: Reduced search scope for lower latency
        const maxVectorResults = fastMode ? 3 : 5;
        const maxGraphHops = fastMode ? 1 : 2;
        const maxTotalResults = fastMode ? 5 : 10;

        // Dynamic search weights based on query characteristics
        const searchWeights = getDynamicSearchWeights(query, category);

        // First attempt with dynamic threshold and weights
        let hybridResults = await hybridGraphSearch(queryEmbedding, {
          query,
          useBM25: true,
          similarityThreshold: initialThreshold,
          maxVectorResults,
          maxGraphHops,
          maxTotalResults,
          ...searchWeights,
        });

        // Retry with lower threshold if no results (adaptive fallback)
        if (hybridResults.length === 0 && initialThreshold > 0.25) {
          console.log(`🔄 [Reporter Tools] No results, retrying with lower threshold (0.2)`);
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
            (r) => r.sourceType === 'vector'
          ).length;
          const graphCount = hybridResults.filter(
            (r) => r.sourceType === 'graph'
          ).length;

          console.log(
            `📊 [Reporter Tools] GraphRAG: ${vectorCount} vector, ${graphCount} graph`
          );

          // Apply LLM reranking for improved relevance
          // Fast mode: Skip LLM reranking (-8s latency saving)
          let finalResults = graphEnhanced;
          let reranked = false;

          if (!fastMode && isRerankerAvailable() && graphEnhanced.length > 2) {
            try {
              const rerankedResults = await rerankDocuments(
                query, // Use original query for reranking
                graphEnhanced.map((r) => ({
                  id: r.id,
                  title: r.title,
                  content: r.content,
                  originalScore: r.similarity,
                })),
                { topK: 5, minScore: 0.3 }
              );

              finalResults = rerankedResults.map((r) => ({
                id: r.id,
                title: r.title,
                content: r.content,
                category: graphEnhanced.find((g) => g.id === r.id)?.category || category || 'auto',
                similarity: r.rerankScore,
                sourceType: graphEnhanced.find((g) => g.id === r.id)?.sourceType || 'vector',
                hopDistance: graphEnhanced.find((g) => g.id === r.id)?.hopDistance || 0,
              })) as RAGResultItem[];

              reranked = true;
              console.log(`🎯 [Reporter Tools] Reranked ${graphEnhanced.length} → ${finalResults.length} results`);
            } catch (rerankError) {
              logger.warn('⚠️ [Reporter Tools] Reranking failed, using original order:', rerankError);
            }
          }

          // Enhance with web search if enabled and KB results insufficient
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

              const webEnhanced = await enhanceWithWebSearch(query, hybridDocs, {
                minKBResults: 2,
                minKBScore: 0.4,
                maxWebResults: 3,
              });

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
                      : (graphEnhanced.find((g) => g.id === r.id)?.category || category || 'auto'),
                  similarity: r.score,
                  sourceType: r.source === 'web' ? 'web' as const : (graphEnhanced.find((g) => g.id === r.id)?.sourceType || 'vector'),
                  hopDistance: r.source === 'web' ? 0 : (graphEnhanced.find((g) => g.id === r.id)?.hopDistance || 0),
                  url: r.url,
                })) as RAGResultItem[];

                console.log(`🌐 [Reporter Tools] Web search added ${webResultsCount} results`);
              }
            } catch (webError) {
              logger.warn('⚠️ [Reporter Tools] Web search enhancement failed:', webError);
            }
          }

          const balancedResults = rebalanceRagResultsForMonitoring(
            finalResults,
            query,
            category,
            maxTotalResults
          );

          return {
            success: true,
            results: balancedResults,
            totalFound: balancedResults.length,
            _source: webSearchTriggered
              ? 'GraphRAG Hybrid + Web'
              : reranked
                ? 'GraphRAG Hybrid + Rerank'
                : 'GraphRAG Hybrid (Vector + Graph)',
            graphStats: { vectorResults: vectorCount, graphResults: graphCount, webResults: webResultsCount },
            hydeApplied,
            reranked,
            fastMode,
            webSearchTriggered,
          };
        }
      }

      // 3. Fallback to traditional vector search (with dynamic threshold)
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
        5
      );

      return {
        success: true,
        results: balancedVectorResults,
        totalFound: balancedVectorResults.length,
        _source: 'Supabase pgvector (Vector Only)',
        hydeApplied,
      };
    } catch (error) {
      logger.error('❌ [Reporter Tools] RAG search error:', error);

      return {
        success: true,
        results: [
          {
            id: 'error-fallback',
            title: '검색 오류 발생',
            content: `검색 중 오류가 발생했습니다. 오류: ${String(error)}`,
            category: 'error',
            similarity: 0,
            sourceType: 'fallback' as const,
            hopDistance: 0,
          },
        ] as RAGResultItem[],
        totalFound: 1,
        _source: 'Error Fallback',
      };
    }
  },
});

/**
 * Recommend Commands Tool
 * Matches keywords to CLI command recommendations
 */
export const recommendCommands = tool({
  description: '사용자 질문에 적합한 CLI 명령어를 추천합니다',
  inputSchema: z.object({
    keywords: z.array(z.string()).describe('질문에서 추출한 핵심 키워드'),
  }),
  execute: async ({ keywords }: { keywords: string[] }) => {
    const recommendations: CommandRecommendation[] = [
      {
        keywords: ['서버', '목록', '조회'],
        command: 'list servers',
        description: '서버 목록 조회',
      },
      {
        keywords: ['상태', '체크', '확인'],
        command: 'status check',
        description: '시스템 상태 점검',
      },
      {
        keywords: ['로그', '분석', '에러'],
        command: 'analyze logs',
        description: '로그 분석',
      },
      {
        keywords: ['재시작', 'restart', '복구'],
        command: 'service restart <service_name>',
        description: '서비스 재시작',
      },
      {
        keywords: ['메모리', '정리', 'cache'],
        command: 'clear cache',
        description: '캐시 정리',
      },
      {
        keywords: ['cpu', '프로세서', '부하'],
        command: 'top -o cpu',
        description: 'CPU 사용량 상위 프로세스 조회',
      },
      {
        keywords: ['디스크', '용량', 'disk'],
        command: 'df -h',
        description: '디스크 사용량 조회',
      },
      {
        keywords: ['네트워크', 'network', '연결'],
        command: 'netstat -an',
        description: '네트워크 연결 상태 조회',
      },
    ];

    const matched = recommendations.filter((rec) =>
      keywords.some((k) =>
        rec.keywords.some(
          (rk) =>
            rk.toLowerCase().includes(k.toLowerCase()) ||
            k.toLowerCase().includes(rk.toLowerCase())
        )
      )
    );

    const result =
      matched.length > 0 ? matched : recommendations.slice(0, 3);

    return {
      success: true,
      recommendations: result.map((r) => ({
        command: r.command,
        description: r.description,
      })),
      matchedKeywords: keywords,
      _mode: 'command-recommendation',
    };
  },
});

// ============================================================================
// 4. Helper: Extract Keywords from Query
// ============================================================================

/**
 * Extract keywords from user query for command matching
 */
export function extractKeywordsFromQuery(query: string): string[] {
  const keywords: string[] = [];
  const q = query.toLowerCase();

  const patterns = [
    { regex: /서버|server/gi, keyword: '서버' },
    { regex: /상태|status/gi, keyword: '상태' },
    { regex: /에러|error|오류/gi, keyword: '에러' },
    { regex: /로그|log/gi, keyword: '로그' },
    { regex: /메모리|memory/gi, keyword: '메모리' },
    { regex: /cpu|프로세서/gi, keyword: 'cpu' },
    { regex: /디스크|disk/gi, keyword: '디스크' },
    { regex: /재시작|restart/gi, keyword: '재시작' },
    { regex: /장애|failure|incident/gi, keyword: '장애' },
    { regex: /네트워크|network/gi, keyword: '네트워크' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(q)) {
      keywords.push(pattern.keyword);
    }
  }

  return keywords.length > 0 ? keywords : ['일반', '조회'];
}
