import type {
  AssistantInputType,
  DomainIntentFrame,
} from '../../../core/assistant-runtime';
import type { PreFilterResult } from './orchestrator-types';
import {
  createAgentDecisionFromInputType,
  createAgentDecisionFromDeterministicFallback,
  createAgentDecisionFromPreFilter,
  createAgentDecisionFromSemanticFrame,
  type RoutingDecisionTrace,
} from '../routing/routing-decision-trace';

export const DEFAULT_DIRECT_ROUTING_AGENT = 'Metrics Query Agent' as const;

export type DirectRoutingSource =
  | 'semantic_frame'
  | 'input_type'
  | 'pre_filter'
  | 'deterministic_fallback';

export interface DirectRoutingTarget {
  agentName: string;
  confidence: number;
  source: DirectRoutingSource;
  reason: string;
}

export interface DirectRoutingContext {
  intentFrame?: DomainIntentFrame;
  inputType?: AssistantInputType;
}

const SEMANTIC_AGENT_CONFIDENCE_THRESHOLD = 0.8;

function normalizeConfidence(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return value > 1 ? value / 100 : value;
}

function resolveSemanticFrameAgent(
  intentFrame: DomainIntentFrame | undefined
): string | undefined {
  if (!intentFrame) return undefined;
  if (
    normalizeConfidence(intentFrame.confidence) <
    SEMANTIC_AGENT_CONFIDENCE_THRESHOLD
  ) {
    return undefined;
  }

  const capabilityId = intentFrame.capabilityId ?? '';
  const intent = intentFrame.intent;
  const semanticKey = capabilityId || intent;

  if (
    semanticKey.includes('incident_report') ||
    semanticKey.includes('incident-report')
  ) {
    return 'Reporter Agent';
  }

  if (
    semanticKey.includes('ops_advice') ||
    semanticKey.includes('advisor') ||
    semanticKey.includes('runbook')
  ) {
    return 'Advisor Agent';
  }

  if (
    semanticKey.includes('root_cause') ||
    semanticKey.includes('log_analysis') ||
    semanticKey.includes('metric_trend') ||
    semanticKey.includes('anomaly_detection') ||
    semanticKey.includes('anomaly_prediction') ||
    semanticKey.includes('capacity_forecast') ||
    semanticKey.includes('failure_risk') ||
    intent === 'root_cause' ||
    intent === 'log_analysis' ||
    intent === 'metric_trend' ||
    intent === 'anomaly_detection' ||
    intent === 'anomaly_prediction' ||
    intent === 'capacity_forecast' ||
    intent === 'failure_risk'
  ) {
    return 'Analyst Agent';
  }

  if (
    semanticKey.includes('metric_current') ||
    semanticKey.includes('metric_peak') ||
    semanticKey.includes('server_health') ||
    intent === 'metric_current' ||
    intent === 'metric_peak' ||
    intent === 'server_health'
  ) {
    return DEFAULT_DIRECT_ROUTING_AGENT;
  }

  return undefined;
}

export function resolveDirectRoutingTarget(
  preFilterResult: PreFilterResult,
  context: DirectRoutingContext = {}
): DirectRoutingTarget {
  const semanticAgent = resolveSemanticFrameAgent(context.intentFrame);
  if (semanticAgent) {
    return {
      agentName: semanticAgent,
      confidence: normalizeConfidence(context.intentFrame?.confidence),
      source: 'semantic_frame',
      reason: 'Direct routing (semantic intent frame)',
    };
  }

  if (context.inputType === 'log_paste' || context.inputType === 'mixed') {
    return {
      agentName: 'Analyst Agent',
      confidence: preFilterResult.confidence,
      source: 'input_type',
      reason: 'Direct routing (log input analysis)',
    };
  }

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
  if (target.source === 'semantic_frame') {
    return createAgentDecisionFromSemanticFrame(input);
  }
  if (target.source === 'input_type') {
    return createAgentDecisionFromInputType(input);
  }
  return target.source === 'pre_filter'
    ? createAgentDecisionFromPreFilter(input)
    : createAgentDecisionFromDeterministicFallback(input);
}
