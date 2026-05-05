import {
  createInMemoryAssistantRuntimeAdapters,
  type AssistantRuntimeAdapters,
} from '../../core/assistant-runtime';
import { monitoringDomainPack } from '../../domains/monitoring/domain-pack';
import {
  createAssistantRuntimeHost,
  resolveSupervisorRuntimeContext,
  type AssistantRuntimeAdapterKinds,
  type AssistantRuntimeHost,
  type AssistantRuntimeMetadata,
  type SupervisorRuntimeContext,
} from './assistant-runtime-host';
import type { SupervisorRequest } from './supervisor-types';

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
