import { intentPatterns } from '@/config/intent-rules';
import { resolveRegisteredServerId } from '@/config/server-registry';
import {
  type ChatArtifactIntent,
  type ChatArtifactIntentWithoutVersion,
  withArtifactIntentRuleVersion,
} from '@/lib/ai/chat-artifacts/artifact-intent-contract';

const ARTIFACT_NEGATION_PATTERN = intentPatterns.pattern('artifact_negation');
const ARTIFACT_FORMATTING_ONLY_PATTERN = intentPatterns.pattern(
  'artifact_formatting_only'
);
const ARTIFACT_EXPLICIT_EXECUTION_PATTERN = intentPatterns.pattern(
  'artifact_explicit_execution'
);
const ARTIFACT_HOW_TO_REQUEST_PATTERN = intentPatterns.pattern(
  'artifact_how_to_request'
);
const REPORT_PATTERN = intentPatterns.pattern('incident_report');
const REPORT_ACTION_PATTERN = intentPatterns.pattern('incident_report_action');
const MONITORING_PATTERN = intentPatterns.pattern('monitoring');
const CAPACITY_FORECAST_EXCLUSION_PATTERN = intentPatterns.pattern(
  'capacity_forecast_exclusion'
);
const MONITORING_ACTION_PATTERN = intentPatterns.pattern('monitoring_action');
const MONITORING_ARTIFACT_PATTERN = intentPatterns.pattern(
  'monitoring_artifact'
);
const WHOLE_SYSTEM_MONITORING_PATTERN = intentPatterns.pattern(
  'whole_system_monitoring'
);
const SERVER_MONITORING_ID_PATTERN = intentPatterns.serverId();
const OPS_PROCEDURE_OPERATIONAL_CONTEXT_PATTERN = intentPatterns.pattern(
  'ops_procedure_operational_context'
);
const OPS_PROCEDURE_SHAPE_PATTERN = intentPatterns.pattern(
  'ops_procedure_shape'
);
const OPS_PROCEDURE_ACTION_PATTERN = intentPatterns.pattern(
  'ops_procedure_action'
);
const OPS_PROCEDURE_FOLLOWUP_EDIT_PATTERN = intentPatterns.pattern(
  'ops_procedure_followup_edit'
);
const LLM_ARTIFACT_CANDIDATE_PATTERN = intentPatterns.pattern(
  'llm_artifact_candidate'
);
const LLM_ARTIFACT_ACTION_HINT_PATTERN = intentPatterns.pattern(
  'llm_artifact_action_hint'
);
const LLM_ARTIFACT_SHAPE_PATTERN = intentPatterns.pattern('llm_artifact_shape');

function withRuleVersion(
  intent: ChatArtifactIntentWithoutVersion
): ChatArtifactIntent {
  return withArtifactIntentRuleVersion(intent, 'bff');
}

function isImplicitKeywordRequest(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;

  return !/[?？]/.test(normalized);
}

/**
 * 방법을 묻는 쿼리인지 판단 — artifact 실행이 아닌 안내/탐색 의도.
 * "기능"은 제외: "기능 실행해줘"처럼 실행 요청에도 등장하므로 별도 처리.
 */
function isHowToRequest(query: string): boolean {
  return ARTIFACT_HOW_TO_REQUEST_PATTERN.test(query);
}

function isFormattingOnlyRequest(query: string): boolean {
  return (
    ARTIFACT_FORMATTING_ONLY_PATTERN.test(query) &&
    !ARTIFACT_EXPLICIT_EXECUTION_PATTERN.test(query)
  );
}

// Cloud Run AI engine의 isServiceCommandGuidanceQuery와 parity를 이루어야 한다
// (src/app/api/ai/artifact-intent/command-guidance-parity.test.ts 참조). 프론트가
// 명령어 질의를 아티팩트 라우팅에서 제외하면, engine이 반드시 명령어 응답을
// 반환해야 "아티팩트도 명령어도 없는" 낙하가 발생하지 않는다.
export function isCommandGuidanceRequest(query: string): boolean {
  return (
    /(?:확인\s*)?명령어|commands?|cli|redis-cli|mysqladmin|psql|kubectl|docker|journalctl|systemctl|grep|awk/i.test(
      query
    ) &&
    /redis|mysql|postgres|postgresql|nginx|nfs|haproxy|s3gw|minio|서버|서비스|로그|log|에러|error|5xx|cpu|메모리|memory|디스크|disk|캐시|cache/i.test(
      query
    )
  );
}

function readOpsProcedureType(
  query: string
): 'runbook' | 'alert-rule' | 'script' {
  if (
    /alertmanager|prometheus|alert\s*rule|알림\s*(규칙|설정)|yaml/i.test(query)
  ) {
    return 'alert-rule';
  }
  if (
    /runbook|런북|대응\s*(순서|절차)|원인과\s*대응|로그.*(원인|대응)/i.test(
      query
    )
  ) {
    return 'runbook';
  }
  return 'script';
}

