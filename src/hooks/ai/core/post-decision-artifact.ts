import {
  ARTIFACT_INTENT_RULE_VERSION,
  type ChatArtifactIntent,
  classifyChatArtifactIntent,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import type {
  RouteDecision,
  RouteDecisionArtifactKind,
} from '@/lib/ai/route-decision';
import type { AsyncQueryResult } from '../useAsyncAIQuery';

type ExecutableChatArtifactIntent = Extract<
  ChatArtifactIntent,
  { kind: RouteDecisionArtifactKind }
>;

const POST_DECISION_REASON = 'llm_artifact_classification';

export function resolvePostDecisionArtifactIntent({
  result,
  query,
}: {
  result: AsyncQueryResult;
  query: string;
}): ExecutableChatArtifactIntent | null {
  const artifactKind = resolvePostDecisionArtifactKind(result);
  if (!artifactKind) return null;

  const frontendIntent = classifyChatArtifactIntent(query);
  if (
    isExecutableChatArtifactIntent(frontendIntent) &&
    frontendIntent.kind === artifactKind
  ) {
    return frontendIntent;
  }

  return createPostDecisionArtifactIntent(artifactKind);
}

function resolvePostDecisionArtifactKind(
  result: AsyncQueryResult
): RouteDecisionArtifactKind | null {
  const resultRouteDecision = result.routeDecision;
  const assistantResultRouteDecision = result.assistantResult?.routeDecision;
  const assistantPlanRouteDecision = result.assistantPlan?.routeDecision;

  const assistantResultKind = readKindFromRouteDecision(
    result.assistantResult?.routeDecision ?? resultRouteDecision,
    result.assistantResult?.artifactKind
  );
  if (assistantResultKind) return assistantResultKind;

  const assistantPlanKind =
    result.assistantPlan?.executionPath === 'client-artifact'
      ? result.assistantPlan.artifactKind
      : undefined;
  if (assistantPlanKind) return assistantPlanKind;

  const assistantPlanRouteKind = readKindFromRouteDecision(
    assistantPlanRouteDecision,
    assistantPlanRouteDecision?.artifactKind
  );
  if (assistantPlanRouteKind) return assistantPlanRouteKind;

  const routeDecisionKind = readKindFromRouteDecision(
    resultRouteDecision,
    resultRouteDecision?.artifactKind
  );
  if (routeDecisionKind) return routeDecisionKind;

  const assistantResultRouteKind = readKindFromRouteDecision(
    assistantResultRouteDecision,
    assistantResultRouteDecision?.artifactKind
  );
  return assistantResultRouteKind ?? null;
}

function readKindFromRouteDecision(
  routeDecision: RouteDecision | undefined,
  artifactKind: RouteDecisionArtifactKind | undefined
): RouteDecisionArtifactKind | null {
  if (routeDecision?.executionPath !== 'client-artifact') return null;
  return artifactKind ?? routeDecision.artifactKind ?? null;
}

function createPostDecisionArtifactIntent(
  artifactKind: RouteDecisionArtifactKind
): ExecutableChatArtifactIntent | null {
  switch (artifactKind) {
    case 'incident-report':
    case 'monitoring-analysis':
    case 'server-snapshot':
      return {
        kind: artifactKind,
        reason: POST_DECISION_REASON,
        ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
      } as ExecutableChatArtifactIntent;
    case 'ops-procedure':
      return {
        kind: 'ops-procedure',
        procedureType: 'script',
        reason: POST_DECISION_REASON,
        ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
      };
    case 'server-monitoring-analysis':
      return null;
  }
}

function isExecutableChatArtifactIntent(
  intent: ChatArtifactIntent
): intent is ExecutableChatArtifactIntent {
  return (
    intent.kind === 'incident-report' ||
    intent.kind === 'monitoring-analysis' ||
    intent.kind === 'server-monitoring-analysis' ||
    intent.kind === 'server-snapshot' ||
    intent.kind === 'ops-procedure'
  );
}
