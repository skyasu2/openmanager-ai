/**
 * HyDE (Hypothetical Document Embeddings) Query Expansion Module
 *
 * Implements query expansion using HyDE technique for improved RAG retrieval.
 * HyDE generates a hypothetical answer to the query, then uses that answer's
 * embedding for retrieval, improving semantic matching.
 *
 * @version 1.0.0
 * @created 2026-01-26
 * @see https://arxiv.org/abs/2212.10496
 */

import { generateText } from 'ai';
import { logger } from './logger';
import { getMistralProvider } from './mistral-provider';

// ============================================================================
// Constants
// ============================================================================

const HYDE_SYSTEM_PROMPT = `You are a server monitoring expert.
Write a detailed answer as if you already know the answer.
Keep it concise (2-3 sentences in Korean).
Do not ask questions or request clarification - just provide the answer directly.`;

const HYDE_TIMEOUT_MS = 5000; // 5 seconds max for HyDE generation
const HYDE_MAX_TOKENS = 150;

// ============================================================================
// HyDE Configuration
// ============================================================================

interface HyDEConfig {
  enabled: boolean;
  minQueryLength: number;
  maxQueryLength: number;
}

const DEFAULT_HYDE_CONFIG: HyDEConfig = {
  enabled: true,
  minQueryLength: 1, // HyDE for short queries
  maxQueryLength: 30, // Skip HyDE for very long, specific queries
};


// ============================================================================
// HyDE Query Expansion
// ============================================================================

/**
 * Determine if HyDE should be applied to a query
 *
 * HyDE is most effective for:
 * - Short, ambiguous queries (< 30 chars)
 * - Queries without specific server names
 * - General troubleshooting questions
 *
 * HyDE is skipped for:
 * - Long, detailed queries (> 30 chars with server names)
 * - Queries with explicit context
 *
 * @param query - User query string
 * @param config - Optional HyDE configuration
 * @returns Whether to apply HyDE expansion
 */
export function shouldUseHyDE(
  query: string,
  config: Partial<HyDEConfig> = {}
): boolean {
  const { enabled, minQueryLength, maxQueryLength } = {
    ...DEFAULT_HYDE_CONFIG,
    ...config,
  };

  if (!enabled) {
    return false;
  }

  const trimmedQuery = query.trim();

  // Skip for very short queries (likely incomplete)
  if (trimmedQuery.length < minQueryLength) {
    return false;
  }

  // Apply HyDE for short/ambiguous queries
  if (trimmedQuery.length < maxQueryLength) {
    return true;
  }

  // Skip HyDE for queries with specific server names (already precise)
  const hasServerName = /서버|server|web-server-|db-server-|api-server-/i.test(trimmedQuery);
  if (hasServerName && trimmedQuery.length >= maxQueryLength) {
    return false;
  }

  // Default: don't use HyDE for long queries
  return trimmedQuery.length < maxQueryLength;
}

/**
 * Expand query using HyDE (Hypothetical Document Embeddings)
 *
 * Generates a hypothetical answer to the query, which is then used
 * for embedding-based retrieval. This improves semantic matching
 * by bridging the gap between question and document styles.
 *
 * @param query - Original user query
 * @returns Expanded hypothetical answer, or original query on failure
 *
 * @example
 * ```typescript
 * const expanded = await expandQueryWithHyDE("CPU 높음");
 * // Returns: "서버의 CPU 사용률이 높은 경우, 일반적으로 다음과 같은 원인이 있습니다..."
 * ```
 */
export async function expandQueryWithHyDE(query: string): Promise<string> {
  const mistral = getMistralProvider();

  if (!mistral) {
    logger.warn('[HyDE] Mistral provider unavailable, returning original query');
    return query;
  }

  try {
    const startTime = Date.now();

    // Use Promise.race for timeout
    const textPromise = generateText({
      model: mistral('mistral-small-latest'),
      system: HYDE_SYSTEM_PROMPT,
      prompt: query,
      maxOutputTokens: HYDE_MAX_TOKENS,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('HyDE timeout')), HYDE_TIMEOUT_MS);
    });

    const { text } = await Promise.race([textPromise, timeoutPromise]);
    const expandedText = text.trim();

    const elapsed = Date.now() - startTime;
    console.log(`[HyDE] Query expanded in ${elapsed}ms: "${query.substring(0, 30)}..." → "${expandedText.substring(0, 50)}..."`);

    // Validate expansion result
    if (!expandedText || expandedText.length < 10) {
      logger.warn('[HyDE] Expansion result too short, using original query');
      return query;
    }

    return expandedText;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`[HyDE] Expansion failed (${errorMsg}), using original query`);
    return query;
  }
}

/**
 * Expand query with HyDE if applicable, otherwise return original
 *
 * Convenience function that combines shouldUseHyDE check with expansion.
 *
 * @param query - Original user query
 * @param config - Optional HyDE configuration
 * @returns Expanded query or original query
 */
export async function maybeExpandQuery(
  query: string,
  config: Partial<HyDEConfig> = {}
): Promise<{ query: string; wasExpanded: boolean }> {
  if (!shouldUseHyDE(query, config)) {
    return { query, wasExpanded: false };
  }

  const expanded = await expandQueryWithHyDE(query);
  return {
    query: expanded,
    wasExpanded: expanded !== query,
  };
}
