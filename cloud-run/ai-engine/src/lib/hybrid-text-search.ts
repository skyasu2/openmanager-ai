/**
 * Hybrid Text-Vector Search Module
 *
 * Combines BM25 text search with vector similarity and graph traversal
 * for enhanced RAG retrieval accuracy.
 *
 * Architecture:
 * - Vector Search: Semantic meaning (Mistral embeddings, 1024d)
 * - BM25 Text Search: Exact keyword matching (PostgreSQL tsvector)
 * - Graph Traversal: Relationship understanding (knowledge_relationships)
 *
 * @version 1.0.0
 * @created 2026-01-26
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config-parser';
import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export interface HybridSearchOptions {
  /** Weight for vector similarity (default: 0.5) */
  vectorWeight?: number;
  /** Weight for BM25 text search (default: 0.3) */
  textWeight?: number;
  /** Weight for graph traversal (default: 0.2) */
  graphWeight?: number;
  /** Max vector search results (default: 5) */
  maxVectorResults?: number;
  /** Max text search results (default: 5) */
  maxTextResults?: number;
  /** Max total results (default: 15) */
  maxTotalResults?: number;
  /** Similarity threshold (default: 0.3) */
  threshold?: number;
  /** Filter by category */
  category?: string;
  /** Max graph hops (default: 2) */
  maxGraphHops?: number;
}

export interface HybridSearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  /** Combined weighted score */
  score: number;
  /** Vector similarity score (0-1) */
  vectorScore: number;
  /** BM25 text rank score */
  textScore: number;
  /** Graph path weight */
  graphScore: number;
  /** Source type: hybrid (direct match) or graph (traversal) */
  sourceType: 'hybrid' | 'graph';
  /** Graph hop distance (0 for direct matches) */
  hopDistance: number;
}

// ============================================================================
// Supabase Client
// ============================================================================

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const config = getSupabaseConfig();
  if (!config) {
    logger.warn('[HybridTextSearch] Supabase config missing');
    return null;
  }

  supabaseInstance = createClient(config.url, config.serviceRoleKey);
  return supabaseInstance;
}

// ============================================================================
// Hybrid Search Function
// ============================================================================

/**
 * Perform hybrid search combining Vector + BM25 Text + Graph traversal
 *
 * Uses the `hybrid_search_with_text` PostgreSQL RPC function that:
 * 1. Runs vector similarity search (Mistral 1024d embeddings)
 * 2. Runs BM25 text search (PostgreSQL tsvector/ts_rank)
 * 3. Expands results via knowledge graph traversal
 * 4. Combines scores with configurable weights
 *
 * @param queryText - Original query text for BM25 search
 * @param queryEmbedding - Query embedding vector (1024 dimensions)
 * @param options - Search configuration options
 * @returns Array of search results sorted by combined score
 *
 * @example
 * ```typescript
 * const embedding = await embedText("CPU 사용률 높음");
 * const results = await hybridTextVectorSearch(
 *   "CPU 사용률 높음",
 *   embedding,
 *   { vectorWeight: 0.5, textWeight: 0.3, graphWeight: 0.2 }
 * );
 * ```
 */
export async function hybridTextVectorSearch(
  queryText: string,
  queryEmbedding: number[],
  options: HybridSearchOptions = {}
): Promise<HybridSearchResult[]> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    logger.warn('[HybridTextSearch] Supabase not available, returning empty');
    return [];
  }

  const {
    vectorWeight = 0.5,
    textWeight = 0.3,
    graphWeight = 0.2,
    maxVectorResults = 5,
    maxTextResults = 5,
    maxTotalResults = 15,
    threshold = 0.4,
    category,
    maxGraphHops = 2,
  } = options;

  try {
    const startTime = Date.now();

    // Call the PostgreSQL RPC function
    const { data, error } = await supabase.rpc('hybrid_search_with_text', {
      p_query_embedding: queryEmbedding,
      p_query_text: queryText,
      p_similarity_threshold: threshold,
      p_text_weight: textWeight,
      p_vector_weight: vectorWeight,
      p_graph_weight: graphWeight,
      p_max_vector_results: maxVectorResults,
      p_max_text_results: maxTextResults,
      p_max_graph_hops: maxGraphHops,
      p_max_total_results: maxTotalResults,
      p_filter_category: category || null,
    });

    if (error) {
      logger.error('[HybridTextSearch] RPC error:', error);
      throw error;
    }

    const results: HybridSearchResult[] = (data || []).map(
      (row: Record<string, unknown>) => ({
        id: String(row.id),
        title: String(row.title || ''),
        content: String(row.content || ''),
        category: String(row.category || ''),
        score: Number(row.score || 0),
        vectorScore: Number(row.vector_score || 0),
        textScore: Number(row.text_score || 0),
        graphScore: Number(row.graph_score || 0),
        sourceType: String(row.source_type) as 'hybrid' | 'graph',
        hopDistance: Number(row.hop_distance || 0),
      })
    );

    const elapsed = Date.now() - startTime;
    const hybridCount = results.filter((r) => r.sourceType === 'hybrid').length;
    const graphCount = results.filter((r) => r.sourceType === 'graph').length;

    logger.info(
      `[HybridTextSearch] Found ${results.length} results (${hybridCount} hybrid, ${graphCount} graph) in ${elapsed}ms`
    );

    return results;
  } catch (error) {
    logger.error('[HybridTextSearch] Search failed:', error);
    return [];
  }
}

/**
 * Text-only BM25 search (fallback/testing)
 *
 * Uses PostgreSQL full-text search without vector similarity.
 * Useful when embeddings are unavailable or for keyword-specific queries.
 *
 * @param queryText - Search query text
 * @param options - Search options (maxResults, category)
 * @returns Array of text search results
 */
export async function textOnlySearch(
  queryText: string,
  options: { maxResults?: number; category?: string } = {}
): Promise<
  Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    tags: string[];
    textRank: number;
  }>
> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    logger.warn('[HybridTextSearch] Supabase not available');
    return [];
  }

  const { maxResults = 10, category } = options;

  try {
    const { data, error } = await supabase.rpc('search_knowledge_text', {
      p_query_text: queryText,
      p_max_results: maxResults,
      p_filter_category: category || null,
    });

    if (error) {
      logger.error('[HybridTextSearch] Text search RPC error:', error);
      throw error;
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      title: String(row.title || ''),
      content: String(row.content || ''),
      category: String(row.category || ''),
      tags: (row.tags as string[]) || [],
      textRank: Number(row.text_rank || 0),
    }));
  } catch (error) {
    logger.error('[HybridTextSearch] Text-only search failed:', error);
    return [];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if BM25 text search is available
 *
 * Verifies that the hybrid_search_with_text RPC function exists
 * and the search_vector column is populated.
 */
export async function isBM25Available(): Promise<boolean> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return false;
  }

  try {
    // Check if any entries have search_vector populated
    const { count, error } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .not('search_vector', 'is', null);

    if (error) {
      logger.warn('[HybridTextSearch] BM25 availability check failed:', error);
      return false;
    }

    const available = (count || 0) > 0;
    logger.info(
      `[HybridTextSearch] BM25 available: ${available} (${count} indexed entries)`
    );
    return available;
  } catch {
    return false;
  }
}
