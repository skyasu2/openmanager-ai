import { normalizeAgentRuntimeName } from '../../../../core/assistant-runtime/agent-name-compat';

export type TextRuntimeProvider = 'groq' | 'zai' | 'mistral' | 'cerebras';
export type NativeRuntimeProvider = 'gemini';

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

export const GROQ_FIRST_PROVIDER_ORDER = [
  'groq',
  'zai',
  'mistral',
  'cerebras',
] as const;
export const ANALYST_FIRST_PROVIDER_ORDER = [
  'mistral',
  'groq',
  'zai',
  'cerebras',
] as const;
export const ZAI_FIRST_PROVIDER_ORDER = [
  'zai',
  'mistral',
  'groq',
  'cerebras',
] as const;
// Mistral-first: simple text generation tasks (no tools needed, short output).
// Suitable for summarization fallback — saves Groq/Cerebras RPD for agent calls.
export const MISTRAL_FIRST_PROVIDER_ORDER = [
  'mistral',
  'zai',
  'groq',
  'cerebras',
] as const;
export const TEXT_AGENT_PROVIDER_ORDER = GROQ_FIRST_PROVIDER_ORDER;
const ORCHESTRATOR_TEXT_PROVIDER_ORDER = [
  'cerebras',
  'mistral',
  'zai',
  'groq',
] as const;

// Free-tier quota budget per provider (sliding window):
//   Groq:     30 RPM / 1K RPD / 30K TPM / 500K TPD.
//   Z.AI:     free Flash models, concurrency/rate limits are account-specific.
//   Mistral:  workspace-tier dependent; current account smoke: 50 RPM / 50K TPM.
//   Cerebras: short-context fallback only. Current account smoke: 5 RPM / 2.4K RPD.
//             llama3.1-8b has an 8K context window and deprecates on 2026-05-27.
//
// maxSteps cap rationale (one LLM call per step):
//   Metrics Query:       4 steps → up to 4 Groq calls  → 6 users/min headroom
//   Analyst:             5 steps → Mistral-first RCA loop avoids phantom Cerebras skip
//   Reporter:            4 steps → Z.AI-first, but bounded under conservative 5 RPM guard
//   Advisor:             3 steps → searchKB → recommend → finalAnswer typical path
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

// Orchestrator produces short routing/decomposition JSON. Keep Groq last so
// Metrics Query can spend Groq RPD on actual tool-loop work.
export const ORCHESTRATOR_RUNTIME_POLICY = {
  providerOrder: ORCHESTRATOR_TEXT_PROVIDER_ORDER,
} as const;

export const AGENT_RUNTIME_POLICIES = {
  // Metrics Query: Groq-first. Typical flow: metric lookup → optional filter → finalAnswer.
  // 4 steps covers even multi-hop queries (filter → rank → lookup → finalAnswer).
  // Group tool split: getServerByGroup is simple role lookup; Advanced adds
  // filters/sort/limit for grouped ranking and threshold queries.
  'Metrics Query Agent': {
    providerOrder: TEXT_AGENT_PROVIDER_ORDER,
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
  // Analyst: Mistral-first (32K context needed). Typical flow:
  //   detectAnomaliesAllServers → detectAnomalies/predictTrends → finalAnswer.
  // Cerebras remains last because its 8K runtime cannot satisfy this path and
  // would otherwise become a phantom primary that immediately falls through.
  'Analyst Agent': {
    providerOrder: ANALYST_FIRST_PROVIDER_ORDER,
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
  // Reporter: Z.AI-first (32K context needed). Typical flow:
  //   getMetrics → buildTimeline → search evidence → finalAnswer = 3–4 steps.
  // Root-cause analysis tools stay on Analyst; Reporter consumes handoff evidence.
  // 4 steps avoids saturating the conservative 5 RPM Z.AI guard on one request.
  'Reporter Agent': {
    providerOrder: ZAI_FIRST_PROVIDER_ORDER,
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
  // Advisor: Mistral-first. Typical flow: searchKB → recommend → finalAnswer = 3 steps.
  // Analysis/RCA tools stay on Analyst; Advisor focuses on KB, logs, and commands.
  // 3 steps keeps short guidance paths cheap and leaves Mistral headroom for Analyst.
  'Advisor Agent': {
    providerOrder: MISTRAL_FIRST_PROVIDER_ORDER,
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
    nativeProviderOrder: ['gemini'],
    maxSteps: 2,
    evidenceBudget: 0,
    toolAllowlist: ['analyzeScreenshot', 'finalAnswer'],
  },
} as const satisfies Record<string, AgentRuntimePolicy>;

export function getAgentRuntimePolicy(agentName: string): AgentRuntimePolicy {
  const normalizedAgentName = normalizeAgentRuntimeName(agentName);
  return (
    (AGENT_RUNTIME_POLICIES as Record<string, AgentRuntimePolicy>)[
      normalizedAgentName
    ] ??
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
