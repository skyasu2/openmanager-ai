import type { SupervisorMode } from '../supervisor-types';
import {
  CAPACITY_FULL_FORECAST_PATTERN,
  INVERSE_STATUS_PATTERN,
  MIN_METRIC_PATTERN,
  isRestartNeededLookupQuery,
} from './routing-patterns';

/**
 * Runtime routing SSOT for monitoring query signals.
 * Agent role matchPatterns stay metadata-only and must not be evaluated as
 * runtime routing predicates.
 */
export const MONITORING_RUNTIME_ROUTING_SOURCE =
  'query-routing-signals' as const;

export const INFRA_CONTEXT_PATTERN =
  /서버|서벼|썹|인프라|시스템|시스탬|모니터링|당직|알림|알람|로그|마운트|백엔드|로드\s*밸런서|캐시|스토리지|징후|cpu|씨피유|메모리|메머리|멤|디스크|트래픽|네트워크|부하|로드|구역|영역|위치|az|zone|haproxy|nginx|mysql|redis|nfs|primary|replica|server|servr|sever|memory|memori|memroy|disk|traffic|network|latency|response|load|backend|mount/i;

export const ANALYST_QUERY_PATTERN =
  /이상|비정상|징후|분석|예측|트렌드|패턴|원인|왜|상관관계|근본\s*원인|rca|고장|느려|다운|안\s*됨|안됨|장애/i;

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
  /해결|방법|명령어|가이드|어떻게|해야|뭘\s*해야|무엇을\s*해야|순서|점검|확인하고|조언|개선|튜닝|최적화|스크립트|script|bash|shell|slack|슬랙|webhook|alertmanager|prometheus|runbook|런북|재마운트|remount|how\s+to\s+(fix|resolve|solve)|troubleshoot|과거.*사례|사례.*찾|이력|유사|권장\s*조치/i;

const EXPLICIT_RANKING_REQUEST_PATTERN =
  /(?:상위|하위|top|bottom)\s*\d{1,2}|(?:가장\s*(?:높|낮|많|적))|(?:\d{1,2}\s*(?:개|대|위|번째))\s*(?:순|위)|순위|랭킹|rank(?:ing|ed)?\s+by|sort\s+by|highest|lowest|most|least/i;

export const FORCE_KB_QUERY_PATTERN =
  /토폴로지|topology|아키텍처|architecture|구성도|배치도|인프라\s*(구성|배치|토폴로지|architecture|topology)|ssot|single\s*source\s*of\s*truth|pre-generated|krl|knowledge\s*retrieval|책임\s*경계|플랫폼\s*경계|platform\s*boundary|(?:vercel|bff|cloud\s*run|ai\s*engine).*(?:책임|경계|boundary|bff|cloud\s*run|ai\s*engine)|(?:프로젝트|저장소|repo|repository|코드|문서|내부).*(?:파일|경로|위치|path|문서)|(?:otel|데이터).*(?:파일|경로|위치|path|ssot)|(?:redis|레디스).{0,32}(?:설정|config|redis\.conf|maxmemory|eviction|영속화).{0,32}(?:가이드|방법|문서|guide|how\s+to|설명)|(?:redis|레디스).{0,32}(?:가이드|문서|설명).{0,32}(?:설정|config|redis\.conf|maxmemory|eviction|영속화)/i;

/** 역방향 필터: routing-patterns.ts SSOT에서 re-export */
export const INVERSE_STATUS_FILTER_PATTERN = INVERSE_STATUS_PATTERN;

/** 최솟값 랭킹: routing-patterns.ts SSOT에서 re-export */
export const MIN_METRIC_RANKING_PATTERN = MIN_METRIC_PATTERN;

/** 재시작 필요 여부 조회: routing-patterns.ts SSOT */
export const isRestartNeededLookup = isRestartNeededLookupQuery;

export const COMPOSITE_QUERY_PATTERNS = [
  /그리고|또한|동시에|함께|및|plus|and|then/i,
  /비교|대비|차이|compared?|versus|vs\.?/i,
  /원인.*해결|해결.*원인|분석.*조치|조치.*분석/i,
];

