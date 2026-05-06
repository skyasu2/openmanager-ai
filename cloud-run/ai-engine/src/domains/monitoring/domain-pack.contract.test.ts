import { describe, expect, it } from 'vitest';
import {
  createAssistantRuntime,
  createInMemoryAssistantRuntimeAdapters,
  type AssistantRequest,
} from '../../core/assistant-runtime';
import {
  createMonitoringDomainInstructions,
  monitoringDomainPack,
} from './domain-pack';
import { createMonitoringSystemPrompt } from './supervisor-prompt';
import { AGENT_CONFIGS } from '../../services/ai-sdk/agents/config';

const EXPECTED_MONITORING_AGENT_ROLES = [
  { id: 'nlq', name: 'NLQ Agent', runtimeConfigKey: 'NLQ Agent' },
  { id: 'analyst', name: 'Analyst Agent', runtimeConfigKey: 'Analyst Agent' },
  { id: 'reporter', name: 'Reporter Agent', runtimeConfigKey: 'Reporter Agent' },
  { id: 'advisor', name: 'Advisor Agent', runtimeConfigKey: 'Advisor Agent' },
  { id: 'vision', name: 'Vision Agent', runtimeConfigKey: 'Vision Agent' },
  { id: 'evaluator', name: 'Evaluator Agent', runtimeConfigKey: 'Evaluator Agent' },
  { id: 'optimizer', name: 'Optimizer Agent', runtimeConfigKey: 'Optimizer Agent' },
];

function createRequest(message: string): AssistantRequest {
  return {
    id: 'monitoring-pack-contract-1',
    domainId: monitoringDomainPack.id,
    message,
    messages: [{ role: 'user', content: message }],
  };
}

describe('monitoring domain pack contract', () => {
  it('packages the existing monitoring prompt as domain instructions', () => {
    expect(monitoringDomainPack.id).toBe('openmanager-monitoring');
    expect(monitoringDomainPack.version).toBe('2026-05-05-v1');
    expect(monitoringDomainPack.instructions.system).toBe(
      createMonitoringSystemPrompt()
    );
    expect(createMonitoringDomainInstructions('mobile').system).toContain(
      '디바이스: 모바일'
    );
  });

  it('routes monitoring queries through the domain routing policy', async () => {
    const runtime = createAssistantRuntime({
      domain: monitoringDomainPack,
      adapters: createInMemoryAssistantRuntimeAdapters(),
    });

    await expect(runtime.handle(createRequest('CPU 알려줘'))).resolves.toMatchObject({
      domainId: 'openmanager-monitoring',
      route: {
        domainId: 'openmanager-monitoring',
        kind: 'chat',
        executionPath: 'stream',
        executionMode: 'single-agent',
      },
    });

    await expect(
      runtime.handle(createRequest('장애 보고서 생성해줘'))
    ).resolves.toMatchObject({
      route: {
        executionMode: 'multi-agent',
      },
    });
  });

  it('exposes monitoring tools through the domain tool registry', () => {
    const context = {
      requestId: 'monitoring-tools-1',
      domainId: monitoringDomainPack.id,
      message: 'CPU 알려줘',
      messages: [{ role: 'user' as const, content: 'CPU 알려줘' }],
    };

    expect(
      monitoringDomainPack.tools.listTools(context).map((tool) => tool.name)
    ).toContain('getServerMetrics');
    expect(
      monitoringDomainPack.tools.resolveTool('getServerMetrics', context)
    ).toMatchObject({
      name: 'getServerMetrics',
    });
    expect(
      monitoringDomainPack.tools.resolveTool('unknownTool', context)
    ).toBeUndefined();
  });

  it('owns the monitoring multi-agent role manifest without config drift', () => {
    const roles = monitoringDomainPack.agentRoles?.listRoles() ?? [];

    expect(
      roles.map(({ id, name, runtimeConfigKey }) => ({
        id,
        name,
        runtimeConfigKey,
      }))
    ).toEqual(EXPECTED_MONITORING_AGENT_ROLES);
    expect(new Set(roles.map((role) => role.id)).size).toBe(roles.length);
    expect(new Set(roles.map((role) => role.name)).size).toBe(roles.length);

    for (const role of roles) {
      expect(role.description.trim().length).toBeGreaterThan(20);
      expect(role.runtimeConfigKey).toBe(role.name);
      expect(role.runtimeConfigKey).toBeDefined();
      expect(role.runtimeConfigKey! in AGENT_CONFIGS).toBe(true);
    }
  });

  it('owns monitoring artifact classification and normalization', () => {
    const context = {
      requestId: 'monitoring-artifact-1',
      domainId: monitoringDomainPack.id,
      message: '장애 리포트 카드 만들어줘',
      messages: [{ role: 'user' as const, content: '장애 리포트 카드 만들어줘' }],
    };

    expect(monitoringDomainPack.artifacts?.classify(context)).toMatchObject({
      kind: 'incident-report',
    });
    expect(
      monitoringDomainPack.artifacts?.normalize({
        kind: 'monitoring-analysis',
        payload: { ok: true },
      })
    ).toMatchObject({
      kind: 'monitoring-analysis',
      payload: {
        kind: 'monitoring-analysis',
        payload: { ok: true },
      },
    });
    expect(
      monitoringDomainPack.artifacts?.normalize({ kind: 'foreign-artifact' })
    ).toBeUndefined();
  });

  it('builds deterministic monitoring facts through the domain fact builder', async () => {
    const factPack = await monitoringDomainPack.facts?.build({
      context: {
        requestId: 'monitoring-facts-1',
        domainId: monitoringDomainPack.id,
        message: '서버 상태 요약',
        messages: [{ role: 'user', content: '서버 상태 요약' }],
      },
    });

    expect(factPack).toMatchObject({
      domainId: 'openmanager-monitoring',
      facts: {
        factPack: {
          factPackVersion: '2026-05-03-v1',
          summary: {
            total: expect.any(Number),
          },
        },
      },
    });
  });
});
