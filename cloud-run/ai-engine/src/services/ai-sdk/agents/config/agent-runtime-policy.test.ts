import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AssistantRuntimeHost } from '../../assistant-runtime-host';
import {
  AGENT_CONFIGS,
  AGENT_NAMES,
  ANALYST_FIRST_PROVIDER_ORDER,
  MISTRAL_FIRST_PROVIDER_ORDER,
  ZAI_FIRST_PROVIDER_ORDER,
  getAgentEvidenceBudget,
  getAgentMaxSteps,
  getAgentProviderOrder,
  getAgentRuntimePolicy,
  getAgentToolAllowlist,
  getAvailableAgents,
  getOrchestratorProviderOrder,
} from './index';
import {
  getMonitoringIntentOwnerAgent,
  getMonitoringIntentTools,
  getUncoveredMonitoringIntentTools,
  type MonitoringToolIntent,
} from './monitoring-tool-policy';

import {
  resolveAgentToolsFromRuntimeHost,
  resolveDefaultMonitoringAgentTools,
} from './agent-tool-registry';

const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));

const EXPECTED_POLICIES = {
  'Metrics Query Agent': {
    providerOrder: ['groq', 'zai', 'mistral', 'cerebras'],
    maxSteps: 4,
    evidenceBudget: 2,
    toolAllowlist: [
      'getServerMetrics',
      'getServerMetricsAdvanced',
      'filterServers',
      'getServerByGroup',
      'getServerByGroupAdvanced',
      'evaluateMathExpression',
      'computeSeriesStats',
      'estimateCapacityProjection',
      'searchWeb',
      'finalAnswer',
    ],
  },
  'Analyst Agent': {
    providerOrder: ['mistral', 'groq', 'zai', 'cerebras'],
    maxSteps: 5,
    evidenceBudget: 3,
    toolAllowlist: [
      'getServerMetrics',
      'getServerMetricsAdvanced',
      'detectAnomalies',
      'detectAnomaliesAllServers',
      'predictTrends',
      'analyzePattern',
      'correlateMetrics',
      'findRootCause',
      'buildIncidentTimeline',
      'estimateCapacityProjection',
      'searchKnowledgeBase',
      'finalAnswer',
    ],
  },
  'Reporter Agent': {
    providerOrder: ['zai', 'mistral', 'groq', 'cerebras'],
    maxSteps: 4,
    evidenceBudget: 4,
    toolAllowlist: [
      'getServerMetrics',
      'getServerMetricsAdvanced',
      'filterServers',
      'searchKnowledgeBase',
      'searchWeb',
      'buildIncidentTimeline',
      'finalAnswer',
    ],
  },
  'Advisor Agent': {
    providerOrder: ['mistral', 'zai', 'groq', 'cerebras'],
    maxSteps: 3,
    evidenceBudget: 3,
    toolAllowlist: [
      'searchKnowledgeBase',
      'recommendCommands',
      'searchWeb',
      'getServerLogs',
      'finalAnswer',
    ],
  },
  'Evaluator Agent': {
    providerOrder: [],
    maxSteps: 0,
    evidenceBudget: 0,
    toolAllowlist: [
      'evaluateIncidentReport',
      'validateReportStructure',
      'scoreRootCauseConfidence',
    ],
  },
  'Optimizer Agent': {
    providerOrder: [],
    maxSteps: 0,
    evidenceBudget: 0,
    toolAllowlist: [
      'refineRootCauseAnalysis',
      'enhanceSuggestedActions',
      'extendServerCorrelation',
      'findRootCause',
      'correlateMetrics',
    ],
  },
  'Vision Agent': {
    providerOrder: [],
    nativeProviderOrder: ['gemini', 'zai'],
    maxSteps: 2,
    evidenceBudget: 0,
    toolAllowlist: ['analyzeScreenshot', 'finalAnswer'],
  },
} as const;

