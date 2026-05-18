import { resolveRegisteredServerId } from '@/config/server-registry';

export const ARTIFACT_INTENT_RULE_VERSION = '2026-05-15-v1';

type ChatArtifactIntentVersion = {
  ruleVersion: typeof ARTIFACT_INTENT_RULE_VERSION;
};

type ChatArtifactIntentWithoutVersion =
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
    }
  | {
      kind: 'guidance';
      target: 'incident-report' | 'monitoring-analysis';
      reason: ChatArtifactIntentReason;
    };

export type ChatArtifactIntent = ChatArtifactIntentWithoutVersion &
  ChatArtifactIntentVersion;

export type ChatArtifactIntentReason =
  | 'incident_report_action_pattern'
  | 'incident_report_guidance_pattern'
  | 'incident_report_implicit_keyword'
  | 'monitoring_action_pattern'
  | 'monitoring_guidance_pattern'
  | 'monitoring_implicit_artifact_keyword'
  | 'ops_procedure_action_pattern'
  | 'ops_procedure_followup_edit_pattern'
  | 'server_monitoring_action_pattern'
  | 'server_snapshot_action_pattern'
  | 'server_snapshot_implicit_artifact_keyword'
  | 'llm_artifact_classification'
  | 'llm_unavailable';

const ARTIFACT_NEGATION_PATTERN =
  /(말고|아니고|없이|나중에|필요\s*없|하지\s*마|하지\s*말|제외)/i;
const ARTIFACT_GUIDANCE_PRIORITY_PATTERN =
  /(어떻게|방법|어디|어떤|가능|사용법|뭐야|무엇|무슨|지원|되나|돼\?|될까|샘플|예시|화면|위치|보여줄\s*수)/i;
const ARTIFACT_GUIDANCE_PATTERN = /(기능|설명|안내)/i;
const ARTIFACT_FORMATTING_ONLY_PATTERN =
  /(보고서용|리포트용|문장으로|문장만|다시\s*작성|재작성|고쳐\s*써|다듬어|rewrite|rephrase|paraphrase)/i;
const ARTIFACT_EXPLICIT_EXECUTION_PATTERN =
  /(아티팩트|artifact|생성|만들|다운로드|내려받|실행|돌려|뽑아|출력|export|generate|download|create|run)/i;
const REPORT_PATTERN =
  /(장애\s*(보고서|리포트|보고)|인시던트\s*(보고서|리포트)|incident\s*report)/i;
const REPORT_ACTION_PATTERN =
  /(작성(?!\s*(방법|법|기능|설명|안내))|생성(?!\s*(방법|법|기능|설명|안내))|만들|만들어|다운로드(?!\s*(방법|법|기능|설명|안내))|내려받|부탁|요청|실행|돌려|뽑아|출력|export|generate|download|run)/i;

const MONITORING_PATTERN =
  /(이상\s*감지|이상감지|이상\s*탐지|추세|트렌드|리스크\s*(추세|분석)|예측|예상|anomaly|forecast|trend)/i;
const MONITORING_ACTION_PATTERN =
  /(분석\s*(해|해줘|해주세요|해줄래|좀|부탁|요청)|분석해|실행|돌려|요약\s*(해|해줘|해주세요|해줄래|부탁|요청)|요약해|확인\s*(해|해줘|해주세요|해줄래|부탁|요청)|확인해|생성(?!\s*(방법|법|기능|설명|안내))|만들|다운로드(?!\s*(방법|법|기능|설명|안내))|예측\s*(해|해줘|해주세요|해줄래|부탁|요청)|예측해|forecast|analy[sz]e|run)/i;
const MONITORING_ARTIFACT_PATTERN =
  /(이상\s*감지|이상감지|이상\s*탐지|추세\s*(분석|리포트|보고서)|트렌드\s*(분석|리포트|보고서)|리스크\s*(추세|분석)|장애\s*(예측|예상)|예측\s*(분석|리포트|보고서)|anomaly\s*detection|forecast|trend\s*(analysis|report)?)/i;
const SERVER_MONITORING_ID_PATTERN =
  /\b((?:api|web|db|cache|storage|lb|monitoring|batch|worker)-[a-z0-9]+(?:-[a-z0-9]+)*)\b/i;
const SERVER_SNAPSHOT_SUBJECT_PATTERN =
  /(서버\s*상태|인프라\s*상태|전체\s*인프라|운영\s*(현황|상태)|server\s*status|server\s*snapshot|infrastructure\s*status|operational\s*status)/i;
