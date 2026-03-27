/**
 * Tavily Hybrid RAG Module
 *
 * Integrates Tavily web search into the RAG pipeline for enhanced
 * knowledge retrieval. Combines internal KB with real-time web results.
 *
 * Architecture:
 * 1. Internal KB search (Vector + BM25 + Graph)
 * 2. Tavily web search (when KB results insufficient)
 * 3. Result merging and deduplication
 * 4. LLM reranking (optional)
 *
 * This module is the SSOT for Tavily search execution.
 * `web-search.ts` (AI SDK tool) imports from here.
 *
 * @version 2.0.0
 * @created 2026-01-26
 * @updated 2026-02-18 — Consolidated search logic, fixed timer leak, added failover
 */

import { getTavilyApiKey, getTavilyApiKeyBackup } from './config-parser';
import { logger } from './logger';
import { TIMEOUT_CONFIG } from '../config/timeout-config';
import { withTimeout } from './with-timeout';

// ============================================================================
// Types
// ============================================================================

export interface HybridRAGDocument {
  id: string;
  title: string;
  content: string;
  score: number;
  source: 'knowledge_base' | 'web';
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface HybridRAGOptions {
  /** Minimum KB results before triggering web search (default: 2) */
  minKBResults?: number;
  /** Minimum KB score before triggering web search (default: 0.6) */
  minKBScore?: number;
  /** Maximum web results to fetch (default: 3) */
  maxWebResults?: number;
  /** Web search depth (default: 'basic') */
  webSearchDepth?: 'basic' | 'advanced';
  /** Domains to include in web search */
  webIncludeDomains?: string[];
  /** Domains to exclude from web search */
  webExcludeDomains?: string[];
  /** Weight for KB results in final scoring (default: 0.7) */
  kbWeight?: number;
  /** Weight for web results in final scoring (default: 0.3) */
  webWeight?: number;
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilySearchResponse {
  results: WebSearchResult[];
  answer: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const TAVILY_TIMEOUT_MS = TIMEOUT_CONFIG.external.tavily; // 15s (timeout-config.ts SSOT)
const TAVILY_MAX_RETRIES = 2;
const TAVILY_RETRY_DELAY_MS = 500;
const DEFAULT_MIN_KB_RESULTS = 2;
const DEFAULT_MIN_KB_SCORE = 0.6;
const DEFAULT_MAX_WEB_RESULTS = 3;

// Server monitoring focused domains
const DEFAULT_INCLUDE_DOMAINS = [
  'docs.aws.com',
  'cloud.google.com',
  'learn.microsoft.com',
  'kubernetes.io',
  'docs.docker.com',
  'prometheus.io',
  'grafana.com',
  'nginx.org',
  'redis.io',
  'postgresql.org',
];

// ============================================================================
// Core Tavily Search (SSOT — used by both hybrid-rag and web-search tool)
// ============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute Tavily search with a single API key (internal)
 * Includes timeout protection and retry logic for transient errors
 */
async function executeSingleKeySearch(
  apiKey: string,
  query: string,
  options: {
    maxResults: number;
    searchDepth: 'basic' | 'advanced';
    includeDomains: string[];
    excludeDomains: string[];
  },
  retryCount = 0
): Promise<TavilySearchResponse> {
  try {
    const { tavily } = await import('@tavily/core');
    const client = tavily({ apiKey });

    const response = await withTimeout(
      client.search(query, {
        maxResults: options.maxResults,
        searchDepth: options.searchDepth,
        includeDomains: options.includeDomains.length > 0 ? options.includeDomains : undefined,
        excludeDomains: options.excludeDomains.length > 0 ? options.excludeDomains : undefined,
      }),
      TAVILY_TIMEOUT_MS,
      `Tavily search timeout after ${TAVILY_TIMEOUT_MS}ms`
    );

    return {
      results: response.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
      })),
      answer: response.answer || null,
    };
  } catch (error) {
    if (retryCount < TAVILY_MAX_RETRIES) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('timeout') || errorMsg.includes('ECONNRESET')) {
        logger.info(`[Tavily] Retry ${retryCount + 1}/${TAVILY_MAX_RETRIES}: ${errorMsg}`);
        await sleep(TAVILY_RETRY_DELAY_MS);
        return executeSingleKeySearch(apiKey, query, options, retryCount + 1);
      }
    }
    throw error;
  }
}

/**
 * Execute Tavily search with dual-key sequential failover
 *
 * When both primary and backup keys are available, tries primary first.
 * Only falls back to backup key if primary fails. This avoids double
 * API credit consumption that occurred with the previous Promise.any() approach.
 *
 * @throws Error if no API keys configured or all attempts fail
 */
