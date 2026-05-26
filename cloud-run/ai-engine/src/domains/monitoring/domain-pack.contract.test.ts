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
  { id: 'nlq', name: 'Metrics Query Agent', runtimeConfigKey: 'Metrics Query Agent' },
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

  it('exposes monitoring precomputed state through the domain data source', async () => {
    const context = {
      requestId: 'monitoring-data-source-1',
      domainId: monitoringDomainPack.id,
      message: '서버 상태 요약',
      messages: [{ role: 'user' as const, content: '서버 상태 요약' }],
    };
    const snapshot = await monitoringDomainPack.dataSource?.snapshot(context);
    const history = await monitoringDomainPack.dataSource?.history(6, context);

    expect(snapshot).toMatchObject({
      timestamp: expect.any(String),
      data: {
        servers: expect.any(Array),
        alerts: expect.any(Array),
      },
    });
    expect(history).toHaveLength(6);
    expect(history?.[0]).toMatchObject({
      timestamp: expect.any(String),
      data: {
        servers: expect.any(Array),
      },
    });
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

  it('parses natural whole-fleet load pressure phrasing as a peak metric capability', async () => {
    const context = {
      requestId: 'monitoring-load-phrasing-1',
      domainId: monitoringDomainPack.id,
      message:
        '최근 하루 동안 전체 서버가 제일 버거웠던 때가 언제야? CPU 말고 시스템 load 기준으로, 주범 서버까지.',
      messages: [
        {
          role: 'user' as const,
          content:
            '최근 하루 동안 전체 서버가 제일 버거웠던 때가 언제야? CPU 말고 시스템 load 기준으로, 주범 서버까지.',
        },
      ],
    };

    const frame = await Promise.resolve(
      monitoringDomainPack.intentParser?.parse(context)
    );

    expect(frame).toMatchObject({
      domainId: 'openmanager-monitoring',
      intent: 'metric_peak',
      capabilityId: 'monitoring.metric_peak',
      scope: 'whole_fleet',
      metric: 'load',
      timeWindow: '24h',
      aggregation: 'peak',
    });
  });

  it('parses current ranking and server health queries as deterministic evidence capabilities', async () => {
    const rankingFrame = await Promise.resolve(
      monitoringDomainPack.intentParser?.parse({
        requestId: 'monitoring-current-ranking-1',
        domainId: monitoringDomainPack.id,
        message: '현재 CPU 사용률 상위 3대 알려줘',
        messages: [
          { role: 'user' as const, content: '현재 CPU 사용률 상위 3대 알려줘' },
        ],
      })
    );
    const healthFrame = await Promise.resolve(
      monitoringDomainPack.intentParser?.parse({
        requestId: 'monitoring-server-health-1',
        domainId: monitoringDomainPack.id,
        message: '현재 모든 서버 상태 요약해줘',
        messages: [
          { role: 'user' as const, content: '현재 모든 서버 상태 요약해줘' },
        ],
      })
    );

    expect(rankingFrame).toMatchObject({
      domainId: 'openmanager-monitoring',
      intent: 'metric_ranking',
      capabilityId: 'monitoring.metric_ranking',
      metric: 'cpu',
      timeWindow: 'current',
      aggregation: 'top_n',
      topN: 3,
    });
    expect(healthFrame).toMatchObject({
      domainId: 'openmanager-monitoring',
      intent: 'server_health',
      capabilityId: 'monitoring.server_health',
      timeWindow: 'current',
      aggregation: 'summary',
    });
  });

  it('parses current resource pressure ranking as deterministic metric ranking', async () => {
    const frame = await Promise.resolve(
      monitoringDomainPack.intentParser?.parse({
        requestId: 'monitoring-current-pressure-ranking-1',
        domainId: monitoringDomainPack.id,
        message: '전체 서버 리소스 압박 순위 알려줘',
        messages: [
          {
            role: 'user' as const,
            content: '전체 서버 리소스 압박 순위 알려줘',
          },
        ],
      })
    );

    expect(frame).toMatchObject({
      domainId: 'openmanager-monitoring',
      intent: 'metric_ranking',
      capabilityId: 'monitoring.metric_ranking',
      scope: 'whole_fleet',
      timeWindow: 'current',
      aggregation: 'top_n',
      topN: 5,
    });
  });
});
