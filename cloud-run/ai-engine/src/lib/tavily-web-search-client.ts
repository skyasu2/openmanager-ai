/**
 * Tavily Web Search Client
 *
 * Integrates Tavily web search for the standalone searchWeb tool.
 * Knowledge Retrieval Lite no longer calls this module as an automatic
 * retrieval fallback.
 *
 * Architecture:
 * 1. Explicit web search request
 * 2. Tavily search with sequential key failover
 * 3. Result conversion for searchWeb consumers
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

// ============================================================================
// Core Tavily Search (SSOT — used by the searchWeb tool)
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

/**
 * Check if Tavily is available
 */
export function isTavilyAvailable(): boolean {
  return getTavilyApiKey() !== null || getTavilyApiKeyBackup() !== null;
}
