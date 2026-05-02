export type ChatArtifactIntent =
  | { kind: 'none' }
  | { kind: 'incident-report' }
  | { kind: 'monitoring-analysis' }
  | {
      kind: 'guidance';
      target: 'incident-report' | 'monitoring-analysis';
    };

const REPORT_PATTERN =
  /(장애\s*(보고서|리포트|보고)|인시던트\s*(보고서|리포트)|incident\s*report)/i;
const REPORT_ACTION_PATTERN =
  /(작성|생성|만들|만들어|다운로드|내려받|md|markdown|파일|export|generate|download)/i;
const REPORT_GUIDANCE_PATTERN = /(어떻게|방법|어디|기능|설명|안내|가능)/i;

const MONITORING_PATTERN =
  /(이상\s*감지|이상감지|이상\s*탐지|추세|리스크\s*추세|예측|forecast|trend)/i;
const MONITORING_ACTION_PATTERN =
  /(분석|실행|돌려|요약|확인|생성|만들|다운로드|리포트|보고서|analy[sz]e|run)/i;
const MONITORING_GUIDANCE_PATTERN = /(어떻게|방법|어디|기능|설명|안내|가능)/i;

export function classifyChatArtifactIntent(query: string): ChatArtifactIntent {
  const normalized = query.trim();
  if (!normalized) return { kind: 'none' };

  if (REPORT_PATTERN.test(normalized)) {
    if (REPORT_ACTION_PATTERN.test(normalized)) {
      return { kind: 'incident-report' };
    }
    if (REPORT_GUIDANCE_PATTERN.test(normalized)) {
      return { kind: 'guidance', target: 'incident-report' };
    }
  }

  if (MONITORING_PATTERN.test(normalized)) {
    if (MONITORING_ACTION_PATTERN.test(normalized)) {
      return { kind: 'monitoring-analysis' };
    }
    if (MONITORING_GUIDANCE_PATTERN.test(normalized)) {
      return { kind: 'guidance', target: 'monitoring-analysis' };
    }
  }

  return { kind: 'none' };
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
