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
 * 예: "부하 가장 낮은 서버", "CPU 최저 서버", "가장 여유 있는 서버"
 * Merged from query-routing-signals + orchestrator-query-intent.
 */
export const MIN_METRIC_PATTERN =
  /(?:가장\s*(?:낮은|적은|여유|안전|idle)|(?:부하|로드|load)\s*(?:가장\s*)?(?:낮은|적은|최저|최소)|(?:최저|최소|min(?:imum)?)\s*(?:cpu|메모리|memory|디스크|disk|부하|load)|(?:여유\s*(?:많은|있는)|idle).*서버|lowest\s*(?:load|cpu|memory|disk)|least\s*(?:loaded|busy))/i;
