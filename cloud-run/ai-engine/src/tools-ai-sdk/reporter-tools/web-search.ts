/**
 * Reporter Tools - Web Search (Tavily)
 *
 * AI SDK tool wrapper for Tavily web search.
 * Core search logic is in lib/tavily-hybrid-rag.ts (SSOT).
 * This file adds caching, quota management, and tool schema.
 *
 * @version 2.0.0
 * @updated 2026-02-18 — Consolidated: uses executeTavilySearchWithFailover from lib
 */

import { tool } from 'ai';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import { recordProviderUsage, getQuotaStatus } from '../../services/resilience/quota-tracker';
import {
  executeTavilySearchWithFailover,
  isTavilyAvailable,
  type WebSearchResult,
} from '../../lib/tavily-hybrid-rag';

// ============================================================================
// Cache
// ============================================================================

const SEARCH_CACHE_CONFIG = {
  maxSize: 30,
  evictCount: 10,
  ttlMs: 30 * 60 * 1000, // 30 min TTL
} as const;

interface CacheEntry {
  results: WebSearchResult[];
  answer: string | null;
  timestamp: number;
}
const searchCache = new Map<string, CacheEntry>();

function buildCacheKey(query: string, searchDepth?: string, includeDomains?: string[]): string {
  const parts = [query.toLowerCase().trim()];
  if (searchDepth && searchDepth !== 'basic') parts.push(`depth:${searchDepth}`);
  if (includeDomains && includeDomains.length > 0) parts.push(`domains:${includeDomains.sort().join(',')}`);
  return parts.join('|');
}

function getCachedResult(query: string, searchDepth?: string, includeDomains?: string[]): { results: WebSearchResult[]; answer: string | null } | null {
  const key = buildCacheKey(query, searchDepth, includeDomains);
  const cached = searchCache.get(key);
  const now = Date.now();

  if (!cached) return null;
  if (now - cached.timestamp > SEARCH_CACHE_CONFIG.ttlMs) {
    searchCache.delete(key);
    return null;
  }

  console.log(`📦 [Tavily] Cache hit for: "${query.substring(0, 30)}..." (size: ${searchCache.size})`);
  return { results: cached.results, answer: cached.answer };
}

function setCacheResult(query: string, results: WebSearchResult[], answer: string | null, searchDepth?: string, includeDomains?: string[]): void {
  const now = Date.now();

  for (const [key, entry] of searchCache) {
    if (now - entry.timestamp > SEARCH_CACHE_CONFIG.ttlMs) {
      searchCache.delete(key);
    }
  }

  if (searchCache.size >= SEARCH_CACHE_CONFIG.maxSize) {
    const keysToDelete = [...searchCache.keys()].slice(0, SEARCH_CACHE_CONFIG.evictCount);
    keysToDelete.forEach(k => searchCache.delete(k));
    console.log(`🗑️ [Tavily] Cache evicted ${keysToDelete.length} entries (LRU)`);
  }

  searchCache.set(buildCacheKey(query, searchDepth, includeDomains), { results, answer, timestamp: now });
}

// ============================================================================
// Web Search Tool
// ============================================================================

export const searchWeb = tool({
  description:
    '실시간 웹 검색을 수행합니다. 최신 기술 정보, 문서, 보안 이슈, 에러 해결 방법 등을 검색할 때 사용합니다. 서버 모니터링과 관련 없는 일반 질문에도 활용 가능합니다.',
  inputSchema: z.object({
    query: z.string().describe('검색 쿼리'),
    maxResults: z
      .number()
      .default(2)
      .describe('반환할 결과 수 (기본: 2, 최대: 5)'),
    searchDepth: z
      .enum(['basic', 'advanced'])
      .default('basic')
      .describe('검색 깊이 (basic: 빠른 검색, advanced: 심층 검색)'),
    includeDomains: z
      .array(z.string())
      .optional()
      .describe('특정 도메인만 검색 (예: ["docs.aws.com"])'),
    excludeDomains: z
      .array(z.string())
      .optional()
      .describe('제외할 도메인 (예: ["reddit.com"])'),
  }),
  execute: async ({
    query,
    maxResults = 2,
    searchDepth = 'basic',
    includeDomains,
    excludeDomains,
  }: {
    query: string;
    maxResults?: number;
    searchDepth?: 'basic' | 'advanced';
    includeDomains?: string[];
    excludeDomains?: string[];
  }) => {
    console.log(`🌐 [Reporter Tools] Web search: ${query}`);

    // 1. Quota check (Free Tier: 1,000 req/month ~ 33/day)
    try {
      const quotaStatus = await getQuotaStatus('tavily');
      if (quotaStatus.shouldPreemptiveFallback) {
        logger.warn(`⚠️ [Tavily] Daily quota approaching limit. Skipping web search.`);
        return {
          success: false,
          error: 'Tavily daily quota approaching limit',
          results: [],
          _source: 'Tavily (Quota Exceeded)',
        };
      }
    } catch {
      // quota check failure → continue search
    }

    // 2. Cache check
    const cached = getCachedResult(query, searchDepth, includeDomains);
    if (cached) {
      return {
        success: true,
        query,
        results: cached.results,
        totalFound: cached.results.length,
        _source: 'Tavily Web Search (Cached)',
        answer: cached.answer,
      };
    }

    // 3. API key check
    if (!isTavilyAvailable()) {
      logger.warn('⚠️ [Reporter Tools] No Tavily API keys configured');
      return {
        success: false,
        error: 'Tavily API key not configured',
        results: [],
        _source: 'Tavily (Unconfigured)',
      };
    }

    // 4. Execute search (with dual-key failover from lib)
    try {
      const { results: rawResults, answer } = await executeTavilySearchWithFailover(query, {
        maxResults,
        searchDepth,
        includeDomains: includeDomains || [],
        excludeDomains: excludeDomains || [],
      });

      // Truncate content for tool output
      const results = rawResults.map(r => ({
        ...r,
        content: r.content.substring(0, 1500),
      }));

      console.log(`📊 [Reporter Tools] Web search: ${results.length} results`);

      setCacheResult(query, results, answer, searchDepth, includeDomains);
      recordProviderUsage('tavily', 1).catch(() => {});

      return {
        success: true,
        query,
        results,
        totalFound: results.length,
        _source: 'Tavily Web Search',
        answer,
      };
    } catch (error) {
      const errorMsg = error instanceof AggregateError
        ? error.errors.map((e: unknown) => e instanceof Error ? e.message : String(e)).join('; ')
        : (error instanceof Error ? error.message : String(error));

      logger.error('❌ [Reporter Tools] Web search failed:', errorMsg);
      return {
        success: false,
        error: errorMsg,
        results: [],
        _source: 'Tavily (Failed)',
      };
    }
  },
});
