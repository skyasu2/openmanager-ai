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
// Mistral-first: simple text generation tasks (no tools needed, short output).
// Suitable for summarization fallback — saves Groq/Cerebras RPD for agent calls.
export const MISTRAL_FIRST_PROVIDER_ORDER = [
  'mistral',
  'groq',
  'cerebras',
] as const;

// Free-tier quota budget per provider (sliding window):
//   Groq:     30 RPM  → threshold 0.85 → ~25 effective calls/min
//   Cerebras:  5 RPM  → threshold 0.85 →  ~4 effective calls/min
//
// maxSteps cap rationale (one LLM call per step):
//   NLQ (Groq-first):    4 steps → up to 4 Groq calls  → 6 users/min headroom
//   Analyst/Reporter/    5 steps → up to 5 Cerebras     → 1 complex req saturates
//   Advisor (Cerebras):    calls; keeps single request   → the minute window
//                          within 1 RPM slot worst-case
//   Supervisor single:   4 steps → stopWhen enforced in supervisor-stream.ts
//
// evidenceBudget: max tool-result items kept in context before summarising.
// Lower = smaller prompt = fewer tokens = less TPM pressure.
const DEFAULT_AGENT_RUNTIME_POLICY: AgentRuntimePolicy = {
  providerOrder: TEXT_AGENT_PROVIDER_ORDER,
  maxSteps: 4,
  evidenceBudget: 2,
  toolAllowlist: [],
};

// Orchestrator produces a short routing JSON — no need for 32K context.
// Groq-first distributes quota: Orchestrator(Groq) + Agent(Cerebras) instead of
// Orchestrator(Cerebras) + Agent(Cerebras), which consumed 2 of 5 Cerebras RPM.
export const ORCHESTRATOR_RUNTIME_POLICY = {
  providerOrder: TEXT_AGENT_PROVIDER_ORDER,
} as const;

export const AGENT_RUNTIME_POLICIES = {
  // NLQ: Groq-first. Typical flow: metric-lookup → (optional filter) → finalAnswer.
  // 4 steps covers even multi-hop queries (filter → rank → lookup → finalAnswer).
  'NLQ Agent': {
    providerOrder: TEXT_AGENT_PROVIDER_ORDER,
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
  // Analyst: Cerebras-first (32K context needed). Typical flow:
  //   detectAnomalies → predictTrends → (correlate) → finalAnswer = 3–4 steps.
  // 5 steps is the hard ceiling so one request ≤ 1 Cerebras RPM slot.
  'Analyst Agent': {
    providerOrder: CEREBRAS_FIRST_PROVIDER_ORDER,
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
  // Reporter: Cerebras-first (32K context needed). Typical flow:
  //   getMetrics → buildTimeline → findRootCause → finalAnswer = 3–4 steps.
  // 5 steps ceiling matches Analyst for symmetric Cerebras budget usage.
  'Reporter Agent': {
    providerOrder: CEREBRAS_FIRST_PROVIDER_ORDER,
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
  // Advisor: Cerebras-first. Typical flow: searchKB → recommend → finalAnswer = 3 steps.
  // 4 steps is sufficient; saves Cerebras budget vs. the Analyst/Reporter.
  'Advisor Agent': {
    providerOrder: CEREBRAS_FIRST_PROVIDER_ORDER,
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
