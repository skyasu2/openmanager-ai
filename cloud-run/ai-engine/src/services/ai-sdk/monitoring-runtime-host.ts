import {
  createInMemoryAssistantRuntimeAdapters,
  type AssistantRuntimeAdapters,
} from '../../core/assistant-runtime';
import { generateText, streamText } from 'ai';
import {
  createMonitoringDomainInstructions,
  monitoringDomainPack,
} from '../../domains/monitoring/domain-pack';
import {
  createPrepareStep as createMonitoringPrepareStep,
} from '../../domains/monitoring/routing-policy';
import { allTools } from '../../tools-ai-sdk';
import {
  createAssistantRuntimeHost,
  resolveSupervisorRuntimeContext,
  type AssistantRuntimeAdapterKinds,
  type AssistantRuntimeHost,
  type AssistantRuntimeMetadata,
  type SupervisorRuntimeContext,
} from './assistant-runtime-host';
import { registerDomainHost } from './domain-registry';
import type { SupervisorRequest } from './supervisor-types';
import { MONITORING_DOMAIN_ID } from '../../domains/monitoring/constants';

const IN_MEMORY_ADAPTER_KINDS: AssistantRuntimeAdapterKinds = {
  stateStore: 'in-memory',
  sessionStore: 'in-memory',
  jobQueue: 'in-memory',
  artifactStore: 'in-memory',
  vectorStore: 'empty',
};

let defaultMonitoringRuntimeHost: AssistantRuntimeHost | undefined;

export interface MonitoringAssistantRuntimeHostConfig {
  adapters?: AssistantRuntimeAdapters;
  adapterKinds?: AssistantRuntimeAdapterKinds;
}

export type { AssistantRuntimeMetadata };

export function createMonitoringAssistantRuntimeHost(
  config: MonitoringAssistantRuntimeHostConfig = {}
): AssistantRuntimeHost {
  return createAssistantRuntimeHost({
    domain: monitoringDomainPack,
    adapters: config.adapters ?? createInMemoryAssistantRuntimeAdapters(),
    adapterKinds: config.adapterKinds ?? IN_MEMORY_ADAPTER_KINDS,
    executionAdapter: {
      createToolSet() {
        return allTools;
      },
      createSystemPrompt(options) {
        return createMonitoringDomainInstructions(options?.deviceType).system;
      },
      createPrepareStep(query, options) {
        return createMonitoringPrepareStep(query, options);
      },
      executeLLMStream(params) {
        return streamText(params as Parameters<typeof streamText>[0]);
      },
      executeLLMGenerate(params) {
        return generateText(params as Parameters<typeof generateText>[0]);
      },
    },
  });
}

export function getDefaultMonitoringAssistantRuntimeHost(): AssistantRuntimeHost {
  defaultMonitoringRuntimeHost ??= createMonitoringAssistantRuntimeHost();
  return defaultMonitoringRuntimeHost;
}

export function resolveMonitoringSupervisorRuntimeContext(
  request: SupervisorRequest
): Promise<SupervisorRuntimeContext> {
  return resolveSupervisorRuntimeContext(
    request,
    getDefaultMonitoringAssistantRuntimeHost()
  );
}

// Auto-register the monitoring domain as the system default.
// Importing this module is sufficient — no explicit registerDomainHost call needed.
registerDomainHost(MONITORING_DOMAIN_ID, getDefaultMonitoringAssistantRuntimeHost, true);