function isOpsProcedureRequest(query: string): boolean {
  return (
    OPS_PROCEDURE_OPERATIONAL_CONTEXT_PATTERN.test(query) &&
    OPS_PROCEDURE_SHAPE_PATTERN.test(query) &&
    OPS_PROCEDURE_ACTION_PATTERN.test(query)
  );
}

function readServerMonitoringServerId(query: string): string | undefined {
  const rawServerReference = query
    .match(SERVER_MONITORING_ID_PATTERN)?.[1]
    ?.toLowerCase();
  if (!rawServerReference) return undefined;

  return resolveRegisteredServerId(rawServerReference) ?? rawServerReference;
}

function isServerMonitoringArtifactRequest(query: string): boolean {
  if (CAPACITY_FORECAST_EXCLUSION_PATTERN.test(query)) return false;
  if (isHowToRequest(query)) return false;
  return (
    MONITORING_ACTION_PATTERN.test(query) ||
    (MONITORING_ARTIFACT_PATTERN.test(query) && isImplicitKeywordRequest(query))
  );
}

export function classifyChatArtifactIntent(query: string): ChatArtifactIntent {
  const normalized = query.trim();
  if (!normalized) return withRuleVersion({ kind: 'none' });

  const isNegated = ARTIFACT_NEGATION_PATTERN.test(normalized);
  const isCapacityForecastRequest =
    CAPACITY_FORECAST_EXCLUSION_PATTERN.test(normalized);

  if (isFormattingOnlyRequest(normalized)) {
    return withRuleVersion({ kind: 'none' });
  }

  if (isCommandGuidanceRequest(normalized)) {
    return withRuleVersion({ kind: 'none' });
  }

  if (OPS_PROCEDURE_FOLLOWUP_EDIT_PATTERN.test(normalized)) {
    return withRuleVersion({
      kind: 'ops-procedure',
      procedureType: readOpsProcedureType(normalized),
      reason: 'ops_procedure_followup_edit_pattern',
    });
  }

  if (!isNegated && isOpsProcedureRequest(normalized)) {
    return withRuleVersion({
      kind: 'ops-procedure',
      procedureType: readOpsProcedureType(normalized),
      reason: 'ops_procedure_action_pattern',
    });
  }

  const serverMonitoringServerId = readServerMonitoringServerId(normalized);
  if (
    serverMonitoringServerId &&
    MONITORING_PATTERN.test(normalized) &&
    !WHOLE_SYSTEM_MONITORING_PATTERN.test(normalized)
  ) {
    if (!isNegated && isServerMonitoringArtifactRequest(normalized)) {
      return withRuleVersion({
        kind: 'server-monitoring-analysis',
        serverId: serverMonitoringServerId,
        serverName: serverMonitoringServerId,
        reason: 'server_monitoring_action_pattern',
      });
    }
  }

  if (REPORT_PATTERN.test(normalized)) {
    if (
      !isNegated &&
      !isHowToRequest(normalized) &&
      REPORT_ACTION_PATTERN.test(normalized)
    ) {
      return withRuleVersion({
        kind: 'incident-report',
        reason: 'incident_report_action_pattern',
      });
    }
    if (
      !isNegated &&
      !isHowToRequest(normalized) &&
      isImplicitKeywordRequest(normalized)
    ) {
      return withRuleVersion({
        kind: 'incident-report',
        reason: 'incident_report_implicit_keyword',
      });
    }
  }

  if (MONITORING_PATTERN.test(normalized) && !isCapacityForecastRequest) {
    if (
      !isNegated &&
      !isHowToRequest(normalized) &&
      MONITORING_ACTION_PATTERN.test(normalized)
    ) {
      return withRuleVersion({
        kind: 'monitoring-analysis',
        reason: 'monitoring_action_pattern',
      });
    }
    // Bare "추세" is often a normal chat topic, so monitoring implicit routing
    // requires an artifact-shaped phrase while "장애보고서" remains actionable.
    if (
      !isNegated &&
      !isHowToRequest(normalized) &&
      MONITORING_ARTIFACT_PATTERN.test(normalized) &&
      isImplicitKeywordRequest(normalized)
    ) {
      return withRuleVersion({
        kind: 'monitoring-analysis',
        reason: 'monitoring_implicit_artifact_keyword',
      });
    }
  }

  return withRuleVersion({ kind: 'none' });
}

export function shouldUseLLMChatArtifactIntent(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;
  if (ARTIFACT_NEGATION_PATTERN.test(normalized)) return false;
  if (isFormattingOnlyRequest(normalized)) return false;
  if (isCommandGuidanceRequest(normalized)) return false;
  if (
    OPS_PROCEDURE_FOLLOWUP_EDIT_PATTERN.test(normalized) ||
    isOpsProcedureRequest(normalized) ||
    (readServerMonitoringServerId(normalized) &&
      MONITORING_PATTERN.test(normalized))
  ) {
    return false;
  }
  if (!LLM_ARTIFACT_CANDIDATE_PATTERN.test(normalized)) return false;
  if (LLM_ARTIFACT_ACTION_HINT_PATTERN.test(normalized)) return true;

  return (
    LLM_ARTIFACT_SHAPE_PATTERN.test(normalized) &&
    isImplicitKeywordRequest(normalized)
  );
}
