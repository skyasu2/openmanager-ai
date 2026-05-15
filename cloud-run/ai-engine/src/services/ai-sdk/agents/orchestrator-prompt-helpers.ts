import { isMetricsQueryRuntimeName } from '../../../core/assistant-runtime/agent-name-compat';
import type { ModelCapabilityRequirements } from '../provider-capabilities';
import type { AgentConfig } from './config';

export function buildContextAwarePrompt(
  query: string,
  contextSummary?: string | null
): string {
  if (!contextSummary) {
    return query;
  }

  return `${query}\n\n[세션 컨텍스트 요약]\n${contextSummary}`;
}

export function getAgentInstructions(config: AgentConfig, query: string): string {
  return config.getInstructions?.(query) ?? config.instructions;
}

export function getForcedRoutingCapabilityRequirements(
  agentName: string
): ModelCapabilityRequirements {
  if (isMetricsQueryRuntimeName(agentName)) {
    return { requireToolCalling: true, minContextTokens: 16_000 };
  }

  if (
    agentName === 'Analyst Agent' ||
    agentName === 'Reporter Agent' ||
    agentName === 'Advisor Agent'
  ) {
    return { requireToolCalling: true, minContextTokens: 32_000 };
  }

  return { requireToolCalling: true };
}
