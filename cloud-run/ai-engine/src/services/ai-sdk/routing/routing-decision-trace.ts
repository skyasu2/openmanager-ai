import type { QueryRoutingSignals } from './query-routing-signals';

export const ROUTING_DECISION_TRACE_VERSION = '2026-05-12-v1' as const;

type AgentRoutingSource = 'pre_filter' | 'llm_routing' | 'fallback';

interface PreFilterResultLike {
  shouldHandoff: boolean;
  directResponse?: string;
  suggestedAgent?: string;
  confidence: number;
}

interface AgentDecisionInput {
  selectedAgent?: string;
  confidence?: number;
}

export interface RoutingDecisionTrace {
  version: typeof ROUTING_DECISION_TRACE_VERSION;
  signals: QueryRoutingSignals;
  modeDecision?: {
    mode: 'single' | 'multi';
    reasonCodes: string[];
  };
  toolDecision?: {
    intentCategory: QueryRoutingSignals['intent'];
    allowedTools: string[];
    forcedTool?: string;
    reasonCodes: string[];
  };
  preFilterDecision?: {
    action: 'direct_response' | 'suggest_agent' | 'continue';
    suggestedAgent?: string;
    confidence?: number;
    reasonCodes: string[];
  };
  agentDecision?: {
    source: 'pre_filter' | 'llm_routing' | 'fallback';
    selectedAgent?: string;
    confidence?: number;
    reasonCodes: string[];
  };
  contextDecision?: {
    findingsSource: 'structured' | 'tool_result' | 'legacy_text_regex' | 'none';
    reasonCodes: string[];
  };
}

export type SanitizedRoutingDecisionTrace = Pick<
  RoutingDecisionTrace,
  'version' | 'modeDecision' | 'toolDecision' | 'preFilterDecision' | 'agentDecision' | 'contextDecision'
> & {
  signals: Omit<QueryRoutingSignals, 'reasonCodes' | 'preFilter'> & {
    reasonCodes: string[];
    preFilter: {
      action: QueryRoutingSignals['preFilter']['action'];
      suggestedAgent?: string;
      confidence: number;
      reasonCodes: string[];
    };
  };
};

export function createRoutingDecisionTrace(
  signals: QueryRoutingSignals
): RoutingDecisionTrace {
  return {
    version: ROUTING_DECISION_TRACE_VERSION,
    signals,
    modeDecision: {
      mode: signals.modeHint,
      reasonCodes: signals.reasonCodes.filter((code) =>
        code.startsWith('mode_')
      ),
    },
    preFilterDecision: {
      action: signals.preFilter.action,
      ...(signals.preFilter.suggestedAgent
        ? { suggestedAgent: signals.preFilter.suggestedAgent }
        : {}),
      confidence: signals.preFilter.confidence,
      reasonCodes: signals.preFilter.reasonCodes,
    },
  };
}

function getSuggestedAgentReasonCode(agentName: string | undefined): string {
  const normalized = (agentName ?? '').toLowerCase();
  if (normalized.includes('reporter')) return 'prefilter_suggest_reporter';
  if (normalized.includes('analyst')) return 'prefilter_suggest_analyst';
  if (normalized.includes('advisor')) return 'prefilter_suggest_advisor';
  if (normalized.includes('vision')) return 'prefilter_vision_attachment';
  return 'prefilter_suggest_nlq';
}

function getDirectResponseReasonCode(query: string): string {
  if (/^(안녕하세요|안녕|하이|헬로|hi|hello|hey|반가워|좋은\s*(아침|오후|저녁))[\s!?.]*$/i.test(query)) {
    return 'prefilter_greeting';
  }
  if (/도움말|help|뭘\s*할\s*수/i.test(query)) return 'prefilter_help';
  return 'prefilter_general';
}

export function createPreFilterDecision(
  query: string,
  result: PreFilterResultLike
): NonNullable<RoutingDecisionTrace['preFilterDecision']> {
  if (!result.shouldHandoff && result.directResponse) {
    return {
      action: 'direct_response',
      confidence: result.confidence,
      reasonCodes: [getDirectResponseReasonCode(query)],
    };
  }

  if (result.suggestedAgent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: result.suggestedAgent,
      confidence: result.confidence,
      reasonCodes: [getSuggestedAgentReasonCode(result.suggestedAgent)],
    };
  }

  return {
    action: 'continue',
    confidence: result.confidence,
    reasonCodes: ['prefilter_continue'],
  };
}

