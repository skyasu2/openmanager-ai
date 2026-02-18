/**
 * LLM-based Reranker Module
 *
 * Uses Mistral AI to rerank search results based on query relevance.
 * This provides cross-encoder-like quality without additional API costs.
 *
 * Architecture:
 * 1. Initial retrieval (Vector + BM25 + Graph)
 * 2. LLM reranking (this module)
 * 3. Top-K selection
 *
 * @version 1.0.0
 * @created 2026-01-26
 */

import { generateText } from 'ai';
import { logger } from './logger';
import { getMistralProvider } from './mistral-provider';
import { withTimeout } from './with-timeout';

// ============================================================================
// Types
// ============================================================================

export interface RerankDocument {
  id: string;
  title: string;
  content: string;
  originalScore: number;
  metadata?: Record<string, unknown>;
}

export interface RerankResult {
  id: string;
  title: string;
  content: string;
  originalScore: number;
  rerankScore: number;
  relevanceReason?: string;
  metadata?: Record<string, unknown>;
}

export interface RerankOptions {
  /** Maximum documents to rerank (default: 10) */
  maxDocuments?: number;
  /** Top-K results to return after reranking (default: 5) */
  topK?: number;
  /** Minimum relevance score threshold (0-1, default: 0.3) */
  minScore?: number;
  /** Include relevance reasoning (default: false, increases latency) */
  includeReason?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const RERANK_SYSTEM_PROMPT = `You are a relevance scoring expert for server monitoring queries.
Score how relevant each document is to the query on a scale of 0 to 1.
Consider: topic match, specific terms, actionable information.

Output ONLY a JSON array with scores, no other text:
[{"index": 0, "score": 0.9}, {"index": 1, "score": 0.3}, ...]`;

const RERANK_SYSTEM_PROMPT_WITH_REASON = `You are a relevance scoring expert for server monitoring queries.
Score how relevant each document is to the query on a scale of 0 to 1.
Consider: topic match, specific terms, actionable information.

Output ONLY a JSON array with scores and brief reasons, no other text:
[{"index": 0, "score": 0.9, "reason": "직접적인 CPU 문제 해결 가이드"}, ...]`;

const RERANK_TIMEOUT_MS = 8000; // 8 seconds
const DEFAULT_MAX_DOCUMENTS = 10;
const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SCORE = 0.3;


// ============================================================================
// Reranking Functions
// ============================================================================

/**
 * Rerank documents using Mistral LLM
 *
 * @param query - User query for relevance scoring
 * @param documents - Documents to rerank
 * @param options - Reranking options
 * @returns Reranked and filtered documents
 *
 * @example
 * ```typescript
 * const results = await rerankDocuments(
 *   "CPU 사용률 높음 해결",
 *   searchResults,
 *   { topK: 5, minScore: 0.5 }
 * );
 * ```
 */
export async function rerankDocuments(
  query: string,
  documents: RerankDocument[],
  options: RerankOptions = {}
): Promise<RerankResult[]> {
  const {
    maxDocuments = DEFAULT_MAX_DOCUMENTS,
    topK = DEFAULT_TOP_K,
    minScore = DEFAULT_MIN_SCORE,
    includeReason = false,
  } = options;

  // Skip reranking for small result sets
  if (documents.length <= 2) {
    console.log('[Reranker] Skipping rerank for small result set');
    return documents.map((doc) => ({
      ...doc,
      rerankScore: doc.originalScore,
    }));
  }

  const mistral = getMistralProvider();
  if (!mistral) {
    logger.warn('[Reranker] Mistral unavailable, returning original order');
    return documents.map((doc) => ({
      ...doc,
      rerankScore: doc.originalScore,
    }));
  }

  // Limit documents for cost efficiency
  const docsToRerank = documents.slice(0, maxDocuments);

  try {
    const startTime = Date.now();

    // Build prompt with document summaries
    const docSummaries = docsToRerank
      .map((doc, idx) => {
        const contentPreview = doc.content.substring(0, 200).replace(/\n/g, ' ');
        return `[${idx}] ${doc.title}: ${contentPreview}...`;
      })
      .join('\n');

    const prompt = `Query: "${query}"

Documents:
${docSummaries}

Rate relevance (0-1) for each document.`;

    // Call Mistral for scoring with timeout
    const { text } = await withTimeout(
      generateText({
        model: mistral('mistral-small-latest'),
        system: includeReason ? RERANK_SYSTEM_PROMPT_WITH_REASON : RERANK_SYSTEM_PROMPT,
        prompt,
        maxOutputTokens: 500,
        temperature: 0.1, // Low temperature for consistent scoring
      }),
      RERANK_TIMEOUT_MS,
      'Rerank timeout'
    );

    // Parse scores from response
    const scores = parseRerankScores(text, docsToRerank.length);

    // Apply scores to documents
    const rerankedDocs: RerankResult[] = docsToRerank.map((doc, idx) => {
      const scoreInfo = scores.find((s) => s.index === idx);
      return {
        ...doc,
        rerankScore: scoreInfo?.score ?? doc.originalScore * 0.5,
        relevanceReason: scoreInfo?.reason,
      };
    });

    // Sort by rerank score and filter by minimum
    const filteredDocs = rerankedDocs
      .filter((doc) => doc.rerankScore >= minScore)
      .sort((a, b) => b.rerankScore - a.rerankScore)
      .slice(0, topK);

    const elapsed = Date.now() - startTime;
    console.log(
      `[Reranker] Reranked ${docsToRerank.length} docs → ${filteredDocs.length} results in ${elapsed}ms`
    );

    return filteredDocs;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`[Reranker] Reranking failed (${errorMsg}), using original scores`);

    // Fallback: return original order with original scores
    return documents
      .slice(0, topK)
      .map((doc) => ({
        ...doc,
        rerankScore: doc.originalScore,
      }));
  }
}

/**
 * Parse rerank scores from LLM response
 */
function parseRerankScores(
  response: string,
  docCount: number
): Array<{ index: number; score: number; reason?: string }> {
  try {
    // Extract JSON array from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn('[Reranker] No JSON array found in response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      score: number;
      reason?: string;
    }>;

    // Validate and normalize scores
    return parsed
      .filter((item) => typeof item.index === 'number' && typeof item.score === 'number')
      .map((item) => ({
        index: Math.min(Math.max(0, item.index), docCount - 1),
        score: Math.min(Math.max(0, item.score), 1), // Clamp to 0-1
        reason: item.reason,
      }));
  } catch (error) {
    logger.warn('[Reranker] Failed to parse scores:', error);
    return [];
  }
}

/**
 * Quick relevance check for a single document
 *
 * Useful for filtering before full reranking.
 *
 * @param query - User query
 * @param document - Document to check
 * @returns Relevance score (0-1)
 */
export async function quickRelevanceScore(
  query: string,
  document: { title: string; content: string }
): Promise<number> {
  const mistral = getMistralProvider();
  if (!mistral) {
    return 0.5; // Neutral score if unavailable
  }

  try {
    const prompt = `Query: "${query}"
Document: ${document.title} - ${document.content.substring(0, 300)}

Rate relevance 0-1. Output ONLY a number.`;

    const { text } = await generateText({
      model: mistral('mistral-small-latest'),
      prompt,
      maxOutputTokens: 10,
      temperature: 0.1,
    });

    const score = parseFloat(text.trim());
    return isNaN(score) ? 0.5 : Math.min(Math.max(0, score), 1);
  } catch {
    return 0.5;
  }
}

/**
 * Check if reranking is available
 */
export function isRerankerAvailable(): boolean {
  return getMistralProvider() !== null;
}
