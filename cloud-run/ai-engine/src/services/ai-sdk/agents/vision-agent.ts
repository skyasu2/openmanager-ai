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
 * Fallback: OpenRouter (Qwen 2.5 VL / Llama 3.2 Vision)
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
import { VisionAgent, AgentFactory } from './agent-factory';
import { logger } from '../../../lib/logger';

// ============================================================================
// Agent Class Export
// ============================================================================

export { VisionAgent };

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
    logger.warn('⚠️ [Vision Agent] Config not found in AGENT_CONFIGS');
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
export function createVisionAgent(): VisionAgent | null {
  return AgentFactory.create('vision') as VisionAgent | null;
}

// ============================================================================
// Vision Query Detection
// ============================================================================

/**
 * Keywords that indicate a query requires Vision Agent
 */
const VISION_KEYWORDS = [
  // Screenshot/Image keywords
  '스크린샷', 'screenshot', '이미지', 'image', '사진', '그래프', '차트',
  // Dashboard keywords
  '대시보드', 'dashboard', 'grafana', 'cloudwatch', 'datadog',
  // Large log keywords
  '로그 분석', '대용량', '전체 로그',
  // Google Search Grounding
  '최신', '공식 문서', 'documentation', 'official',
  // URL context
  'url', '링크', '페이지',
];

/**
 * Patterns that indicate Vision Agent is needed
 */
const VISION_PATTERNS = [
  /스크린샷.*분석|분석.*스크린샷/i,
  /이미지.*보여|첨부.*분석/i,
  /로그.*전체|대용량.*로그/i,
  /최신.*문서|공식.*가이드/i,
  /대시보드.*보여|화면.*분석/i,
];

/**
 * Check if a query requires Vision Agent
 *
 * @param query - User query to check
 * @returns true if Vision Agent should handle this query
 */
export function isVisionQuery(query: string): boolean {
  const q = query.toLowerCase();

  // Check keywords
  const hasVisionKeyword = VISION_KEYWORDS.some(kw => q.includes(kw.toLowerCase()));
  if (hasVisionKeyword) return true;

  // Check patterns
  const matchesVisionPattern = VISION_PATTERNS.some(pattern => pattern.test(query));
  if (matchesVisionPattern) return true;

  return false;
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
    logger.warn('⚠️ [Vision Agent] Vision features requested but no vision provider available, falling back to Analyst Agent');
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
