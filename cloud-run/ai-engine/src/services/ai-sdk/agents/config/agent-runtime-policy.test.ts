import { describe, expect, it } from 'vitest';
import {
  AGENT_CONFIGS,
  AGENT_NAMES,
  getAgentEvidenceBudget,
  getAgentMaxSteps,
  getAgentProviderOrder,
  getAgentRuntimePolicy,
  getAgentToolAllowlist,
  getOrchestratorProviderOrder,
} from './index';

const EXPECTED_POLICIES = {
  'NLQ Agent': {
    providerOrder: ['groq', 'cerebras', 'mistral'],
    maxSteps: 7,
    evidenceBudget: 3,
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
    maxSteps: 10,
    evidenceBudget: 5,
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
    maxSteps: 10,
    evidenceBudget: 6,
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
    maxSteps: 7,
    evidenceBudget: 5,
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

  it('exposes stable helpers for orchestrator routing and evidence limits', () => {
    expect(getOrchestratorProviderOrder()).toEqual([
      'cerebras',
      'groq',
      'mistral',
    ]);
    expect(getAgentProviderOrder('Analyst Agent')).toEqual([
      'cerebras',
      'groq',
      'mistral',
    ]);
    expect(getAgentMaxSteps('Reporter Agent')).toBe(10);
    expect(getAgentEvidenceBudget('NLQ Agent')).toBe(3);
    expect(getAgentRuntimePolicy('Unknown Agent')).toMatchObject({
      providerOrder: ['groq', 'cerebras', 'mistral'],
      maxSteps: 7,
      evidenceBudget: 3,
    });
  });
});