const SERVER_SNAPSHOT_ARTIFACT_PATTERN =
  /(스냅샷|상태\s*(카드|리포트|보고서)|현황\s*카드|요약\s*카드|snapshot|status\s*(card|report)|export)/i;
const SERVER_SNAPSHOT_ACTION_PATTERN =
  /(생성(?!\s*(방법|법|기능|설명|안내))|만들|만들어|보여줘|다운로드(?!\s*(방법|법|기능|설명|안내))|내려받|요청|뽑아|출력|export|generate|download|create)/i;
const OPS_PROCEDURE_OPERATIONAL_CONTEXT_PATTERN =
  /(서버|인프라|운영|모니터링|장애|로그|에러|경고|cpu|메모리|memory|디스크|disk|네트워크|network|promql|prometheus|alertmanager|slack|슬랙|webhook|runbook|런북)/i;
const OPS_PROCEDURE_SHAPE_PATTERN =
  /(스크립트|script|bash|shell|쉘|slack|슬랙|webhook|alertmanager|prometheus|promql|알림\s*(규칙|설정|스크립트)?|runbook|런북|대응\s*(순서|절차)|원인과\s*대응|확인\s*명령어)/i;
const OPS_PROCEDURE_ACTION_PATTERN =
  /(짜줘|작성|생성|만들|만들어|알려줘|정리|출력|generate|create|write|build|draft)/i;
const OPS_PROCEDURE_FOLLOWUP_EDIT_PATTERN =
  /(이\s*)?(스크립트|설정|룰|rule|runbook|런북|절차).*(임계치|임계값|threshold).*(바꿔|변경|수정|올려|낮춰|change|update)/i;
const LLM_ARTIFACT_CANDIDATE_PATTERN =
  /(장애|인시던트|incident|보고서|리포트|report|이상\s*(감지|탐지)|이상감지|추세|트렌드|리스크|예측|모니터링|anomaly|forecast|trend|risk)/i;
const LLM_ARTIFACT_ACTION_HINT_PATTERN =
  /(작성|생성|만들|부탁|요청|뽑아|출력|다운로드|내려받|실행|돌려|요약|확인|해줘|해주세요|해줄래|분석\s*(해|해줘|해주세요|좀|부탁|요청)|export|generate|download|create|write|analy[sz]e|run)/i;
const LLM_ARTIFACT_SHAPE_PATTERN =
  /(보고서|리포트|report|이상\s*감지|이상감지|이상\s*탐지|추세\s*(분석|리포트|보고서)|트렌드\s*(분석|리포트|보고서)|리스크\s*(추세|분석)|장애\s*(예측|예상)|예측\s*(분석|리포트|보고서)|anomaly\s*detection|forecast|trend\s*(analysis|report)|risk\s*analysis)/i;

function withRuleVersion(
  intent: ChatArtifactIntentWithoutVersion
): ChatArtifactIntent {
  return { ...intent, ruleVersion: ARTIFACT_INTENT_RULE_VERSION };
}

function isImplicitKeywordRequest(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;

  return !/[?？]/.test(normalized);
}