export type QueryRoutingIntent =
  | 'metrics'
  | 'anomaly'
  | 'prediction'
  | 'rca'
  | 'advisor'
  | 'logs'
  | 'serverGroup'
  | 'report'
  | 'vision'
  | 'knowledge'
  | 'general';

export type QueryRoutingToolIntentCategory =
  | 'anomaly'
  | 'prediction'
  | 'math'
  | 'rca'
  | 'advisor'
  | 'serverGroup'
  | 'logs'
  | 'metrics'
  | 'general';

export type QueryRoutingScope =
  | 'single_server'
  | 'server_group'
  | 'whole_fleet'
  | 'unknown';

export type QueryRoutingMetric =
  | 'cpu'
  | 'memory'
  | 'disk'
  | 'load1'
  | 'network'
  | 'unknown';

export type QueryRoutingTimeWindow =
  | 'realtime'
  | 'recent'
  | '24h'
  | 'unknown';

export interface QueryRoutingPreFilterSignal {
  action: 'direct_response' | 'suggest_agent' | 'continue';
  suggestedAgent?: string;
  confidence: number;
  reasonCodes: string[];
}

export interface QueryRoutingSignalOptions {
  hasImageAttachments?: boolean;
  hasFileAttachments?: boolean;
}

export interface QueryRoutingSignals {
  intent: QueryRoutingIntent;
  toolIntentCategory: QueryRoutingToolIntentCategory;
  scope: QueryRoutingScope;
  hasInfraContext: boolean;
  hasAttachment: boolean;
  hasImageAttachment: boolean;
  hasFileAttachment: boolean;
  asksForReport: boolean;
  asksForAction: boolean;
  asksForMutation: boolean;
  asksForFormattingOnly: boolean;
  metric?: QueryRoutingMetric;
  timeWindow?: QueryRoutingTimeWindow;
  confidence: number;
  reasonCodes: string[];
  modeHint: Exclude<SupervisorMode, 'auto'>;
  preFilter: QueryRoutingPreFilterSignal;
}

const TOOL_ROUTING_PATTERNS = {
  anomaly: /이상|징후|급증|급감|스파이크|anomal|탐지|감지|비정상/i,
  prediction:
    /예측|트렌드|추이|전망|forecast|추세|임계치.*전|넘기\s*전|미리.*알|고갈|(?:위험\s*(?:수준|레벨|임계|단계)|critical\s*(?:level|threshold)).{0,24}(?:도달|초과|넘|시점|예측|reach|hit)|(?:when|how\s+soon).{0,40}(?:exceed|reach|hit|breach).{0,16}\d{1,3}\s*%?/i,
  rca: /장애|rca|타임라인|상관관계|원인|왜|근본|incident/i,
  math:
    /(?:계산|연산|수식|중앙값|표준편차|percentile|p\d{2}|증가율|성장률|지수|루트|\d+(?:\.\d+)?\s*(?:[+*\/\^]|\s-\s)\s*\d+)/i,
  advisor:
    /해결|방법|명령어|가이드|해야|뭘\s*해야|무엇을\s*해야|순서|점검|확인하고|조언|개선|튜닝|스크립트|script|bash|shell|slack|슬랙|webhook|alertmanager|prometheus|runbook|런북|재마운트|remount|troubleshoot|이력|과거|사례|검색|보안|강화|백업|최적화|best.?practice|권장|추천|토폴로지|아키텍처|구성도|topology|architecture/i,
  serverGroup:
    /(db|web|cache|lb|api|storage|haproxy|nginx|mysql|redis|nfs|backend|백엔드|로드\s*밸런서|캐시|스토리지)\s*(서버)?/i,
  logs: /로그(?!인)|(?<![a-z])logs?(?![a-z])|에러\s*로그|syslog|journalctl|dmesg|시스템\s*로그/i,
  metrics: /cpu|메모리|디스크|서버|상태|memory|memori|memroy|disk|부하|로드|load|az|dc\d+|데이터\s*센터|데이터센터|data\s*center|datacenter|구역|zone|location|위치|균형|balance/i,
} as const;

const GREETING_PATTERNS = [
  /^(안녕하세요|안녕|하이|헬로|hi|hello|hey|반가워|좋은\s*(아침|오후|저녁))[\s!?.]*$/i,
  /^(고마워|감사합니다|감사|ㄱㅅ|수고|잘가|바이|bye|thanks)[\s!?.]*$/i,
];

