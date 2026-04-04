/**
 * Shared query routing signals used by supervisor mode selection
 * and multi-agent pre-filtering.
 */

export const INFRA_CONTEXT_PATTERN =
  /서버|서벼|썹|인프라|시스템|시스탬|모니터링|cpu|씨피유|메모리|메머리|멤|디스크|트래픽|네트워크|server|servr|sever|memory|memroy|disk|traffic|network|latency|response|load/i;

export const ANALYST_QUERY_PATTERN =
  /이상|분석|예측|트렌드|패턴|원인|왜|상관관계|근본\s*원인|rca/i;

export const REPORTER_QUERY_PATTERN =
  /보고서|리포트|타임라인|인시던트|incident/i;

export const ADVISOR_QUERY_PATTERN =
  /해결|방법|명령어|가이드|어떻게|과거.*사례|사례.*찾|이력|유사|권장\s*조치/i;

export const COMPOSITE_QUERY_PATTERNS = [
  /그리고|또한|동시에|함께|및|plus|and|then/i,
  /비교|대비|차이|compared?|versus|vs\.?/i,
  /원인.*해결|해결.*원인|분석.*조치|조치.*분석/i,
];
