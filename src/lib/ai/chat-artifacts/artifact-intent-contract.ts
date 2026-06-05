import type { RouteDecisionDecider } from '@/lib/ai/route-decision';

export const ARTIFACT_INTENT_RULE_VERSION = '2026-05-15-v1';

type ChatArtifactIntentVersion = {
  ruleVersion: typeof ARTIFACT_INTENT_RULE_VERSION;
};

export type ChatArtifactIntentReason =
  | 'incident_report_action_pattern'
  | 'incident_report_implicit_keyword'
  | 'monitoring_action_pattern'
  | 'monitoring_implicit_artifact_keyword'
  | 'ops_procedure_action_pattern'
  | 'ops_procedure_followup_edit_pattern'
  | 'server_monitoring_action_pattern'
  | 'server_snapshot_action_pattern'
  | 'server_snapshot_implicit_artifact_keyword'
  | 'llm_artifact_classification'
  | 'llm_unavailable';

export type ChatArtifactIntentWithoutVersion =
  | { kind: 'none' }
  | { kind: 'incident-report'; reason: ChatArtifactIntentReason }
  | { kind: 'monitoring-analysis'; reason: ChatArtifactIntentReason }
  | {
      kind: 'server-monitoring-analysis';
      serverId: string;
      serverName?: string;
      reason: ChatArtifactIntentReason;
    }
  | { kind: 'server-snapshot'; reason: ChatArtifactIntentReason }
  | {
      kind: 'ops-procedure';
      procedureType: 'runbook' | 'alert-rule' | 'script';
      reason: ChatArtifactIntentReason;
    };

export type ChatArtifactIntentWithVersion<
  T extends ChatArtifactIntentWithoutVersion,
> = T &
  ChatArtifactIntentVersion & {
    decidedBy?: RouteDecisionDecider;
  };

export type ChatArtifactIntent =
  ChatArtifactIntentWithoutVersion extends infer Intent
    ? Intent extends ChatArtifactIntentWithoutVersion
      ? ChatArtifactIntentWithVersion<Intent>
      : never
    : never;

export type ExecutableChatArtifactIntent = Extract<
  ChatArtifactIntent,
  {
    kind:
      | 'incident-report'
      | 'monitoring-analysis'
      | 'server-monitoring-analysis'
      | 'server-snapshot'
      | 'ops-procedure';
  }
>;

const CHAT_ARTIFACT_INTENT_REASONS = new Set<ChatArtifactIntentReason>([
  'incident_report_action_pattern',
  'incident_report_implicit_keyword',
  'monitoring_action_pattern',
  'monitoring_implicit_artifact_keyword',
  'ops_procedure_action_pattern',
  'ops_procedure_followup_edit_pattern',
  'server_monitoring_action_pattern',
  'server_snapshot_action_pattern',
  'server_snapshot_implicit_artifact_keyword',
  'llm_artifact_classification',
  'llm_unavailable',
]);

const PROCEDURE_TYPES = new Set(['runbook', 'alert-rule', 'script']);

export function withArtifactIntentRuleVersion<
  T extends ChatArtifactIntentWithoutVersion,
>(
  intent: T,
  decidedBy?: RouteDecisionDecider
): ChatArtifactIntentWithVersion<T> {
  return {
    ...intent,
    ruleVersion: ARTIFACT_INTENT_RULE_VERSION,
    ...(decidedBy && { decidedBy }),
  } as ChatArtifactIntentWithVersion<T>;
}

export function normalizeChatArtifactIntent(
  value: unknown,
  fallbackDecider?: RouteDecisionDecider
): ChatArtifactIntent {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return withArtifactIntentRuleVersion({ kind: 'none' }, fallbackDecider);
  }

  const record = value as Record<string, unknown>;
  const decidedBy = readDecider(record.decidedBy) ?? fallbackDecider;
  const reason = readReason(record.reason);

  switch (record.kind) {
    case 'incident-report':
    case 'monitoring-analysis':
    case 'server-snapshot':
      return withArtifactIntentRuleVersion(
        {
          kind: record.kind,
          reason: reason ?? 'llm_artifact_classification',
        },
        decidedBy
      );
    case 'server-monitoring-analysis': {
      const serverId = readNonEmptyString(record.serverId);
      if (!serverId) {
        return withArtifactIntentRuleVersion({ kind: 'none' }, decidedBy);
      }
      const serverName = readNonEmptyString(record.serverName);
      return withArtifactIntentRuleVersion(
        {
          kind: 'server-monitoring-analysis',
          serverId,
          ...(serverName && { serverName }),
          reason: reason ?? 'server_monitoring_action_pattern',
        },
        decidedBy
      );
    }
    case 'ops-procedure': {
      const procedureType =
        typeof record.procedureType === 'string' &&
        PROCEDURE_TYPES.has(record.procedureType)
          ? record.procedureType
          : 'script';
      return withArtifactIntentRuleVersion(
        {
          kind: 'ops-procedure',
          procedureType: procedureType as 'runbook' | 'alert-rule' | 'script',
          reason: reason ?? 'ops_procedure_action_pattern',
        },
        decidedBy
      );
    }
    default:
      return withArtifactIntentRuleVersion({ kind: 'none' }, decidedBy);
  }
}

function readReason(value: unknown): ChatArtifactIntentReason | undefined {
  return typeof value === 'string' &&
    CHAT_ARTIFACT_INTENT_REASONS.has(value as ChatArtifactIntentReason)
    ? (value as ChatArtifactIntentReason)
    : undefined;
}

function readDecider(value: unknown): RouteDecisionDecider | undefined {
  return value === 'frontend' || value === 'bff' || value === 'cloud-run'
    ? value
    : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}