const GENERAL_PATTERNS = [
  /^(오늘|지금)\s*(날씨|몇\s*일|몇\s*시|요일|며칠)[\s?]*$/i,
  /^(넌|너는?|뭐야|누구|뭘\s*할\s*수|도움말|help|도와줘)[\s?]*$/i,
  /^(테스트|ping|echo)[\s?]*$/i,
];

const SERVER_KEYWORDS = [
  '서버',
  'cpu',
  '메모리',
  '디스크',
  'memory',
  'disk',
  '상태',
  '이상',
  '징후',
  '비정상',
  '분석',
  '예측',
  '트렌드',
  '장애',
  '보고서',
  '리포트',
  '해결',
  '명령어',
  '요약',
  '모니터링',
  'server',
  '알람',
  '경고',
  '운영',
  '당직',
  '알림',
  '순서',
  '점검',
  '재마운트',
  '평균',
  '최대',
  '최소',
  '지난',
  '시간',
  '전체',
  '사례',
  '이력',
  '과거',
  '유사',
  '인시던트',
  'incident',
  '스크린샷',
  'screenshot',
  '이미지',
  'image',
  '대시보드',
  'dashboard',
  '로그 분석',
  '대용량',
  '최신 문서',
  'grafana',
  'cloudwatch',
  '높은',
  '낮은',
  '상승',
  '하강',
  '급증',
  '급감',
  '오프라인',
  '온라인',
  '다운',
  'down',
  'offline',
  'online',
  '부하',
  'load',
  '사용량',
  'usage',
  '응답시간',
  'response',
  'latency',
  '대역폭',
  'bandwidth',
  '장비',
  'haproxy',
  'nginx',
  'mysql',
  'redis',
  'nfs',
  '백엔드',
  'backend',
];

const WHOLE_FLEET_PATTERN =
  /전체|모든|전부|fleet|all\s+(servers?|nodes?)|whole\s+fleet/i;
const SERVER_GROUP_PATTERN =
  /db|web|cache|lb|api|storage|haproxy|nginx|mysql|redis|nfs|backend|백엔드|로드\s*밸런서|캐시|스토리지/i;
const SERVER_ID_PATTERN =
  /\b[a-z][-a-z0-9]*-(?:dc|zone|region|prod|staging)\d*[-a-z0-9]*\b/i;
const ACTION_PATTERN =
  /해결|방법|명령어|가이드|해야|뭘\s*해야|무엇을\s*해야|순서|점검|확인하고|조언|개선|튜닝|최적화|추천|권장|조치|대응|fix|resolve|troubleshoot/i;
const MUTATING_COMMAND_PATTERN =
  /apt\s+install|yum\s+install|dnf\s+install|systemctl\s+(?:restart|reload|stop|start)|restart|재시작|설치|삭제|변경|수정|적용|배포|scale|resize/i;
const ATTACHMENT_VISION_PATTERN =
  /스크린샷|screenshot|이미지|image|사진|차트|그래프|화면|패널/i;

export function shouldPreferAdvisorForOperationalAdvice(
  query: string
): boolean {
  const normalized = query.toLowerCase().trim();
  if (!ADVISOR_QUERY_PATTERN.test(normalized)) return false;

  // Keep broad fleet/ranking/threshold requests on deterministic metric
  // evidence. Only named-server operational advice should preempt metrics.
  return (
    SERVER_ID_PATTERN.test(normalized) &&
    !EXPLICIT_RANKING_REQUEST_PATTERN.test(normalized)
  );
}

