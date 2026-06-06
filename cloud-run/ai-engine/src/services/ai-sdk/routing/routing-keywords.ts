/** 인프라/서버 컨텍스트 감지 패턴 */
export const INFRA_CONTEXT_PATTERN =
  /서버|서벼|썹|인프라|시스템|시스탬|모니터링|당직|알림|알람|로그|마운트|백엔드|로드\s*밸런서|캐시|스토리지|징후|cpu|씨피유|메모리|메머리|멤|디스크|트래픽|네트워크|부하|로드|구역|영역|위치|az|zone|haproxy|nginx|mysql|redis|nfs|primary|replica|server|servr|sever|memory|memori|memroy|disk|traffic|network|latency|response|load|backend|mount/i;

/** 이상감지·RCA·분석 의도 패턴 */
export const ANALYST_QUERY_PATTERN =
  /이상|비정상|징후|분석|예측|트렌드|패턴|원인|왜|이유|때문|상관관계|근본\s*원인|rca|root\s*cause|\bwhy\b|\breason\b|\bcause\b|고장|느려|다운|안\s*됨|안됨|장애/i;

/** 보고서·타임라인 요청 패턴 */
export const REPORTER_QUERY_PATTERN =
  /보고서|리포트|타임라인|인시던트|incident/i;

/** 운영 조언·가이드 요청 패턴 */
export const ADVISOR_QUERY_PATTERN =
  /해결|방법|명령어|가이드|어떻게|해야|뭘\s*해야|무엇을\s*해야|순서|점검|확인하고|조언|개선|튜닝|최적화|스크립트|script|bash|shell|slack|슬랙|webhook|alertmanager|prometheus|runbook|런북|재마운트|remount|how\s+to\s+(fix|resolve|solve)|troubleshoot|과거.*사례|사례.*찾|이력|유사|권장\s*조치/i;

/** KB·토폴로지·내부 문서 강제 조회 패턴 */
export const FORCE_KB_QUERY_PATTERN =
  /토폴로지|topology|아키텍처|architecture|구성도|배치도|인프라\s*(구성|배치|토폴로지|architecture|topology)|ssot|single\s*source\s*of\s*truth|pre-generated|krl|knowledge\s*retrieval|책임\s*경계|플랫폼\s*경계|platform\s*boundary|(?:vercel|bff|cloud\s*run|ai\s*engine).*(?:책임|경계|boundary|bff|cloud\s*run|ai\s*engine)|(?:프로젝트|저장소|repo|repository|코드|문서|내부).*(?:파일|경로|위치|path|문서)|(?:otel|데이터).*(?:파일|경로|위치|path|ssot)|(?:redis|레디스).{0,32}(?:설정|config|redis\.conf|maxmemory|eviction|영속화).{0,32}(?:가이드|방법|문서|guide|how\s+to|설명)|(?:redis|레디스).{0,32}(?:가이드|문서|설명).{0,32}(?:설정|config|redis\.conf|maxmemory|eviction|영속화)/i;

/** 복합 쿼리 신호 패턴 목록 */
export const COMPOSITE_QUERY_PATTERNS = [
  /그리고|또한|동시에|함께|및|plus|and|then/i,
  /비교|대비|차이|compared?|versus|vs\.?/i,
  /원인.*해결|해결.*원인|분석.*조치|조치.*분석/i,
];

// ─── 이하 내부 전용 패턴 ───────────────────────────────────────────────────

export const FORMATTING_ONLY_TARGET_PATTERN =
  /(보고서용|리포트용|문장으로|문장만|마크다운|markdown|bullet|불릿|rewrite|rephrase|paraphrase)/i;
export const FORMATTING_ONLY_ACTION_PATTERN =
  /(방금|위\s*내용|이전\s*(결과|답변)|결과|답변|다시\s*작성|재작성|고쳐\s*써|다듬어|줄여|바꿔|정리해|rewrite|rephrase|paraphrase)/i;
export const FORMATTING_ONLY_EXECUTION_PATTERN =
  /(아티팩트|artifact|생성|만들|다운로드|내려받|실행|돌려|뽑아|export|generate|download|create|run)/i;

export const EXPLICIT_RANKING_REQUEST_PATTERN =
  /(?:상위|하위|top|bottom)\s*\d{1,2}|(?:가장\s*(?:높|낮|많|적))|(?:\d{1,2}\s*(?:개|대|위|번째))\s*(?:순|위)|순위|랭킹|rank(?:ing|ed)?\s+by|sort\s+by|highest|lowest|most|least/i;

