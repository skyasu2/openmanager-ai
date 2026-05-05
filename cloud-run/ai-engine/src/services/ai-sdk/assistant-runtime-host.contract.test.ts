import { describe, expect, it } from 'vitest';
import {
  createInMemoryAssistantRuntimeAdapters,
  type AssistantDomain,
  type AssistantRequestContext,
} from '../../core/assistant-runtime';
import { monitoringDomainPack } from '../../domains/monitoring/domain-pack';
import {
  createAssistantRuntimeHost,
  resolveSupervisorRuntimeContext,
} from './assistant-runtime-host';
import { createMonitoringAssistantRuntimeHost } from './monitoring-runtime-host';
import type { SupervisorRequest } from './supervisor-types';

function createSupervisorRequest(
  message: string,
  overrides: Partial<SupervisorRequest> = {}
): SupervisorRequest {
  return {
    messages: [{ role: 'user', content: message }],
    sessionId: 'runtime-host-session',
    ...overrides,
  };
}

function createSampleDomain(): AssistantDomain {
  return {
    id: 'sample-support',
    version: '2026-05-05-test',
    instructions: {
      system: 'Sample support domain.',
    },
    routingPolicy: {
      decide(context: AssistantRequestContext) {
        return {
          kind: 'chat',
          executionPath: 'stream',
          executionMode: 'single-agent',
          domainId: context.domainId,
          reasonCodes: ['sample_domain_route'],
        };
      },
    },
    tools: {
      listTools() {
        return [];
      },
      resolveTool() {
        return undefined;
      },
    },
  };
}

describe('assistant runtime host contract', () => {
  it('binds the default supervisor runtime to the monitoring domain pack', async () => {
    const host = createMonitoringAssistantRuntimeHost();
    const context = await resolveSupervisorRuntimeContext(
      createSupervisorRequest('CPU 알려줘', { runtimeHost: host }),
      host
    );

    expect(host.domain).toBe(monitoringDomainPack);
    expect(context.result).toMatchObject({
      domainId: 'openmanager-monitoring',
      route: {
        kind: 'chat',
        executionPath: 'stream',
        executionMode: 'single-agent',
        domainId: 'openmanager-monitoring',
      },
    });
    expect(context.metadata).toMatchObject({
      domainId: 'openmanager-monitoring',
      domainVersion: '2026-05-05-v1',
      adapterKinds: {
        stateStore: 'in-memory',
        sessionStore: 'in-memory',
        jobQueue: 'in-memory',
      },
    });
  });

  it('accepts an injected domain runtime without core code changes', async () => {
    const host = createAssistantRuntimeHost({
      domain: createSampleDomain(),
      adapters: createInMemoryAssistantRuntimeAdapters(),
      adapterKinds: {
        stateStore: 'in-memory',
        sessionStore: 'in-memory',
        jobQueue: 'in-memory',
      },
    });

    const context = await resolveSupervisorRuntimeContext(
      createSupervisorRequest('help me', { runtimeHost: host }),
      host
    );

    expect(context.metadata).toMatchObject({
      domainId: 'sample-support',
      domainVersion: '2026-05-05-test',
      routeKind: 'chat',
      executionPath: 'stream',
      executionMode: 'single-agent',
      reasonCodes: ['sample_domain_route'],
    });
  });
});