function detectToolIntentCategory(
  query: string
): QueryRoutingToolIntentCategory {
  const q = query.toLowerCase();
  if (isRestartNeededLookup(q)) return 'metrics';
  if (TOOL_ROUTING_PATTERNS.anomaly.test(q)) return 'anomaly';
  if (
    TOOL_ROUTING_PATTERNS.prediction.test(q) ||
    CAPACITY_FULL_FORECAST_PATTERN.test(q)
  ) return 'prediction';
  if (TOOL_ROUTING_PATTERNS.math.test(q)) return 'math';
  if (TOOL_ROUTING_PATTERNS.rca.test(q)) return 'rca';
  if (TOOL_ROUTING_PATTERNS.advisor.test(q)) return 'advisor';
  if (TOOL_ROUTING_PATTERNS.logs.test(q)) return 'logs';
  if (TOOL_ROUTING_PATTERNS.serverGroup.test(q)) return 'serverGroup';
  if (TOOL_ROUTING_PATTERNS.metrics.test(q)) return 'metrics';
  return 'general';
}

function toRoutingIntent(
  toolIntentCategory: QueryRoutingToolIntentCategory,
  query: string,
  hasAttachment: boolean
): QueryRoutingIntent {
  if (hasAttachment && ATTACHMENT_VISION_PATTERN.test(query)) return 'vision';
  if (FORCE_KB_QUERY_PATTERN.test(query)) return 'knowledge';
  if (isRestartNeededLookup(query)) return 'metrics';
  if (!isFormattingOnlyReportRequest(query) && REPORTER_QUERY_PATTERN.test(query)) {
    return 'report';
  }
  if (toolIntentCategory === 'math') return 'metrics';
  return toolIntentCategory;
}

function detectMetric(query: string): QueryRoutingMetric | undefined {
  if (/load\s*1|load1|부하/i.test(query)) return 'load1';
  if (/cpu|씨피유/i.test(query)) return 'cpu';
  if (/메모리|memory|memori|memroy|mem/i.test(query)) return 'memory';
  if (/디스크|disk|storage|스토리지/i.test(query)) return 'disk';
  if (/네트워크|network|traffic|latency|대역폭/i.test(query)) return 'network';
  return undefined;
}

function detectTimeWindow(query: string): QueryRoutingTimeWindow | undefined {
  if (/24\s*시간|24h|last\s*24h|지난\s*24/i.test(query)) return '24h';
  if (/최근|지난|last|평균|최대|최소|추이|트렌드/i.test(query)) return 'recent';
  if (/현재|지금|실시간|current|now|realtime/i.test(query)) return 'realtime';
  return undefined;
}

function detectScope(query: string): QueryRoutingScope {
  if (WHOLE_FLEET_PATTERN.test(query)) return 'whole_fleet';
  if (SERVER_ID_PATTERN.test(query)) return 'single_server';
  if (SERVER_GROUP_PATTERN.test(query)) return 'server_group';
  return 'unknown';
}

function hasCompositeSignal(query: string): boolean {
  return COMPOSITE_QUERY_PATTERNS.some((pattern) => pattern.test(query));
}

function deriveModeHint(query: string): Exclude<SupervisorMode, 'auto'> {
  const q = query.toLowerCase();

  if (isFormattingOnlyReportRequest(q)) return 'single';
  if (isRestartNeededLookup(q)) return 'single';
  if (FORCE_KB_QUERY_PATTERN.test(q)) return 'multi';
  if (CAPACITY_FULL_FORECAST_PATTERN.test(q)) return 'multi';

  const fallbackMultiPatterns = [
    REPORTER_QUERY_PATTERN,
    ADVISOR_QUERY_PATTERN,
  ];

  return fallbackMultiPatterns.some((pattern) => pattern.test(q))
    ? 'multi'
    : 'single';
}

function buildModeReasonCodes(
  query: string,
  modeHint: Exclude<SupervisorMode, 'auto'>
): string[] {
  if (isFormattingOnlyReportRequest(query)) return ['mode_single_formatting_only'];
  if (modeHint === 'single') return ['mode_single_default'];
  if (isRestartNeededLookup(query)) return ['mode_single_default'];
  if (FORCE_KB_QUERY_PATTERN.test(query)) return ['mode_multi_knowledge'];
  if (CAPACITY_FULL_FORECAST_PATTERN.test(query)) {
    return ['mode_multi_capacity_forecast'];
  }
  if (REPORTER_QUERY_PATTERN.test(query)) return ['mode_multi_report_request'];
  if (ADVISOR_QUERY_PATTERN.test(query)) return ['mode_multi_advisor'];
  return ['mode_multi_default'];
}

