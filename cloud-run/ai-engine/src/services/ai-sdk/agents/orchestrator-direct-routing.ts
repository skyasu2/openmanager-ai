import type {
  AssistantDomain,
  AssistantInputType,
  DomainIntentFrame,
  DomainRoutingOverridePolicy,
} from '../../../core/assistant-runtime';
import type { PreFilterResult } from './orchestrator-types';
import {
  createAgentDecisionFromInputType,
  createAgentDecisionFromDeterministicFallback,
  createAgentDecisionFromPreFilter,
  createAgentDecisionFromSemanticFrame,
  type RoutingDecisionTrace,
} from '../routing/routing-decision-trace';
import { resolveMonitoringSemanticFrameRoute } from '../routing/semantic-frame-policy';
import { normalizeConfidence } from '../routing/confidence-utils';

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
  provider?: 'deterministic';
}

export interface DirectRoutingContext {
  domain?: AssistantDomain;
  intentFrame?: DomainIntentFrame;
  inputType?: AssistantInputType;
}

// 0.8 → 0.65: NLQ intentFrame이 routing primary signal로 실질 반영되도록 임계값 완화.
// 기존 0.8은 실제 분류 신뢰도에 비해 높아 semantic_frame 경로가 fallback되는 빈도가 높았음.
const FALLBACK_DIRECT_ROUTING_POLICY: DomainRoutingOverridePolicy = {
  defaultDirectRoutingAgent: DEFAULT_DIRECT_ROUTING_AGENT,
  semanticConfidenceThreshold: 0.65,
  analystOverrideCapabilities: [],
  analystOverrideIntents: [],
};

function resolveRoutingOverridePolicy(
  domain: AssistantDomain | undefined
): DomainRoutingOverridePolicy {
  return domain?.routingOverridePolicy ?? FALLBACK_DIRECT_ROUTING_POLICY;
}

function hasNormalizedPolicyValue(
  values: readonly string[],
  value: string | undefined
): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  return values.some((entry) => entry.trim().toLowerCase() === normalized);
}

function resolveSemanticFrameAgent(
  intentFrame: DomainIntentFrame | undefined,
  policy: DomainRoutingOverridePolicy
): string | undefined {
  if (!intentFrame) return undefined;
  if (
    normalizeConfidence(intentFrame.confidence) <
    policy.semanticConfidenceThreshold
  ) {
    return undefined;
  }

  return resolveMonitoringSemanticFrameRoute(intentFrame)?.agentName;
}

function readStringSlot(
  intentFrame: DomainIntentFrame | undefined,
  key: string
): string | undefined {
  const value = intentFrame?.slots?.[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isDeterministicServerComparisonFrame(
  intentFrame: DomainIntentFrame | undefined
): boolean {
  if (!intentFrame) return false;
  return (
    intentFrame.intent === 'metric_current' &&
    intentFrame.capabilityId === 'monitoring.metric_current' &&
    intentFrame.targets.length >= 2 &&
    (readStringSlot(intentFrame, 'sourceIntent') === 'server-compare' ||
      intentFrame.aggregation === 'compare')
  );
}

function isExplicitAdvisorPreFilter(preFilterResult: PreFilterResult): boolean {
  return (
    preFilterResult.suggestedAgent === 'Advisor Agent' &&
    normalizeConfidence(preFilterResult.confidence) >= 0.75
  );
}

function isExplicitAnalystPreFilter(preFilterResult: PreFilterResult): boolean {
  return (
    preFilterResult.suggestedAgent === 'Analyst Agent' &&
    normalizeConfidence(preFilterResult.confidence) >= 0.75
  );
}

function shouldAdvisorPreFilterOverrideSemanticFrame(
  preFilterResult: PreFilterResult,
  semanticAgent: string,
  context: DirectRoutingContext
): boolean {
  return (
    isExplicitAdvisorPreFilter(preFilterResult) &&
    (semanticAgent === 'Analyst Agent' ||
      context.intentFrame?.scope !== 'whole_fleet')
  );
}

function shouldAnalystPreFilterOverrideSemanticFrame(
  preFilterResult: PreFilterResult,
  semanticAgent: string,
  context: DirectRoutingContext,
  policy: DomainRoutingOverridePolicy
): boolean {
  if (
    !isExplicitAnalystPreFilter(preFilterResult) ||
    semanticAgent !== policy.defaultDirectRoutingAgent
  ) {
    return false;
  }

  const capabilityId = context.intentFrame?.capabilityId?.trim().toLowerCase();
  const intent = context.intentFrame?.intent?.trim().toLowerCase();
  return (
    hasNormalizedPolicyValue(policy.analystOverrideCapabilities, capabilityId) ||
    hasNormalizedPolicyValue(policy.analystOverrideIntents, intent)
  );
}

export function resolveDirectRoutingTarget(
  preFilterResult: PreFilterResult,
  context: DirectRoutingContext = {}
): DirectRoutingTarget {
  const policy = resolveRoutingOverridePolicy(context.domain);
  if (isDeterministicServerComparisonFrame(context.intentFrame)) {
    return {
      agentName: policy.defaultDirectRoutingAgent,
      confidence: normalizeConfidence(context.intentFrame?.confidence),
      source: 'deterministic_fallback',
      reason: 'Direct routing (deterministic server comparison)',
      provider: 'deterministic',
    };
  }

  const semanticAgent = resolveSemanticFrameAgent(context.intentFrame, policy);
  if (semanticAgent) {
    if (
      shouldAnalystPreFilterOverrideSemanticFrame(
        preFilterResult,
        semanticAgent,
        context,
        policy
      )
    ) {
      return {
        agentName: 'Analyst Agent',
        confidence: preFilterResult.confidence,
        source: 'pre_filter',
        reason: 'Direct routing (explicit RCA pre-filter)',
      };
    }

    if (
      semanticAgent !== 'Advisor Agent' &&
      shouldAdvisorPreFilterOverrideSemanticFrame(
        preFilterResult,
        semanticAgent,
        context
      )
    ) {
      return {
        agentName: 'Advisor Agent',
        confidence: preFilterResult.confidence,
        source: 'pre_filter',
        reason: 'Direct routing (explicit remediation pre-filter)',
      };
    }

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
    agentName: policy.defaultDirectRoutingAgent,
    confidence: preFilterResult.confidence,
    source: 'deterministic_fallback',
    reason: 'Direct routing (default direct routing fallback)',
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
