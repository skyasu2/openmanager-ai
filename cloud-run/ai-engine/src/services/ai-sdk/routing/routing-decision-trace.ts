import type { QueryRoutingSignals } from './query-routing-signals';

export const ROUTING_DECISION_TRACE_VERSION = '2026-05-12-v1' as const;

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
