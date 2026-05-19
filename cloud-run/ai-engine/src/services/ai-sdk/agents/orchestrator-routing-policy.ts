import type { ToolSet } from 'ai';
import {
  getAgentConfig as getNamedAgentConfig,
  getAgentEvidenceBudget,
  getAgentProviderOrder,
  type AgentConfig,
} from './config';
import type { TextProvider } from './config/agent-model-selectors';
import { filterToolsByRAG, filterToolsByWebSearch } from './orchestrator-web-search';
import { FORCE_KB_QUERY_PATTERN } from '../routing/query-routing-signals';

export interface ForcedRoutingPolicyInput {
  query: string;
  suggestedAgentName: string;
  webSearchEnabled: boolean;
  ragEnabled: boolean;
}

export interface ForcedRoutingPolicy {
  agentConfig: AgentConfig;
  providerOrder: TextProvider[];
  evidenceBudget: number;
  filteredTools: ToolSet;
  isForceKnowledgeBaseQuery: boolean;
  forceKnowledgeBaseTool: boolean;
}

export function resolveForcedRoutingPolicy({
  query,
  suggestedAgentName,
  webSearchEnabled,
  ragEnabled,
}: ForcedRoutingPolicyInput): ForcedRoutingPolicy | null {
  const agentConfig = getNamedAgentConfig(suggestedAgentName);

  if (!agentConfig) {
    return null;
  }

  const providerOrder = getAgentProviderOrder(suggestedAgentName);
  const evidenceBudget = getAgentEvidenceBudget(suggestedAgentName);
  let filteredTools = filterToolsByWebSearch(
    agentConfig.tools,
    webSearchEnabled
  );
  filteredTools = filterToolsByRAG(filteredTools, ragEnabled);

  const isForceKnowledgeBaseQuery = FORCE_KB_QUERY_PATTERN.test(query);
  const forceKnowledgeBaseTool =
    ragEnabled &&
    suggestedAgentName === 'Advisor Agent' &&
    isForceKnowledgeBaseQuery &&
    'searchKnowledgeBase' in filteredTools;

  return {
    agentConfig,
    providerOrder,
    evidenceBudget,
    filteredTools,
    isForceKnowledgeBaseQuery,
    forceKnowledgeBaseTool,
  };
}