export const TOOL_ROUTING_PATTERNS = {
  anomaly: /이상|징후|급증|급감|스파이크|anomal|탐지|감지|비정상/i,
  prediction:
    /예측|트렌드|추이|전망|forecast|추세|임계치.*전|넘기\s*전|미리.*알|고갈|(?:위험\s*(?:수준|레벨|임계|단계)|critical\s*(?:level|threshold)).{0,24}(?:도달|초과|넘|시점|예측|reach|hit)|(?:when|how\s+soon).{0,40}(?:exceed|reach|hit|breach).{0,16}\d{1,3}\s*%?/i,
  rca: /장애|rca|root\s*cause|타임라인|상관관계|원인|왜|이유|때문|근본|incident|\bwhy\b|\breason\b|\bcause\b/i,
  math:
    /(?:계산|연산|수식|중앙값|표준편차|percentile|p\d{2}|지수|루트|\d+(?:\.\d+)?\s*(?:[+*\/\^]|\s-\s)\s*\d+)/i,
  advisor:
    /해결|방법|명령어|가이드|해야|뭘\s*해야|무엇을\s*해야|순서|점검|확인하고|조언|개선|튜닝|스크립트|script|bash|shell|slack|슬랙|webhook|alertmanager|prometheus|runbook|런북|재마운트|remount|troubleshoot|이력|과거|사례|검색|보안|강화|백업|최적화|best.?practice|권장|추천|토폴로지|아키텍처|구성도|topology|architecture/i,
  serverGroup:
    /(db|web|cache|lb|api|storage|haproxy|nginx|mysql|redis|nfs|backend|백엔드|로드\s*밸런서|캐시|스토리지)\s*(서버)?/i,
  logs: /로그(?!인)|(?<![a-z])logs?(?![a-z])|에러\s*로그|syslog|journalctl|dmesg|시스템\s*로그/i,
  metrics: /cpu|메모리|디스크|서버|상태|memory|memori|memroy|disk|부하|로드|load|az|dc\d+|데이터\s*센터|데이터센터|data\s*center|datacenter|구역|zone|location|위치|균형|balance/i,
} as const;

export const GREETING_PATTERNS = [
  /^(안녕하세요|안녕|하이|헬로|hi|hello|hey|반가워|좋은\s*(아침|오후|저녁))[\s!?.]*$/i,
  /^(고마워|감사합니다|감사|ㄱㅅ|수고|잘가|바이|bye|thanks)[\s!?.]*$/i,
];

export const GENERAL_PATTERNS = [
  /^(오늘|지금)\s*(날씨|몇\s*일|몇\s*시|요일|며칠)[\s?]*$/i,
  /^(넌|너는?|뭐야|누구|뭘\s*할\s*수|도움말|help|도와줘)[\s?]*$/i,
  /^(테스트|ping|echo)[\s?]*$/i,
];

/**
 * 모니터링 시나리오 주제어 패턴.
 * pre-filter 게이트에서 "서버 모니터링 관련 쿼리인가?" 를 판단하는 데 사용.
 *
 * INFRA_CONTEXT_PATTERN 과의 차이:
 *   - INFRA_CONTEXT_PATTERN: "인프라 기술 용어가 있는가?" (haproxy, nginx, cpu…)
 *     → routing-policy.ts의 웹 검색 강제·범용 쿼리 판별에 사용
 *   - SERVER_TOPIC_PATTERN : "모니터링 시나리오 쿼리인가?" (장애, 보고서, 급증…)
 *     → pre-filter 에이전트 선택 게이트에만 사용
 */
export const SERVER_TOPIC_PATTERN =
  /서버|cpu|메모리|디스크|memory|disk|상태|이상|징후|비정상|분석|예측|트렌드|장애|보고서|리포트|해결|명령어|요약|모니터링|server|알람|경고|운영|당직|알림|순서|점검|재마운트|평균|최대|최소|지난|사례|이력|과거|유사|인시던트|incident|스크린샷|screenshot|이미지|image|대시보드|dashboard|로그\s*분석|대용량|최신\s*문서|grafana|cloudwatch|높은|낮은|상승|하강|급증|급감|오프라인|온라인|다운|down|offline|online|부하|load|사용량|usage|응답시간|response|latency|대역폭|bandwidth|장비|haproxy|nginx|mysql|redis|nfs|백엔드|backend/i;

export const WHOLE_FLEET_PATTERN =
  /전체|모든|전부|fleet|all\s+(servers?|nodes?)|whole\s+fleet/i;
export const SERVER_GROUP_PATTERN =
  /db|web|cache|lb|api|storage|haproxy|nginx|mysql|redis|nfs|backend|백엔드|로드\s*밸런서|캐시|스토리지/i;
export const SERVER_ID_PATTERN =
  /\b[a-z][-a-z0-9]*-(?:dc|zone|region|prod|staging)\d*[-a-z0-9]*\b/i;
export const ACTION_PATTERN =
  /해결|방법|명령어|가이드|해야|뭘\s*해야|무엇을\s*해야|순서|점검|확인하고|조언|개선|튜닝|최적화|추천|권장|조치|대응|fix|resolve|troubleshoot/i;
export const MUTATING_COMMAND_PATTERN =
  /apt\s+install|yum\s+install|dnf\s+install|systemctl\s+(?:restart|reload|stop|start)|restart|재시작|설치|삭제|변경|수정|적용|배포|scale|resize/i;
export const ATTACHMENT_VISION_PATTERN =
  /스크린샷|screenshot|이미지|image|사진|차트|그래프|화면|패널/i;
