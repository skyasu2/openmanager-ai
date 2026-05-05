import type { ToolSet } from 'ai';

import type { AssistantRequest } from '../../../../core/assistant-runtime';
import {
  getDefaultMonitoringAssistantRuntimeHost,
} from '../../monitoring-runtime-host';
import type { AssistantRuntimeHost } from '../../assistant-runtime-host';
import type { AgentToolName } from './agent-runtime-policy';

function createAgentToolRequest(
  host: AssistantRuntimeHost,
  toolAllowlist: readonly AgentToolName[]
): AssistantRequest {
  return {
    id: `${host.domain.id}:agent-tool-config`,
    domainId: host.domain.id,
    message: `agent tools: ${toolAllowlist.join(', ')}`,
    messages: [
      {
        role: 'user',
        content: 'agent tool configuration',
      },
    ],
  };
}

export function resolveAgentToolsFromRuntimeHost(
  host: AssistantRuntimeHost,
  toolAllowlist: readonly AgentToolName[]
): ToolSet {
  const domainTools = host.createToolSet(
    createAgentToolRequest(host, toolAllowlist)
  );
  const missingTools: AgentToolName[] = [];
  const resolvedTools: Array<[AgentToolName, ToolSet[string]]> = [];

  for (const toolName of toolAllowlist) {
    const tool = domainTools[toolName];

    if (!tool) {
      missingTools.push(toolName);
      continue;
    }

    resolvedTools.push([toolName, tool]);
  }

  if (missingTools.length > 0) {
    throw new Error(
      `Runtime host "${host.domain.id}" is missing agent tool(s): ${missingTools.join(', ')}`
    );
  }

  return Object.fromEntries(resolvedTools) as ToolSet;
}

export function resolveDefaultMonitoringAgentTools(
  toolAllowlist: readonly AgentToolName[]
): ToolSet {
  return resolveAgentToolsFromRuntimeHost(
    getDefaultMonitoringAssistantRuntimeHost(),
    toolAllowlist
  );
}
