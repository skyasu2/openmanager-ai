/**
 * Vision Agent
 *
 * Specializes in visual analysis and large context processing:
 * - Dashboard screenshot analysis (Grafana, CloudWatch, Datadog)
 * - Large log file analysis (1M token context window)
 * - Google Search Grounding for up-to-date documentation
 * - URL content analysis
 *
 * Model: Gemini Flash (Primary) + OpenRouter (Fallback)
 *
 * Primary: Gemini 2.5 Flash
 * - 1M token context, Search Grounding
 *
 * Fallback: OpenRouter (nvidia/nemotron-nano-12b-v2-vl:free)
 * - Used when Gemini quota exceeded (250 RPD)
 * - Basic vision capabilities maintained
 *
 * Graceful Degradation: When both unavailable, Vision features are disabled
 * and queries are routed to Analyst Agent as fallback.
 *
 * @version 1.0.0
 * @created 2026-01-27
 */

import { AGENT_CONFIGS, type AgentConfig } from './config';
import { AgentFactory, type BaseAgent } from './agent-factory';
import { logger } from '../../../lib/logger';

const URL_PATTERN =
  /(https?:\/\/[^\s]+|www\.[^\s]+\.[a-z]{2,}|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}[^\s]*)/i;

const IMAGE_KEYWORDS = [
  '스크린샷',
  'screenshot',
  '이미지',
  'image',
  '사진',
  '차트',
  '그래프',
  '스냅샷',
  'visual',
  's3://',
  '첨부',
  '파일',
];

const DASHBOARD_KEYWORDS = [
  '대시보드',
  'dashboard',
  'grafana',
  'cloudwatch',
  'datadog',
  'kibana',
  'prometheus',
  '애플리케이션',
  'application',
];

const LOG_KEYWORDS = [
  '로그',
  'log',
  '로그파일',
  '에러',
  '오류',
  'stack',
  'trace',
];

const VISUAL_CONTEXT_KEYWORDS = [
  '화면',
  '스크린',
  '패널',
  '차트',
  '그래프',
  '메트릭',
  '알람',
  '이슈',
  '문제',
  '변화',
  '이상',
  '에러',
];

const DOC_KEYWORDS = [
  '최신',
  '문서',
  'documentation',
  '공식',
  'official',
  'docs',
  '가이드',
  '링크',
  'url',
];

const ACTION_KEYWORDS = [
  '분석',
  '요약',
  '확인',
  '해석',
  '보여',
  '확인해',
  '봐줘',
  '찾아',
  '검색',
  '조회',
  '읽',
  '열어',
  '열',
  '점검',
  '판독',
];

const URL_ACTION_KEYWORDS = [
  '확인',
  '분석',
  '요약',
  '내용',
  '읽',
  '열람',
  '조회',
  '검색',
];

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function hasAction(text: string): boolean {
  return includesAny(text, ACTION_KEYWORDS);
}

function hasUrlAction(text: string): boolean {
  return includesAny(text, URL_ACTION_KEYWORDS);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get Vision Agent configuration
 * Use with orchestrator's executeForcedRouting or executeAgentStream
 *
 * @deprecated Use AgentFactory.create('vision') instead
 */
export function getVisionAgentConfig(): AgentConfig | null {
  const config = AGENT_CONFIGS['Vision Agent'];
  if (!config) {
    logger.warn('[Vision Agent] Config not found in AGENT_CONFIGS');
    return null;
  }
  return config;
}

/**
 * Check if Vision Agent is available
 *
 * Vision Agent requires at least one vision provider to be configured.
 * Fallback chain: Gemini (primary) -> OpenRouter.
 *
 * @deprecated Use AgentFactory.isAvailable('vision') instead
 */
export function isVisionAgentAvailable(): boolean {
  return AgentFactory.isAvailable('vision');
}

/**
 * Create a new Vision Agent instance
 *
 * Returns null if no vision provider is configured (graceful degradation).
 *
 * @example
 * ```typescript
 * const agent = createVisionAgent();
 * if (agent) {
 *   const result = await agent.run('이 대시보드 스크린샷 분석해줘');
 *   console.log(result.text);
 * } else {
 *   console.log('Vision Agent unavailable - no vision provider configured');
 * }
 * ```
 */
export function createVisionAgent(): BaseAgent | null {
  return AgentFactory.create('vision');
}

// ============================================================================
// Vision Query Detection
// ============================================================================

/**
 * Check if a query requires Vision Agent.
 * Derives keywords/patterns from AGENT_CONFIGS (single source of truth).
 *
 * @param query - User query to check
 * @returns true if Vision Agent should handle this query
 */
export function isVisionQuery(query: string): boolean {
  const config = AGENT_CONFIGS['Vision Agent'];
  if (!config) return false;

  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;

  const hasImageSignal = includesAny(normalized, IMAGE_KEYWORDS) && hasAction(normalized);
  const hasDashboardSignal =
    includesAny(normalized, DASHBOARD_KEYWORDS) &&
    (includesAny(normalized, VISUAL_CONTEXT_KEYWORDS) || hasAction(normalized));
  const hasLogSignal =
    includesAny(normalized, LOG_KEYWORDS) &&
    (includesAny(normalized, VISUAL_CONTEXT_KEYWORDS) ||
      includesAny(normalized, ['전체', '대용량', '요약', '분석', '이상', '에러']) ||
      hasAction(normalized));
  const hasDocSignal = includesAny(normalized, DOC_KEYWORDS) && hasAction(normalized);
  const hasUrlSignal =
    (URL_PATTERN.test(normalized) || includesAny(normalized, ['url', '링크'])) &&
    (includesAny(normalized, ['screenshot', '이미지', '이미지로', 'url', '링크']) ||
      hasUrlAction(normalized));

  return (
    hasImageSignal ||
    hasDashboardSignal ||
    hasLogSignal ||
    hasDocSignal ||
    hasUrlSignal
  );
}

/**
 * Get Vision Agent or fallback agent for a query
 *
 * If Vision Agent is unavailable but query requires visual analysis,
 * returns Analyst Agent as fallback (best effort without vision capabilities).
 *
 * @param query - User query
 * @returns Object with agent and whether it's a fallback
 */
export function getVisionAgentOrFallback(query: string): {
  agent: ReturnType<typeof AgentFactory.create>;
  isFallback: boolean;
  fallbackReason?: string;
} {
  // Check if Vision is available
  if (isVisionAgentAvailable()) {
    return {
      agent: createVisionAgent(),
      isFallback: false,
    };
  }

  // Vision unavailable - check if query needs vision
  if (isVisionQuery(query)) {
    logger.warn('[Vision Agent] Vision features requested but no vision provider available, falling back to Analyst Agent');
    return {
      agent: AgentFactory.create('analyst'),
      isFallback: true,
      fallbackReason: 'Vision providers unavailable (Gemini/OpenRouter) - using Analyst Agent as fallback (limited visual analysis)',
    };
  }

  // Query doesn't need vision - return null to let orchestrator handle
  return {
    agent: null,
    isFallback: false,
  };
}
