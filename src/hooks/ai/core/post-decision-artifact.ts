import { createServerIdPattern } from '@/config/server-id-pattern';
import { resolveRegisteredServerId } from '@/config/server-registry';
import {
  type ChatArtifactIntent,
  withArtifactIntentRuleVersion,
} from '@/lib/ai/chat-artifacts/artifact-intent-contract';
import type {
  RouteDecision,
  RouteDecisionArtifactKind,
  RouteDecisionDecider,
} from '@/lib/ai/route-decision';
import type { AsyncQueryResult } from '../useAsyncAIQuery';

type ExecutableChatArtifactIntent = Extract<
  ChatArtifactIntent,
  { kind: RouteDecisionArtifactKind }
>;

const POST_DECISION_REASON = 'llm_artifact_classification';
const SERVER_MONITORING_ID_PATTERN = createServerIdPattern();

type ResolvedPostDecisionArtifact = {
  artifactKind: RouteDecisionArtifactKind;
  decidedBy: RouteDecisionDecider;
};

export function resolvePostDecisionArtifactIntent({
  result,
  query,
}: {
  result: AsyncQueryResult;
  query: string;
}): ExecutableChatArtifactIntent | null {
  const artifact = resolvePostDecisionArtifact(result);
  if (!artifact) return null;

  return createPostDecisionArtifactIntent(artifact, query);
}

function resolvePostDecisionArtifact(
  result: AsyncQueryResult
): ResolvedPostDecisionArtifact | null {
  const resultRouteDecision = result.routeDecision;
  const assistantResultRouteDecision = result.assistantResult?.routeDecision;
  const assistantPlanRouteDecision = result.assistantPlan?.routeDecision;

  const assistantResultKind = readArtifactFromRouteDecision(
    assistantResultRouteDecision,
    result.assistantResult?.artifactKind
  );
  if (assistantResultKind) return assistantResultKind;

  const legacyAssistantResultKind =
    assistantResultRouteDecision === undefined
      ? readArtifactFromRouteDecision(
          resultRouteDecision,
          result.assistantResult?.artifactKind
        )
      : null;
  if (legacyAssistantResultKind) return legacyAssistantResultKind;

  const assistantPlanKind =
    result.assistantPlan?.executionPath === 'client-artifact'
      ? result.assistantPlan.artifactKind
      : undefined;
  if (assistantPlanKind) {
    return {
      artifactKind: assistantPlanKind,
      decidedBy:
        result.assistantPlan?.decidedBy ??
        assistantPlanRouteDecision?.decidedBy ??
        'cloud-run',
    };
  }

  const assistantPlanRouteKind = readArtifactFromRouteDecision(
    assistantPlanRouteDecision,
    assistantPlanRouteDecision?.artifactKind
  );
  if (assistantPlanRouteKind) return assistantPlanRouteKind;

  const routeDecisionKind = readArtifactFromRouteDecision(
    resultRouteDecision,
    resultRouteDecision?.artifactKind
  );
  return routeDecisionKind ?? null;
}

function readArtifactFromRouteDecision(
  routeDecision: RouteDecision | undefined,
  artifactKind: RouteDecisionArtifactKind | undefined
): ResolvedPostDecisionArtifact | null {
  if (routeDecision?.executionPath !== 'client-artifact') return null;
  const resolvedKind = artifactKind ?? routeDecision.artifactKind;
  if (!resolvedKind) return null;
  return {
    artifactKind: resolvedKind,
    decidedBy: routeDecision.decidedBy,
  };
}

function createPostDecisionArtifactIntent(
  artifact: ResolvedPostDecisionArtifact,
  query: string
): ExecutableChatArtifactIntent | null {
  switch (artifact.artifactKind) {
    case 'incident-report':
    case 'monitoring-analysis':
      return withArtifactIntentRuleVersion(
        {
          kind: artifact.artifactKind,
          reason: POST_DECISION_REASON,
        },
        artifact.decidedBy
      ) as ExecutableChatArtifactIntent;
    case 'ops-procedure':
      return withArtifactIntentRuleVersion(
        {
          kind: 'ops-procedure',
          procedureType: 'script',
          reason: POST_DECISION_REASON,
        },
        artifact.decidedBy
      ) as ExecutableChatArtifactIntent;
    case 'server-monitoring-analysis':
      return createServerMonitoringPostDecisionIntent(
        query,
        artifact.decidedBy
      );
  }
}

function createServerMonitoringPostDecisionIntent(
  query: string,
  decidedBy: RouteDecisionDecider
): ExecutableChatArtifactIntent | null {
  const rawServerReference = query
    .match(SERVER_MONITORING_ID_PATTERN)?.[1]
    ?.toLowerCase();
  if (!rawServerReference) return null;

  const serverId =
    resolveRegisteredServerId(rawServerReference) ?? rawServerReference;
  return withArtifactIntentRuleVersion(
    {
      kind: 'server-monitoring-analysis',
      serverId,
      serverName: serverId,
      reason: 'server_monitoring_action_pattern',
    },
    decidedBy
  ) as ExecutableChatArtifactIntent;
}
