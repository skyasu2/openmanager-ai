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
import { resolveMonitoringSemanticFrameRoute } from '../routing/semantic-frame-policy';

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

// 0.8 → 0.65: NLQ intentFrame이 routing primary signal로 실질 반영되도록 임계값 완화.
// 기존 0.8은 실제 분류 신뢰도에 비해 높아 semantic_frame 경로가 fallback되는 빈도가 높았음.
const SEMANTIC_AGENT_CONFIDENCE_THRESHOLD = 0.65;
const ANALYST_PREFILTER_OVERRIDE_CAPABILITIES = new Set([
  'monitoring.metric_current',
  'monitoring.server_health',
]);
const ANALYST_PREFILTER_OVERRIDE_INTENTS = new Set([
  'metric_current',
  'server_health',
]);

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

  return resolveMonitoringSemanticFrameRoute(intentFrame)?.agentName;
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
  context: DirectRoutingContext
): boolean {
  if (
    !isExplicitAnalystPreFilter(preFilterResult) ||
    semanticAgent !== DEFAULT_DIRECT_ROUTING_AGENT
  ) {
    return false;
  }

  const capabilityId = context.intentFrame?.capabilityId?.trim().toLowerCase();
  const intent = context.intentFrame?.intent?.trim().toLowerCase();
  return (
    (capabilityId !== undefined &&
      ANALYST_PREFILTER_OVERRIDE_CAPABILITIES.has(capabilityId)) ||
    (intent !== undefined && ANALYST_PREFILTER_OVERRIDE_INTENTS.has(intent))
  );
}

export function resolveDirectRoutingTarget(
  preFilterResult: PreFilterResult,
  context: DirectRoutingContext = {}
): DirectRoutingTarget {
  const semanticAgent = resolveSemanticFrameAgent(context.intentFrame);
  if (semanticAgent) {
    if (
      shouldAnalystPreFilterOverrideSemanticFrame(
        preFilterResult,
        semanticAgent,
        context
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
