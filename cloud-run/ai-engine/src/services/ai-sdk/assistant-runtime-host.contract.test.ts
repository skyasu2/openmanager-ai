import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createInMemoryAssistantRuntimeAdapters,
  type AssistantDomain,
  type AssistantRequestContext,
} from '../../core/assistant-runtime';
import { monitoringDomainPack } from '../../domains/monitoring/domain-pack';
import { allTools } from '../../tools-ai-sdk';
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

  it('exposes domain prompt defaults and monitoring execution adapters through the host boundary', () => {
    const sampleHost = createAssistantRuntimeHost({
      domain: createSampleDomain(),
      adapters: createInMemoryAssistantRuntimeAdapters(),
    });
    const monitoringHost = createMonitoringAssistantRuntimeHost();

    expect(sampleHost.createSystemPrompt()).toBe('Sample support domain.');
    expect(sampleHost.createPrepareStep('help me')).toBeUndefined();
    expect(
      monitoringHost.createSystemPrompt({ deviceType: 'desktop' })
    ).toContain('서버 모니터링 AI 어시스턴트');
    expect(
      monitoringHost.createPrepareStep('CPU 상태', {
        enableWebSearch: false,
        enableRAG: false,
      })
    ).toBeTypeOf('function');
  });

  it('keeps monitoring domain tools free of direct AI SDK imports', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/domains/monitoring/tool-registry.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/from ['"]ai['"]/);
    expect(source).toContain('ToolDefinition');
  });

  it('keeps supervisor LLM execution behind the runtime host boundary', () => {
    const executionFiles = [
      'src/services/ai-sdk/supervisor-stream.ts',
      'src/services/ai-sdk/supervisor-single-agent.ts',
    ];

    for (const file of executionFiles) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');

      expect(source).not.toMatch(
        /import\s*\{[\s\S]*?\b(streamText|generateText)\b[\s\S]*?\}\s*from ['"]ai['"]/
      );
    }
  });

  it('delegates LLM stream and generate execution to the injected adapter', async () => {
    const executeLLMStream = vi.fn(() => ({
      textStream: (async function* () {
        yield 'adapter stream';
      })(),
    }));
    const executeLLMGenerate = vi.fn(async () => ({
      text: 'adapter generate',
      steps: [],
    }));
    const host = createAssistantRuntimeHost({
      domain: createSampleDomain(),
      adapters: createInMemoryAssistantRuntimeAdapters(),
      executionAdapter: {
        executeLLMStream,
        executeLLMGenerate,
      },
    });

    expect(host.executeLLMStream?.({ model: {}, messages: [] })).toMatchObject({
      textStream: expect.any(Object),
    });
    await expect(
      host.executeLLMGenerate?.({ model: {}, messages: [] })
    ).resolves.toMatchObject({
      text: 'adapter generate',
    });
    expect(executeLLMStream).toHaveBeenCalledTimes(1);
    expect(executeLLMGenerate).toHaveBeenCalledTimes(1);
  });

  it('keeps monitoring domain tool registry aligned with the production AI SDK toolset', () => {
    const context: AssistantRequestContext = {
      requestId: 'monitoring-tool-drift-guard',
      domainId: monitoringDomainPack.id,
      message: 'CPU 상태 알려줘',
      messages: [{ role: 'user', content: 'CPU 상태 알려줘' }],
      sessionId: 'monitoring-tool-drift-session',
    };
    const productionToolNames = new Set(Object.keys(allTools));
    const missingTools = monitoringDomainPack.tools
      .listTools(context)
      .map((tool) => tool.name)
      .filter((toolName) => !productionToolNames.has(toolName));

    expect(missingTools).toEqual([]);
  });
});