export function createToolDecision(
  signals: QueryRoutingSignals,
  options: {
    allowedTools: string[];
    forcedTool?: string;
  }
): NonNullable<RoutingDecisionTrace['toolDecision']> {
  const intentCategory = options.allowedTools.includes('recommendCommands')
    ? 'advisor'
    : signals.intent;
  const reasonCodes = [`tool_intent_${intentCategory}`];
  if (options.forcedTool) {
    reasonCodes.push(`tool_force_${options.forcedTool}`);
  }

  return {
    intentCategory,
    allowedTools: options.allowedTools,
    ...(options.forcedTool ? { forcedTool: options.forcedTool } : {}),
    reasonCodes,
  };
}

function createAgentDecision(
  source: AgentRoutingSource,
  input: AgentDecisionInput
): NonNullable<RoutingDecisionTrace['agentDecision']> {
  const reasonCode =
    source === 'pre_filter'
      ? 'agent_source_pre_filter'
      : source === 'llm_routing'
        ? 'agent_source_llm_routing'
        : input.selectedAgent
          ? 'agent_source_fallback_suggested'
          : 'agent_source_fallback_default_nlq';

  return {
    source,
    ...(input.selectedAgent ? { selectedAgent: input.selectedAgent } : {}),
    ...(typeof input.confidence === 'number'
      ? { confidence: input.confidence }
      : {}),
    reasonCodes: [reasonCode],
  };
}

export function createAgentDecisionFromPreFilter(
  input: AgentDecisionInput
): NonNullable<RoutingDecisionTrace['agentDecision']> {
  return createAgentDecision('pre_filter', input);
}

export function createAgentDecisionFromLlmRouting(
  input: AgentDecisionInput
): NonNullable<RoutingDecisionTrace['agentDecision']> {
  return createAgentDecision('llm_routing', input);
}

export function createAgentDecisionFromFallback(
  input: AgentDecisionInput
): NonNullable<RoutingDecisionTrace['agentDecision']> {
  return createAgentDecision('fallback', input);
}

export function attachPreFilterDecision(
  trace: RoutingDecisionTrace,
  preFilterDecision: NonNullable<RoutingDecisionTrace['preFilterDecision']>
): RoutingDecisionTrace {
  return {
    ...trace,
    preFilterDecision,
  };
}

export function attachToolDecision(
  trace: RoutingDecisionTrace,
  toolDecision: NonNullable<RoutingDecisionTrace['toolDecision']>
): RoutingDecisionTrace {
  return {
    ...trace,
    toolDecision,
  };
}

export function attachAgentDecision(
  trace: RoutingDecisionTrace,
  agentDecision: NonNullable<RoutingDecisionTrace['agentDecision']>
): RoutingDecisionTrace {
  return {
    ...trace,
    agentDecision,
  };
}

export function sanitizeRoutingDecisionTrace(
  trace: RoutingDecisionTrace
): SanitizedRoutingDecisionTrace {
  return {
    version: trace.version,
    signals: {
      intent: trace.signals.intent,
      toolIntentCategory: trace.signals.toolIntentCategory,
      scope: trace.signals.scope,
      hasInfraContext: trace.signals.hasInfraContext,
      hasAttachment: trace.signals.hasAttachment,
      hasImageAttachment: trace.signals.hasImageAttachment,
      hasFileAttachment: trace.signals.hasFileAttachment,
      asksForReport: trace.signals.asksForReport,
      asksForAction: trace.signals.asksForAction,
      asksForMutation: trace.signals.asksForMutation,
      asksForFormattingOnly: trace.signals.asksForFormattingOnly,
      ...(trace.signals.metric ? { metric: trace.signals.metric } : {}),
      ...(trace.signals.timeWindow
        ? { timeWindow: trace.signals.timeWindow }
        : {}),
      confidence: trace.signals.confidence,
      reasonCodes: trace.signals.reasonCodes,
      modeHint: trace.signals.modeHint,
      preFilter: {
        action: trace.signals.preFilter.action,
        ...(trace.signals.preFilter.suggestedAgent
          ? { suggestedAgent: trace.signals.preFilter.suggestedAgent }
          : {}),
        confidence: trace.signals.preFilter.confidence,
        reasonCodes: trace.signals.preFilter.reasonCodes,
      },
    },
    ...(trace.modeDecision ? { modeDecision: trace.modeDecision } : {}),
    ...(trace.toolDecision ? { toolDecision: trace.toolDecision } : {}),
    ...(trace.preFilterDecision
      ? { preFilterDecision: trace.preFilterDecision }
      : {}),
    ...(trace.agentDecision ? { agentDecision: trace.agentDecision } : {}),
    ...(trace.contextDecision ? { contextDecision: trace.contextDecision } : {}),
  };
}