function isFormattingOnlyRequest(query: string): boolean {
  return (
    ARTIFACT_FORMATTING_ONLY_PATTERN.test(query) &&
    !ARTIFACT_EXPLICIT_EXECUTION_PATTERN.test(query)
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
  return (
    MONITORING_ACTION_PATTERN.test(query) ||
    (MONITORING_ARTIFACT_PATTERN.test(query) && isImplicitKeywordRequest(query))
  );
}

export function classifyChatArtifactIntent(query: string): ChatArtifactIntent {
  const normalized = query.trim();
  if (!normalized) return withRuleVersion({ kind: 'none' });

  const isNegated = ARTIFACT_NEGATION_PATTERN.test(normalized);

  if (isFormattingOnlyRequest(normalized)) {
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

  if (
    SERVER_SNAPSHOT_SUBJECT_PATTERN.test(normalized) &&
    SERVER_SNAPSHOT_ARTIFACT_PATTERN.test(normalized)
  ) {
    if (
      ARTIFACT_GUIDANCE_PRIORITY_PATTERN.test(normalized) ||
      ARTIFACT_GUIDANCE_PATTERN.test(normalized)
    ) {
      return withRuleVersion({ kind: 'none' });
    }
    if (!isNegated && SERVER_SNAPSHOT_ACTION_PATTERN.test(normalized)) {
      return withRuleVersion({
        kind: 'server-snapshot',
        reason: 'server_snapshot_action_pattern',
      });
    }
    if (!isNegated && isImplicitKeywordRequest(normalized)) {
      return withRuleVersion({
        kind: 'server-snapshot',
        reason: 'server_snapshot_implicit_artifact_keyword',
      });
    }
  }

  const serverMonitoringServerId = readServerMonitoringServerId(normalized);
  if (serverMonitoringServerId && MONITORING_PATTERN.test(normalized)) {
    if (
      ARTIFACT_GUIDANCE_PRIORITY_PATTERN.test(normalized) ||
      ARTIFACT_GUIDANCE_PATTERN.test(normalized)
    ) {
      return withRuleVersion({
        kind: 'guidance',
        target: 'monitoring-analysis',
        reason: 'monitoring_guidance_pattern',
      });
    }
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
    if (ARTIFACT_GUIDANCE_PRIORITY_PATTERN.test(normalized)) {
      return withRuleVersion({
        kind: 'guidance',
        target: 'incident-report',
        reason: 'incident_report_guidance_pattern',
      });
    }
    if (!isNegated && REPORT_ACTION_PATTERN.test(normalized)) {
      return withRuleVersion({
        kind: 'incident-report',
        reason: 'incident_report_action_pattern',
      });
    }
    if (ARTIFACT_GUIDANCE_PATTERN.test(normalized)) {
      return withRuleVersion({
        kind: 'guidance',
        target: 'incident-report',
        reason: 'incident_report_guidance_pattern',
      });
    }
    if (!isNegated && isImplicitKeywordRequest(normalized)) {
      return withRuleVersion({
        kind: 'incident-report',
        reason: 'incident_report_implicit_keyword',
      });
    }
  }

  if (MONITORING_PATTERN.test(normalized)) {
    if (ARTIFACT_GUIDANCE_PRIORITY_PATTERN.test(normalized)) {
      return withRuleVersion({
        kind: 'guidance',
        target: 'monitoring-analysis',
        reason: 'monitoring_guidance_pattern',
      });
    }
    if (!isNegated && MONITORING_ACTION_PATTERN.test(normalized)) {
      return withRuleVersion({
        kind: 'monitoring-analysis',
        reason: 'monitoring_action_pattern',
      });
    }
    if (ARTIFACT_GUIDANCE_PATTERN.test(normalized)) {
      return withRuleVersion({
        kind: 'guidance',
        target: 'monitoring-analysis',
        reason: 'monitoring_guidance_pattern',
      });
    }
    // Bare "추세" is often a normal chat topic, so monitoring implicit routing
    // requires an artifact-shaped phrase while "장애보고서" remains actionable.
    if (
      !isNegated &&
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

export async function fetchLLMChatArtifactIntent(
  query: string,
  signal?: AbortSignal
): Promise<ChatArtifactIntent> {
  try {
    const response = await fetch('/api/ai/artifact-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ query }),
    });
    if (!response.ok) return withRuleVersion({ kind: 'none' });
    const data = (await response.json()) as { kind?: string };
    if (data.kind === 'incident-report') {
      return withRuleVersion({
        kind: 'incident-report',
        reason: 'llm_artifact_classification',
      });
    }
    if (data.kind === 'monitoring-analysis') {
      return withRuleVersion({
        kind: 'monitoring-analysis',
        reason: 'llm_artifact_classification',
      });
    }
    return withRuleVersion({ kind: 'none' });
  } catch {
    return withRuleVersion({ kind: 'none' });
  }
}

export function createArtifactGuidanceMessage(
  target: 'incident-report' | 'monitoring-analysis'
): string {
  if (target === 'incident-report') {
    return [
      '장애 보고서 작성 기능은 사용자가 명시적으로 요청할 때만 실행합니다.',
      '예: "장애 보고서 작성해줘", "현재 장애 리포트를 MD로 다운로드하게 만들어줘"',
      '요청하면 기존 장애 보고서 작성 기능을 1회 실행하고, 채팅에 다운로드 가능한 보고서 아티팩트로 보여드립니다.',
    ].join('\n');
  }

  return [
    '이상감지/추세 기능은 사용자가 명시적으로 요청할 때만 실행합니다.',
    '예: "전체 서버 이상감지 돌려줘", "최근 추세 기준으로 리스크 분석해줘"',
    '요청하면 기존 이상감지/추세 분석을 1회 실행하고, 채팅에 다운로드 가능한 분석 아티팩트로 보여드립니다.',
  ].join('\n');
}
