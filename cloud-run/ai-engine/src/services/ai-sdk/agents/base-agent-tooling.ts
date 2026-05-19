import type { ToolSet } from 'ai';
import { logger } from '../../../lib/logger';
import type { AgentRunOptions } from './base-agent-types';
import {
  GENERIC_EMPTY_RESPONSE_FALLBACK,
  DEFAULT_OPTIONS,
} from './base-agent-types';

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

  return filtered;
}

export function resolveMaxOutputTokens(
  options: AgentRunOptions,
  provider: string,
  agentName: string
): number {
  const requested = options.maxOutputTokens ?? DEFAULT_OPTIONS.maxOutputTokens;

  return requested;
}

export function getEmptyResponseFallbackMessage(
  provider: string,
  modelId: string,
  agentName: string
): string {
  logger.warn(
    `⚠️ [${agentName}] Empty response from ${provider}/${modelId}, using generic fallback message`
  );
  return GENERIC_EMPTY_RESPONSE_FALLBACK;
}
