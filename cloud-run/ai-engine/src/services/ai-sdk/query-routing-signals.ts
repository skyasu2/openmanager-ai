/**
 * Shared query routing signals used by supervisor mode selection
 * and multi-agent pre-filtering.
 */

export const INFRA_CONTEXT_PATTERN =
  /서버|서벼|썹|인프라|시스템|시스탬|모니터링|cpu|씨피유|메모리|메머리|멤|디스크|트래픽|네트워크|server|servr|sever|memory|memroy|disk|traffic|network|latency|response|load/i;

export const ANALYST_QUERY_PATTERN =
  /이상|비정상|분석|예측|트렌드|패턴|원인|왜|상관관계|근본\s*원인|rca|고장|느려|다운|안\s*됨|안됨|장애/i;

export const REPORTER_QUERY_PATTERN =
  /보고서|리포트|타임라인|인시던트|incident/i;

const FORMATTING_ONLY_TARGET_PATTERN =
  /(보고서용|리포트용|문장으로|문장만|마크다운|markdown|bullet|불릿|rewrite|rephrase|paraphrase)/i;
const FORMATTING_ONLY_ACTION_PATTERN =
  /(방금|위\s*내용|이전\s*(결과|답변)|결과|답변|다시\s*작성|재작성|고쳐\s*써|다듬어|줄여|바꿔|정리해|rewrite|rephrase|paraphrase)/i;
const FORMATTING_ONLY_EXECUTION_PATTERN =
  /(아티팩트|artifact|생성|만들|다운로드|내려받|실행|돌려|뽑아|export|generate|download|create|run)/i;

export function isFormattingOnlyReportRequest(query: string): boolean {
  const normalizedQuery = query.toLowerCase().trim();
  return (
    FORMATTING_ONLY_TARGET_PATTERN.test(normalizedQuery) &&
    FORMATTING_ONLY_ACTION_PATTERN.test(normalizedQuery) &&
    !FORMATTING_ONLY_EXECUTION_PATTERN.test(normalizedQuery)
  );
}

export const ADVISOR_QUERY_PATTERN =
  /해결|방법|명령어|가이드|어떻게|과거.*사례|사례.*찾|이력|유사|권장\s*조치/i;

export const FORCE_KB_QUERY_PATTERN =
  /토폴로지|topology|아키텍처|architecture|구성도|배치도|인프라\s*(구성|배치|토폴로지|architecture|topology)/i;

export const COMPOSITE_QUERY_PATTERNS = [
  /그리고|또한|동시에|함께|및|plus|and|then/i,
  /비교|대비|차이|compared?|versus|vs\.?/i,
  /원인.*해결|해결.*원인|분석.*조치|조치.*분석/i,
];
