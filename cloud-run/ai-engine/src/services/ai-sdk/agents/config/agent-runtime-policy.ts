export type TextRuntimeProvider = 'groq' | 'cerebras' | 'mistral';
export type NativeRuntimeProvider = 'gemini' | 'openrouter';

export type AgentToolName =
  | 'getServerMetrics'
  | 'getServerMetricsAdvanced'
  | 'filterServers'
  | 'getServerByGroup'
  | 'getServerByGroupAdvanced'
  | 'getServerLogs'
  | 'detectAnomalies'
  | 'detectAnomaliesAllServers'
  | 'predictTrends'
  | 'analyzePattern'
  | 'correlateMetrics'
  | 'findRootCause'
  | 'buildIncidentTimeline'
  | 'searchKnowledgeBase'
  | 'recommendCommands'
  | 'searchWeb'
  | 'evaluateIncidentReport'
  | 'validateReportStructure'
  | 'scoreRootCauseConfidence'
  | 'refineRootCauseAnalysis'
  | 'enhanceSuggestedActions'
  | 'extendServerCorrelation'
  | 'finalAnswer'
  | 'analyzeScreenshot'
  | 'analyzeLargeLog'
  | 'searchWithGrounding'
  | 'analyzeUrlContent'
  | 'evaluateMathExpression'
  | 'computeSeriesStats'
  | 'estimateCapacityProjection';

export interface AgentRuntimePolicy {
  providerOrder: readonly TextRuntimeProvider[];
  nativeProviderOrder?: readonly NativeRuntimeProvider[];
  maxSteps: number;
  evidenceBudget: number;
  toolAllowlist: readonly AgentToolName[];
}

export const TEXT_AGENT_PROVIDER_ORDER = ['groq', 'cerebras', 'mistral'] as const;
export const CEREBRAS_FIRST_PROVIDER_ORDER = [
  'cerebras',
  'groq',
  'mistral',
] as const;

const DEFAULT_AGENT_RUNTIME_POLICY: AgentRuntimePolicy = {
  providerOrder: TEXT_AGENT_PROVIDER_ORDER,
  maxSteps: 7,
  evidenceBudget: 3,
  toolAllowlist: [],
};

export const ORCHESTRATOR_RUNTIME_POLICY = {
  providerOrder: CEREBRAS_FIRST_PROVIDER_ORDER,
} as const;

export const AGENT_RUNTIME_POLICIES = {
  'NLQ Agent': {
    providerOrder: TEXT_AGENT_PROVIDER_ORDER,
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
    providerOrder: CEREBRAS_FIRST_PROVIDER_ORDER,
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
    providerOrder: CEREBRAS_FIRST_PROVIDER_ORDER,
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
    providerOrder: TEXT_AGENT_PROVIDER_ORDER,
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
} as const satisfies Record<string, AgentRuntimePolicy>;

export function getAgentRuntimePolicy(agentName: string): AgentRuntimePolicy {
  return (
    (AGENT_RUNTIME_POLICIES as Record<string, AgentRuntimePolicy>)[agentName] ??
    DEFAULT_AGENT_RUNTIME_POLICY
  );
}

export function getAgentProviderOrder(agentName: string): TextRuntimeProvider[] {
  return [...getAgentRuntimePolicy(agentName).providerOrder];
}

export function getOrchestratorProviderOrder(): TextRuntimeProvider[] {
  return [...ORCHESTRATOR_RUNTIME_POLICY.providerOrder];
}

export function getAgentMaxSteps(agentName: string): number {
  return getAgentRuntimePolicy(agentName).maxSteps;
}

export function getAgentEvidenceBudget(agentName: string): number {
  return getAgentRuntimePolicy(agentName).evidenceBudget;
}

export function getAgentToolAllowlist(agentName: string): AgentToolName[] {
  return [...getAgentRuntimePolicy(agentName).toolAllowlist];
}