function buildPreFilterSignal(
  query: string,
  options: QueryRoutingSignalOptions
): QueryRoutingPreFilterSignal {
  const normalized = query.trim().toLowerCase();

  if (GREETING_PATTERNS.some((pattern) => pattern.test(query))) {
    return {
      action: 'direct_response',
      confidence: 0.95,
      reasonCodes: ['prefilter_greeting'],
    };
  }

  if (GENERAL_PATTERNS.some((pattern) => pattern.test(query))) {
    return {
      action: 'direct_response',
      confidence: 0.95,
      reasonCodes: ['prefilter_general'],
    };
  }

  const isForceKnowledgeBaseIntent = FORCE_KB_QUERY_PATTERN.test(query);
  const isRestartNeededLookupIntent = isRestartNeededLookup(query);
  const hasServerKeyword =
    isForceKnowledgeBaseIntent ||
    isRestartNeededLookupIntent ||
    SERVER_KEYWORDS.some((keyword) => normalized.includes(keyword));
  const hasAttachmentVisionHint =
    (options.hasImageAttachments === true || options.hasFileAttachments === true) &&
    ATTACHMENT_VISION_PATTERN.test(normalized);

  if (hasAttachmentVisionHint) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Vision Agent',
      confidence: 0.92,
      reasonCodes: ['prefilter_vision_attachment'],
    };
  }

  if (!hasServerKeyword) {
    return {
      action: 'continue',
      confidence: 0.5,
      reasonCodes: ['prefilter_continue'],
    };
  }

  const isVisionIntent = ATTACHMENT_VISION_PATTERN.test(query) || hasAttachmentVisionHint;
  const isAnalystIntent = ANALYST_QUERY_PATTERN.test(query);
  const isReporterIntent =
    !isFormattingOnlyReportRequest(query) && REPORTER_QUERY_PATTERN.test(query);
  const isAdvisorIntent =
    isForceKnowledgeBaseIntent || ADVISOR_QUERY_PATTERN.test(query);
  const isInverseFilterIntent = INVERSE_STATUS_FILTER_PATTERN.test(query);
  const isMinMetricRankingIntent =
    MIN_METRIC_RANKING_PATTERN.test(query) && !isAnalystIntent;
  const isOpsProcedureIntent =
    /(스크립트|script|bash|shell|slack|슬랙|webhook|alertmanager|prometheus|runbook|런북|대응\s*(순서|절차))/i.test(
      query
    );

  if (isInverseFilterIntent || isMinMetricRankingIntent || isRestartNeededLookupIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Metrics Query Agent',
      confidence: 0.88,
      reasonCodes: ['prefilter_suggest_nlq'],
    };
  }

  if (isOpsProcedureIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Advisor Agent',
      confidence: 0.9,
      reasonCodes: ['prefilter_suggest_advisor'],
    };
  }

  const intentMatches = [
    isVisionIntent,
    isAnalystIntent,
    isReporterIntent,
    isAdvisorIntent,
  ].filter(Boolean).length;
  const likelyCompositeQuery =
    intentMatches >= 2 ||
    (hasCompositeSignal(query) && (intentMatches >= 1 || query.length >= 70));

  if (likelyCompositeQuery) {
    let suggestedAgent = 'Metrics Query Agent';
    let reasonCode = 'prefilter_suggest_nlq';
    if (isReporterIntent) {
      suggestedAgent = 'Reporter Agent';
      reasonCode = 'prefilter_suggest_reporter';
    } else if (isAnalystIntent) {
      suggestedAgent = 'Analyst Agent';
      reasonCode = 'prefilter_suggest_analyst';
    } else if (isAdvisorIntent) {
      suggestedAgent = 'Advisor Agent';
      reasonCode = 'prefilter_suggest_advisor';
    }

    return {
      action: 'suggest_agent',
      suggestedAgent,
      confidence: 0.68,
      reasonCodes: [reasonCode],
    };
  }

  if (isVisionIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Vision Agent',
      confidence: 0.92,
      reasonCodes: ['prefilter_vision_attachment'],
    };
  }

  if (isReporterIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Reporter Agent',
      confidence: 0.9,
      reasonCodes: ['prefilter_suggest_reporter'],
    };
  }

  if (isAnalystIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Analyst Agent',
      confidence: 0.88,
      reasonCodes: ['prefilter_suggest_analyst'],
    };
  }

  if (isAdvisorIntent) {
    return {
      action: 'suggest_agent',
      suggestedAgent: 'Advisor Agent',
      confidence: isForceKnowledgeBaseIntent ? 0.9 : 0.87,
      reasonCodes: ['prefilter_suggest_advisor'],
    };
  }

  return {
    action: 'suggest_agent',
    suggestedAgent: 'Metrics Query Agent',
    confidence: 0.86,
    reasonCodes: ['prefilter_suggest_nlq'],
  };
}