export async function executeTavilySearchWithFailover(
  query: string,
  options: {
    maxResults: number;
    searchDepth: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
  }
): Promise<TavilySearchResponse> {
  const primaryKey = getTavilyApiKey();
  const backupKey = getTavilyApiKeyBackup();

  if (!primaryKey && !backupKey) {
    throw new Error('No Tavily API keys configured');
  }

  const searchOpts = {
    maxResults: options.maxResults,
    searchDepth: options.searchDepth,
    includeDomains: options.includeDomains || [],
    excludeDomains: options.excludeDomains || [],
  };

  if (primaryKey) {
    try {
      return await executeSingleKeySearch(primaryKey, query, searchOpts);
    } catch (primaryError) {
      if (backupKey) {
        logger.warn('[Tavily] Primary key failed, trying backup:', primaryError);
        return executeSingleKeySearch(backupKey, query, searchOpts);
      }
      throw primaryError;
    }
  }

  return executeSingleKeySearch(backupKey!, query, searchOpts);
}

// ============================================================================
// Hybrid RAG Functions
// ============================================================================

/**
 * Determine if web search should be triggered
 */
export function shouldTriggerWebSearch(
  kbResults: Array<{ score: number }>,
  options: HybridRAGOptions = {}
): boolean {
  const {
    minKBResults = DEFAULT_MIN_KB_RESULTS,
    minKBScore = DEFAULT_MIN_KB_SCORE,
  } = options;

  if (kbResults.length < minKBResults) {
    logger.info(`[TavilyHybrid] Triggering web search: KB results (${kbResults.length}) < min (${minKBResults})`);
    return true;
  }

  const avgScore = kbResults.reduce((sum, r) => sum + r.score, 0) / kbResults.length;
  if (avgScore < minKBScore) {
    logger.info(`[TavilyHybrid] Triggering web search: avg KB score (${avgScore.toFixed(2)}) < min (${minKBScore})`);
    return true;
  }

  return false;
}

/**
 * Enhance RAG results with Tavily web search
 */
export async function enhanceWithWebSearch(
  query: string,
  kbResults: HybridRAGDocument[],
  options: HybridRAGOptions = {}
): Promise<{
  results: HybridRAGDocument[];
  webSearchTriggered: boolean;
  webResultsCount: number;
}> {
  const {
    maxWebResults = DEFAULT_MAX_WEB_RESULTS,
    webSearchDepth = 'basic',
    webIncludeDomains = DEFAULT_INCLUDE_DOMAINS,
    webExcludeDomains = [],
    kbWeight = 0.7,
    webWeight = 0.3,
  } = options;

  if (!shouldTriggerWebSearch(kbResults.map(r => ({ score: r.score })), options)) {
    return { results: kbResults, webSearchTriggered: false, webResultsCount: 0 };
  }

  // Execute web search with failover
  let webResults: WebSearchResult[];
  try {
    const response = await executeTavilySearchWithFailover(query, {
      maxResults: maxWebResults,
      searchDepth: webSearchDepth,
      includeDomains: webIncludeDomains,
      excludeDomains: webExcludeDomains,
    });
    // Truncate content for RAG context (shorter than direct tool output)
    webResults = response.results.map(r => ({
      ...r,
      content: r.content.substring(0, 500),
    }));
  } catch (error) {
    logger.warn('[TavilyHybrid] Web search failed, returning KB results only:', error);
    return { results: kbResults, webSearchTriggered: true, webResultsCount: 0 };
  }

  if (webResults.length === 0) {
    return { results: kbResults, webSearchTriggered: true, webResultsCount: 0 };
  }

  // Convert web results to HybridRAGDocument format
  const webDocuments: HybridRAGDocument[] = webResults.map((r, idx) => ({
    id: `web-${idx}-${Date.now()}`,
    title: r.title,
    content: r.content,
    score: r.score * webWeight,
    source: 'web' as const,
    url: r.url,
  }));

  // Apply weight to KB results
  const weightedKBResults = kbResults.map((r) => ({
    ...r,
    score: r.score * kbWeight,
  }));

  // Merge and deduplicate (by title similarity)
  const merged = [...weightedKBResults];
  const existingTitles = new Set(kbResults.map((r) => r.title.toLowerCase()));

  for (const webDoc of webDocuments) {
    const titleLower = webDoc.title.toLowerCase();
    const hasSimilar = [...existingTitles].some((t) =>
      t.includes(titleLower.slice(0, 20)) || titleLower.includes(t.slice(0, 20))
    );

    if (!hasSimilar) {
      merged.push(webDoc);
    }
  }

  merged.sort((a, b) => b.score - a.score);

  logger.info(
    `[TavilyHybrid] Merged ${kbResults.length} KB + ${webResults.length} web → ${merged.length} results`
  );

  return { results: merged, webSearchTriggered: true, webResultsCount: webResults.length };
}

/**
 * Check if Tavily is available
 */
export function isTavilyAvailable(): boolean {
  return getTavilyApiKey() !== null || getTavilyApiKeyBackup() !== null;
}
