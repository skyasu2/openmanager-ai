import type { ToolSet } from 'ai';
import { isOpenRouterVisionToolCallingEnabled } from '../../../lib/config-parser';
import { logger } from '../../../lib/logger';
import type { AgentRunOptions } from './base-agent-types';
import {
  GENERIC_EMPTY_RESPONSE_FALLBACK,
  OPENROUTER_VISION_MIN_OUTPUT_TOKENS,
  VISION_AGENT_NAME,
  VISION_EMPTY_RESPONSE_FALLBACK,
  DEFAULT_OPTIONS,
} from './base-agent-types';

export function isVisionOpenRouter(provider: string, agentName: string): boolean {
  return agentName === VISION_AGENT_NAME && provider === 'openrouter';
}

export function filterTools(
  tools: ToolSet,
  options: AgentRunOptions,
  provider: string,
  agentName: string
): ToolSet {
  const filtered = { ...tools };

  if (options.webSearchEnabled === false && 'searchWeb' in filtered) {
    delete filtered.searchWeb;
    logger.debug(`[${agentName}] searchWeb disabled`);
  }

  if (options.ragEnabled === false && 'searchKnowledgeBase' in filtered) {
    delete filtered.searchKnowledgeBase;
    logger.debug(`[${agentName}] searchKnowledgeBase disabled (RAG off)`);
  }

  if (
    agentName === VISION_AGENT_NAME &&
    provider === 'openrouter' &&
    !isOpenRouterVisionToolCallingEnabled()
  ) {
    const toolCount = Object.keys(filtered).length;
    if (toolCount > 0) {
      logger.warn(
        `⚠️ [Vision Agent] OpenRouter free-tier compatibility mode: disabling ${toolCount} tools (set OPENROUTER_VISION_TOOL_CALLING=true to override)`
      );
    }
    return {};
  }

  return filtered;
}

export function resolveMaxOutputTokens(
  options: AgentRunOptions,
  provider: string,
  agentName: string
): number {
  const requested = options.maxOutputTokens ?? DEFAULT_OPTIONS.maxOutputTokens;

  if (isVisionOpenRouter(provider, agentName) && requested < OPENROUTER_VISION_MIN_OUTPUT_TOKENS) {
    logger.warn(
      `⚠️ [Vision Agent] OpenRouter maxOutputTokens too low (${requested}), overriding to ${OPENROUTER_VISION_MIN_OUTPUT_TOKENS}`
    );
    return OPENROUTER_VISION_MIN_OUTPUT_TOKENS;
  }

  return requested;
}

export function getEmptyResponseFallbackMessage(
  provider: string,
  modelId: string,
  agentName: string
): string {
  if (isVisionOpenRouter(provider, agentName)) {
    return VISION_EMPTY_RESPONSE_FALLBACK;
  }

  logger.warn(
    `⚠️ [${agentName}] Empty response from ${provider}/${modelId}, using generic fallback message`
  );
  return GENERIC_EMPTY_RESPONSE_FALLBACK;
}