function appendUnique(reasonCodes: string[], code: string): void {
  if (!reasonCodes.includes(code)) reasonCodes.push(code);
}

export function mapQuerySignalsToIntentCategory(
  signals: QueryRoutingSignals
): QueryRoutingToolIntentCategory {
  return signals.toolIntentCategory;
}

export function extractQueryRoutingSignals(
  query: string,
  options: QueryRoutingSignalOptions = {}
): QueryRoutingSignals {
  const normalizedQuery = query.toLowerCase().trim();
  const reasonCodes: string[] = [];
  const hasImageAttachment = options.hasImageAttachments === true;
  const hasFileAttachment = options.hasFileAttachments === true;
  const hasAttachment = hasImageAttachment || hasFileAttachment;
  const isRestartNeededLookupIntent = isRestartNeededLookup(normalizedQuery);
  const hasInfraContext =
    INFRA_CONTEXT_PATTERN.test(normalizedQuery) || isRestartNeededLookupIntent;
  const asksForFormattingOnly = isFormattingOnlyReportRequest(normalizedQuery);
  const asksForReport =
    !asksForFormattingOnly && REPORTER_QUERY_PATTERN.test(normalizedQuery);
  const asksForAction = ACTION_PATTERN.test(normalizedQuery);
  const asksForMutation = MUTATING_COMMAND_PATTERN.test(normalizedQuery);
  const toolIntentCategory = detectToolIntentCategory(normalizedQuery);
  const intent = toRoutingIntent(
    toolIntentCategory,
    normalizedQuery,
    hasAttachment
  );
  const scope = detectScope(normalizedQuery);
  const metric = detectMetric(normalizedQuery);
  const timeWindow = detectTimeWindow(normalizedQuery);
  const modeHint = deriveModeHint(normalizedQuery);
  const preFilter = buildPreFilterSignal(query, options);

  if (hasInfraContext) appendUnique(reasonCodes, 'infra_context_present');
  if (isRestartNeededLookupIntent) appendUnique(reasonCodes, 'restart_needed_lookup');
  if (hasCompositeSignal(normalizedQuery)) appendUnique(reasonCodes, 'composite_query');
  if (metric) appendUnique(reasonCodes, `metric_detected_${metric}`);
  if (scope === 'whole_fleet' && metric) {
    appendUnique(reasonCodes, 'whole_fleet_metric');
  }
  if (scope === 'single_server') appendUnique(reasonCodes, 'single_server_id_match');
  if (hasImageAttachment) appendUnique(reasonCodes, 'attachment_image');
  if (hasFileAttachment) appendUnique(reasonCodes, 'attachment_file');
  if (asksForFormattingOnly) appendUnique(reasonCodes, 'formatting_only_report');
  if (asksForMutation) appendUnique(reasonCodes, 'mutating_command_request');
  if (toolIntentCategory === 'math') appendUnique(reasonCodes, 'math_expression');
  for (const modeReasonCode of buildModeReasonCodes(normalizedQuery, modeHint)) {
    appendUnique(reasonCodes, modeReasonCode);
  }

  return {
    intent,
    toolIntentCategory,
    scope,
    hasInfraContext,
    hasAttachment,
    hasImageAttachment,
    hasFileAttachment,
    asksForReport,
    asksForAction,
    asksForMutation,
    asksForFormattingOnly,
    ...(metric ? { metric } : {}),
    ...(timeWindow ? { timeWindow } : {}),
    confidence: preFilter.confidence,
    reasonCodes,
    modeHint,
    preFilter,
  };
}
