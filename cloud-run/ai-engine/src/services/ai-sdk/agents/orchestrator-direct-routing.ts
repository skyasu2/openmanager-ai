import type { PreFilterResult } from './orchestrator-types';
import {
  createAgentDecisionFromDeterministicFallback,
  createAgentDecisionFromPreFilter,
  type RoutingDecisionTrace,
} from '../routing/routing-decision-trace';

export const DEFAULT_DIRECT_ROUTING_AGENT = 'Metrics Query Agent' as const;

export type DirectRoutingSource = 'pre_filter' | 'deterministic_fallback';

export interface DirectRoutingTarget {
  agentName: string;
  confidence: number;
  source: DirectRoutingSource;
  reason: string;
}

export function resolveDirectRoutingTarget(
  preFilterResult: PreFilterResult
): DirectRoutingTarget {
  if (preFilterResult.suggestedAgent) {
    return {
      agentName: preFilterResult.suggestedAgent,
      confidence: preFilterResult.confidence,
      source: 'pre_filter',
      reason: 'Direct routing (pre-filter specialist)',
    };
  }

  return {
    agentName: DEFAULT_DIRECT_ROUTING_AGENT,
    confidence: preFilterResult.confidence,
    source: 'deterministic_fallback',
    reason: 'Direct routing (default metrics fallback)',
  };
}

export function createDirectAgentDecision(
  target: DirectRoutingTarget
): NonNullable<RoutingDecisionTrace['agentDecision']> {
  const input = {
    selectedAgent: target.agentName,
    confidence: target.confidence,
  };
  return target.source === 'pre_filter'
    ? createAgentDecisionFromPreFilter(input)
    : createAgentDecisionFromDeterministicFallback(input);
}
