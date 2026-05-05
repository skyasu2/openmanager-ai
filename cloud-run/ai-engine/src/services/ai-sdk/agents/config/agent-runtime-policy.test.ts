import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AssistantRuntimeHost } from '../../assistant-runtime-host';
import {
  AGENT_CONFIGS,
  AGENT_NAMES,
  MISTRAL_FIRST_PROVIDER_ORDER,
  getAgentEvidenceBudget,
  getAgentMaxSteps,
  getAgentProviderOrder,
  getAgentRuntimePolicy,
  getAgentToolAllowlist,
  getOrchestratorProviderOrder,
} from './index';
import {
  resolveAgentToolsFromRuntimeHost,
  resolveDefaultMonitoringAgentTools,
} from './agent-tool-registry';

const CONFIG_DIR = dirname(fileURLToPath(import.meta.url));

const EXPECTED_POLICIES = {
  'NLQ Agent': {
    providerOrder: ['groq', 'cerebras', 'mistral'],
    maxSteps: 4,
    evidenceBudget: 2,
    toolAllowlist: [
      'getServerMetrics',
      'getServerMetricsAdvanced',
      'filterServers',
      'getServerByGroup',
      'getServerByGroupAdvanced',
      'searchKnowledgeBase',
      'searchWeb',
      'finalAnswer',
    ],
  },
  'Analyst Agent': {
    providerOrder: ['cerebras', 'groq', 'mistral'],
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
      'searchKnowledgeBase',
      'finalAnswer',
    ],
  },
  'Reporter Agent': {
    providerOrder: ['cerebras', 'groq', 'mistral'],
    maxSteps: 5,
    evidenceBudget: 4,
    toolAllowlist: [
      'getServerMetrics',
      'getServerMetricsAdvanced',
      'filterServers',
      'searchKnowledgeBase',
      'searchWeb',
      'buildIncidentTimeline',
      'findRootCause',
      'correlateMetrics',
      'finalAnswer',
    ],
  },
  'Advisor Agent': {
    providerOrder: ['cerebras', 'groq', 'mistral'],
    maxSteps: 4,
    evidenceBudget: 3,
    toolAllowlist: [
      'searchKnowledgeBase',
      'recommendCommands',
      'searchWeb',
      'getServerLogs',
      'findRootCause',
      'correlateMetrics',
      'detectAnomalies',
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
    nativeProviderOrder: ['gemini', 'openrouter'],
    maxSteps: 5,
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

  it('builds AGENT_CONFIGS tools from the runtime tool allowlist', () => {
    for (const agentName of AGENT_NAMES) {
      expect(Object.keys(AGENT_CONFIGS[agentName].tools).sort()).toEqual(
        [...getAgentToolAllowlist(agentName)].sort()
      );
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
      'groq',
      'cerebras',
      'mistral',
    ]);
    expect(MISTRAL_FIRST_PROVIDER_ORDER).toEqual([
      'mistral',
      'groq',
      'cerebras',
    ]);
    expect(getAgentProviderOrder('Analyst Agent')).toEqual([
      'cerebras',
      'groq',
      'mistral',
    ]);
    expect(getAgentMaxSteps('Reporter Agent')).toBe(5);
    expect(getAgentEvidenceBudget('NLQ Agent')).toBe(2);
    expect(getAgentRuntimePolicy('Unknown Agent')).toMatchObject({
      providerOrder: ['groq', 'cerebras', 'mistral'],
      maxSteps: 4,
      evidenceBudget: 2,
    });
  });
});