describe('agent runtime policy SSOT', () => {
  it('defines provider order, maxSteps, evidence budget, and tools for every agent', () => {
    expect(AGENT_NAMES).toEqual(Object.keys(EXPECTED_POLICIES));

    for (const agentName of AGENT_NAMES) {
      const expected = EXPECTED_POLICIES[agentName];
      const policy = getAgentRuntimePolicy(agentName);

      expect(policy.providerOrder).toEqual(expected.providerOrder);
      expect(policy.maxSteps).toBe(expected.maxSteps);
      expect(policy.evidenceBudget).toBe(expected.evidenceBudget);
      expect(policy.toolAllowlist).toEqual(expected.toolAllowlist);

      if ('nativeProviderOrder' in expected) {
        expect(policy.nativeProviderOrder).toEqual(expected.nativeProviderOrder);
      }
    }
  });

  it('keeps routable text agents on quota-aware provider fallback meshes', () => {
    const routableTextAgents = [
      'Metrics Query Agent',
      'Analyst Agent',
      'Reporter Agent',
      'Advisor Agent',
    ] as const;
    const expectedProviders = ['cerebras', 'groq', 'mistral', 'zai'];

    expect(
      routableTextAgents.map((agentName) => getAgentProviderOrder(agentName)[0])
    ).toEqual(['groq', 'mistral', 'zai', 'mistral']);

    for (const agentName of routableTextAgents) {
      const order = getAgentProviderOrder(agentName);

      expect(order).toHaveLength(expectedProviders.length);
      expect([...new Set(order)].sort()).toEqual(expectedProviders);
      expect(order[0]).not.toBe('cerebras');
      expect(order.at(-1)).toBe('cerebras');
    }
  });

  it('builds AGENT_CONFIGS tools from the runtime tool allowlist', () => {
    for (const agentName of AGENT_NAMES) {
      expect(Object.keys(AGENT_CONFIGS[agentName].tools).sort()).toEqual(
        [...getAgentToolAllowlist(agentName)].sort()
      );
    }
  });

  it('keeps Evaluator and Optimizer as pipeline-internal, non-routable agents', () => {
    expect(AGENT_CONFIGS['Evaluator Agent'].visibility).toBe(
      'pipeline-internal'
    );
    expect(AGENT_CONFIGS['Optimizer Agent'].visibility).toBe(
      'pipeline-internal'
    );
    expect(AGENT_CONFIGS['Metrics Query Agent'].visibility).toBe('routable');
    expect(getAvailableAgents()).not.toContain('Evaluator Agent');
    expect(getAvailableAgents()).not.toContain('Optimizer Agent');
  });

  it('keeps metric/math lookup on Metrics Query and RCA analysis on Analyst only', () => {
    const nlqAllowlist = getAgentToolAllowlist('Metrics Query Agent');
    const analystAllowlist = getAgentToolAllowlist('Analyst Agent');
    const reporterAllowlist = getAgentToolAllowlist('Reporter Agent');
    const advisorAllowlist = getAgentToolAllowlist('Advisor Agent');

    expect(nlqAllowlist).toEqual(
      expect.arrayContaining([
        'evaluateMathExpression',
        'computeSeriesStats',
        'estimateCapacityProjection',
      ])
    );
    expect(nlqAllowlist).not.toContain('searchKnowledgeBase');

    expect(analystAllowlist).toEqual(
      expect.arrayContaining(['findRootCause', 'correlateMetrics'])
    );
    expect(reporterAllowlist).not.toContain('findRootCause');
    expect(reporterAllowlist).not.toContain('correlateMetrics');
    expect(advisorAllowlist).not.toContain('findRootCause');
    expect(advisorAllowlist).not.toContain('correlateMetrics');
    expect(advisorAllowlist).not.toContain('detectAnomalies');
  });

  it('keeps single-path intent tool overlays inside their owner agent ceilings', () => {
    const intentOwners: MonitoringToolIntent[] = [
      'anomaly',
      'math',
      'prediction',
      'metricRanking',
      'realtimeMetric',
      'rca',
    ];

    for (const intent of intentOwners) {
      expect(getMonitoringIntentOwnerAgent(intent)).toBeDefined();
      expect(getUncoveredMonitoringIntentTools(intent)).toEqual([]);
      expect(getMonitoringIntentTools(intent)).toContain('finalAnswer');
    }
  });

  it('keeps Analyst analysis overlays aligned with the fleet scan prompt', () => {
    for (const intent of ['anomaly', 'prediction', 'rca'] as const) {
      const tools = getMonitoringIntentTools(intent);

      expect(getMonitoringIntentOwnerAgent(intent)).toBe('Analyst Agent');
      expect(tools).toContain('detectAnomaliesAllServers');
      expect(tools.indexOf('detectAnomaliesAllServers')).toBeLessThan(
        tools.indexOf('finalAnswer')
      );
      expect(getUncoveredMonitoringIntentTools(intent)).toEqual([]);
    }
  });

  it('keeps multi-agent tool resolution behind the runtime host boundary', () => {
    const configSource = readFileSync(
      join(CONFIG_DIR, 'agent-configs.ts'),
      'utf8'
    );

    expect(configSource).not.toContain('MONITORING_AGENT_TOOL_REGISTRY');
    expect(configSource).not.toContain('domains/monitoring/tool-registry');
    expect(configSource).toContain('resolveDefaultMonitoringAgentTools');
  });

  it('resolves monitoring agent allowlists through the default runtime host', () => {
    const reporterAllowlist = getAgentToolAllowlist('Reporter Agent');
    const tools = resolveDefaultMonitoringAgentTools(reporterAllowlist);

    expect(Object.keys(tools).sort()).toEqual([...reporterAllowlist].sort());
    expect(tools.searchKnowledgeBase).toBeDefined();
    expect(tools.searchWeb).toBeDefined();
    expect(tools.finalAnswer).toBeDefined();
  });

  it('fails fast when a runtime host cannot satisfy an agent allowlist', () => {
    const incompleteHost = {
      domain: {
        id: 'sample-domain',
      },
      createToolSet: () => ({
        finalAnswer: {
          description: 'final answer',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      }),
    } as AssistantRuntimeHost;

    expect(() =>
      resolveAgentToolsFromRuntimeHost(incompleteHost, ['searchWeb'])
    ).toThrow(
      'Runtime host "sample-domain" is missing agent tool(s): searchWeb'
    );
  });

  it('exposes stable helpers for orchestrator routing and evidence limits', () => {
    expect(getOrchestratorProviderOrder()).toEqual([
      'cerebras',
      'mistral',
      'zai',
      'groq',
    ]);
    expect(MISTRAL_FIRST_PROVIDER_ORDER).toEqual([
      'mistral',
      'zai',
      'groq',
      'cerebras',
    ]);
    expect(ANALYST_FIRST_PROVIDER_ORDER).toEqual([
      'mistral',
      'groq',
      'zai',
      'cerebras',
    ]);
    expect(ZAI_FIRST_PROVIDER_ORDER).toEqual([
      'zai',
      'mistral',
      'groq',
      'cerebras',
    ]);
    expect(getAgentProviderOrder('Analyst Agent')).toEqual([
      'mistral',
      'groq',
      'zai',
      'cerebras',
    ]);
    expect(getAgentMaxSteps('Reporter Agent')).toBe(4);
    expect(getAgentMaxSteps('Advisor Agent')).toBe(3);
    expect(getAgentMaxSteps('Vision Agent')).toBe(2);
    expect(getAgentEvidenceBudget('Metrics Query Agent')).toBe(2);
    expect(getAgentEvidenceBudget('NLQ Agent')).toBe(2); // backward-compat alias: 'NLQ Agent' → 'Metrics Query Agent'
    expect(getAgentRuntimePolicy('Unknown Agent')).toMatchObject({
      providerOrder: ['groq', 'zai', 'mistral', 'cerebras'],
      maxSteps: 4,
      evidenceBudget: 2,
    });
  });
});
