/**
 * Vision Agent
 *
 * Specializes in visual analysis:
 * - Dashboard screenshot analysis (Grafana, CloudWatch, Datadog)
 * - Uploaded image attachment analysis
 *
 * Model: Gemini Flash (Primary) + OpenRouter (Fallback)
 *
 * Primary: Gemini 2.5 Flash
 * - 1M token context
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

const IMAGE_KEYWORDS = [
  '스크린샷',
  'screenshot',
  '이미지',
  'image',
  '사진',
  '스냅샷',
  'snapshot',
  'visual',
  '캡처',
  'capture',
  'photo',
];

const DASHBOARD_KEYWORDS = [
  '대시보드',
  'dashboard',
  'grafana',
  'cloudwatch',
  'datadog',
  'kibana',
  'prometheus',
];

const VISUAL_CONTEXT_KEYWORDS = [
  '화면',
  '패널',
  '차트',
  '그래프',
  '메트릭',
];

const ATTACHMENT_KEYWORDS = ['첨부', '첨부된', '파일'];
const ATTACHMENT_VISUAL_KEYWORDS = [
  '이미지',
  'image',
  '사진',
  'screenshot',
  '스냅샷',
  'snapshot',
  '차트',
  '그래프',
  '대시보드',
  'dashboard',
  '화면',
  '패널',
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

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function hasAction(text: string): boolean {
  return includesAny(text, ACTION_KEYWORDS);
}

function hasAttachmentIntent(text: string): boolean {
  return (
    includesAny(text, ATTACHMENT_KEYWORDS) &&
    includesAny(text, ATTACHMENT_VISUAL_KEYWORDS) &&
    hasAction(text)
  );
}

function hasDashboardVisualIntent(text: string): boolean {
  return (
    includesAny(text, DASHBOARD_KEYWORDS) &&
    includesAny(text, VISUAL_CONTEXT_KEYWORDS) &&
    hasAction(text)
  );
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
  const hasDashboardSignal = hasDashboardVisualIntent(normalized);
  const hasAttachmentSignal = hasAttachmentIntent(normalized);

  return hasImageSignal || hasDashboardSignal || hasAttachmentSignal;
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
