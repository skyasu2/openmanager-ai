/**
 * Shared routing signal patterns.
 *
 * Single source of truth for patterns that appear in both
 * query-routing-signals.ts and orchestrator-query-intent.ts.
 */

/**
 * 역방향 필터: 임계값 이하(정상 범위) 서버를 요청하는 쿼리
 * 예: "정상 범위인 서버 목록", "이상 없는 서버", "문제 없는 서버"
 */
export const INVERSE_STATUS_PATTERN =
  /(?:정상\s*(?:범위(?:\s*인)?|인)\s*(?:서버|목록)|이상\s*(?:없는|없음|없어)\s*(?:서버|것|게)|문제\s*(?:없는|없음|없어)\s*(?:서버|것|게)|여유\s*(?:있는|있어|있음)\s*(?:서버|것)|safe\s*server|healthy\s*server|normal\s*(?:range|server))/i;

/**
 * 최솟값 랭킹: 부하/메트릭이 가장 낮은 서버를 요청하는 쿼리
 * 예: "부하 가장 낮은 서버", "CPU 최저 서버", "가장 여유 있는 서버", "가장 안정적인 서버"
 * Merged from query-routing-signals + orchestrator-query-intent.
 */
export const MIN_METRIC_PATTERN =
  /(?:가장\s*(?:낮은|적은|여유|안전|안정(?:적(?:인)?)?|(?<!비)효율|idle)|(?:부하|로드|load)\s*(?:가장\s*)?(?:낮은|적은|최저|최소)|(?:최저|최소|min(?:imum)?)\s*(?:cpu|메모리|memory|디스크|disk|부하|load)|(?:여유\s*(?:많은|있는)|(?<!비)효율(?:적|적인)?|idle).*서버|lowest\s*(?:load|cpu|memory|disk)|least\s*(?:loaded|busy)|most\s+efficient\s+server)/i;

/**
 * 시간 창이 붙은 용량 포화 예측 표현.
 * 예: "48시간 이내에 디스크 꽉 찰까?", "2일 안에 storage disk 가득 찰까?"
 */
export const CAPACITY_FULL_FORECAST_PATTERN =
  /(?:\d{1,3}\s*(?:분|시간|일|주|개월)\s*(?:이내|안에|내|후|뒤|까지).{0,48}(?:꽉|가득|다)\s*(?:찰|차|찬|참)|(?:꽉|가득|다)\s*(?:찰|차|찬|참).{0,48}\d{1,3}\s*(?:분|시간|일|주|개월)\s*(?:이내|안에|내|후|뒤|까지))/i;

/**
 * 재시작 필요 여부 조회: 실행 방법이 아니라 "어떤 서버가 재시작/즉시 조치 대상인가"를 묻는 쿼리
 * 예: "재시작해야 할 서버 있어?", "재시작이 필요한 서버", "재시작이 필요해?"
 */
export const RESTART_NEEDED_LOOKUP_PATTERN =
  /(?:(?:재시작|restart).{0,16}(?:필요|해야\s*할?|대상|권장|추천|need(?:ed)?).{0,24}(?:서버|대상|있|목록|servers?)?|(?:서버|대상|servers?).{0,24}(?:재시작|restart).{0,16}(?:필요|대상|권장|추천|need(?:ed)?))/i;

const RESTART_PROCEDURE_PATTERN =
  /명령어|커맨드|cli|방법|어떻게|순서|절차|스크립트|script|runbook|런북|command/i;

export function isRestartNeededLookupQuery(query: string): boolean {
  return (
    RESTART_NEEDED_LOOKUP_PATTERN.test(query) &&
    !RESTART_PROCEDURE_PATTERN.test(query)
  );
}
