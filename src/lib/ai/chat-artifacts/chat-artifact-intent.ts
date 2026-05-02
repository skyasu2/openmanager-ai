export type ChatArtifactIntent =
  | { kind: 'none' }
  | { kind: 'incident-report'; reason: ChatArtifactIntentReason }
  | { kind: 'monitoring-analysis'; reason: ChatArtifactIntentReason }
  | {
      kind: 'guidance';
      target: 'incident-report' | 'monitoring-analysis';
      reason: ChatArtifactIntentReason;
    };

export type ChatArtifactIntentReason =
  | 'incident_report_action_pattern'
  | 'incident_report_guidance_pattern'
  | 'incident_report_implicit_keyword'
  | 'monitoring_action_pattern'
  | 'monitoring_guidance_pattern'
  | 'monitoring_implicit_artifact_keyword'
  | 'llm_artifact_classification'
  | 'llm_unavailable';

const REPORT_PATTERN =
  /(장애\s*(보고서|리포트|보고)|인시던트\s*(보고서|리포트)|incident\s*report)/i;
const REPORT_ACTION_PATTERN =
  /(작성(?!\s*(방법|법|기능|설명|안내))|생성(?!\s*(방법|법|기능|설명|안내))|만들|만들어|다운로드(?!\s*(방법|법|기능|설명|안내))|내려받|부탁|요청|뽑아|출력|export|generate|download)/i;
const REPORT_GUIDANCE_PATTERN =
  /(어떻게|방법|어디|기능|설명|안내|가능|사용법|뭐야|무엇|무슨|지원|되나|돼\?|될까)/i;

const MONITORING_PATTERN =
  /(이상\s*감지|이상감지|이상\s*탐지|추세|리스크\s*추세|예측|forecast|trend)/i;
const MONITORING_ACTION_PATTERN =
  /(분석\s*(해|해줘|해주세요|해줄래|부탁|요청)|분석해|실행|돌려|요약\s*(해|해줘|해주세요|해줄래|부탁|요청)|요약해|확인\s*(해|해줘|해주세요|해줄래|부탁|요청)|확인해|생성(?!\s*(방법|법|기능|설명|안내))|만들|다운로드(?!\s*(방법|법|기능|설명|안내))|예측\s*(해|해줘|해주세요|해줄래|부탁|요청)|예측해|forecast|analy[sz]e|run)/i;
const MONITORING_ARTIFACT_PATTERN =
  /(이상\s*감지|이상감지|이상\s*탐지|추세\s*(분석|리포트|보고서)|리스크\s*(추세|분석)|장애\s*(예측|예상)|예측\s*(분석|리포트|보고서)|forecast|trend\s*(analysis|report)?)/i;
const MONITORING_GUIDANCE_PATTERN =
  /(어떻게|방법|어디|기능|설명|안내|가능|사용법|뭐야|무엇|무슨|지원|되나|돼\?|될까)/i;
const LLM_ARTIFACT_CANDIDATE_PATTERN =
  /(장애|인시던트|incident|보고서|리포트|report|이상\s*(감지|탐지)|이상감지|추세|트렌드|리스크|예측|모니터링|anomaly|forecast|trend|risk)/i;
const LLM_ARTIFACT_ACTION_HINT_PATTERN =
  /(작성|생성|만들|부탁|요청|뽑아|출력|다운로드|내려받|실행|돌려|요약|확인|해줘|해주세요|해줄래|분석\s*(해|해줘|해주세요|좀|부탁|요청)|export|generate|download|create|write|analy[sz]e|run)/i;
const LLM_ARTIFACT_SHAPE_PATTERN =
  /(보고서|리포트|report|이상\s*감지|이상감지|이상\s*탐지|추세\s*(분석|리포트|보고서)|트렌드\s*분석|리스크\s*(추세|분석)|장애\s*(예측|예상)|예측\s*(분석|리포트|보고서)|forecast|trend\s*(analysis|report)|risk\s*analysis)/i;

function isImplicitKeywordRequest(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;

  return !/[?？]/.test(normalized);
}

export function classifyChatArtifactIntent(query: string): ChatArtifactIntent {
  const normalized = query.trim();
  if (!normalized) return { kind: 'none' };

  if (REPORT_PATTERN.test(normalized)) {
    if (REPORT_ACTION_PATTERN.test(normalized)) {
      return {
        kind: 'incident-report',
        reason: 'incident_report_action_pattern',
      };
    }
    if (REPORT_GUIDANCE_PATTERN.test(normalized)) {
      return {
        kind: 'guidance',
        target: 'incident-report',
        reason: 'incident_report_guidance_pattern',
      };
    }
    if (isImplicitKeywordRequest(normalized)) {
      return {
        kind: 'incident-report',
        reason: 'incident_report_implicit_keyword',
      };
    }
  }

  if (MONITORING_PATTERN.test(normalized)) {
    if (MONITORING_ACTION_PATTERN.test(normalized)) {
      return {
        kind: 'monitoring-analysis',
        reason: 'monitoring_action_pattern',
      };
    }
    if (MONITORING_GUIDANCE_PATTERN.test(normalized)) {
      return {
        kind: 'guidance',
        target: 'monitoring-analysis',
        reason: 'monitoring_guidance_pattern',
      };
    }
    // Bare "추세" is often a normal chat topic, so monitoring implicit routing
    // requires an artifact-shaped phrase while "장애보고서" remains actionable.
    if (
      MONITORING_ARTIFACT_PATTERN.test(normalized) &&
      isImplicitKeywordRequest(normalized)
    ) {
      return {
        kind: 'monitoring-analysis',
        reason: 'monitoring_implicit_artifact_keyword',
      };
    }
  }

  return { kind: 'none' };
}

export function shouldUseLLMChatArtifactIntent(query: string): boolean {
  const normalized = query.trim();
  if (!normalized) return false;
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
    if (!response.ok) return { kind: 'none' };
    const data = (await response.json()) as { kind?: string };
    if (data.kind === 'incident-report') {
      return { kind: 'incident-report', reason: 'llm_artifact_classification' };
    }
    if (data.kind === 'monitoring-analysis') {
      return {
        kind: 'monitoring-analysis',
        reason: 'llm_artifact_classification',
      };
    }
    return { kind: 'none' };
  } catch {
    return { kind: 'none' };
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
