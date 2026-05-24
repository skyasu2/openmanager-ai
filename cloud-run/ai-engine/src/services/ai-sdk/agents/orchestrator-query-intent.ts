/**
 * Query intent classification for monitoring queries.
 *
 * Determines whether a query can be answered directly from tool results
 * (no LLM text generation needed) or requires LLM reasoning.
 *
 * Classification is based on structural query signals — question words,
 * operators, ordinals — plus explicit monitoring metric names. This keeps
 * deterministic routing tied to parseable intent instead of environment-only
 * regexes.
 */

import { INVERSE_STATUS_PATTERN, MIN_METRIC_PATTERN } from '../routing/routing-patterns';
import { shouldPreferAdvisorForOperationalAdvice } from '../routing/query-routing-signals';

export type QueryIntent =
  | 'data-lookup'     // Show current state/overview
  | 'data-filter'     // Filter by threshold or status condition
  | 'data-ranking'    // Sort/rank by metric value
  | 'causal-analysis' // Why / root-cause questions
  | 'predictive'      // Future state / forecast questions
  | 'advisory'        // What should I do / recommendations
  | 'unknown';        // Unclear — let LLM decide

export type QueryMetric = 'cpu' | 'memory' | 'disk' | 'network' | 'status';
export type QueryOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';
export type QueryRankOrder = 'asc' | 'desc';
export type QueryStatus = 'online' | 'warning' | 'critical' | 'offline';

export interface IntentClassification {
  intent: QueryIntent;
  confidence: 'high' | 'medium' | 'low';
  metric?: QueryMetric;
  operator?: QueryOperator;
  threshold?: number;
  inferredThreshold?: boolean;
  rankCount?: number;
  rankOrder?: QueryRankOrder;
  statusValue?: QueryStatus;
}

// Inverse status filter — routing-patterns.ts SSOT
const INVERSE_STATUS_SIGNALS = INVERSE_STATUS_PATTERN;

// Min-metric ranking — routing-patterns.ts SSOT
const MIN_METRIC_SIGNALS = MIN_METRIC_PATTERN;

// Structural signals — intent markers that exist in any natural language
// monitoring query, independent of domain vocabulary.

// Causal: "why", "because", "reason", "cause", "how did", "what caused"
const CAUSAL_SIGNALS =
  /왜|이유|원인|때문|어떻게\s*됐|어떻게\s*해서|발생\s*원인|why|because|reason|cause[sd]?|root.?cause|how\s+did|what\s+caused/i;

// Predictive: "will", "forecast", "predict", "future", "going to", trend projection
const PREDICTIVE_SIGNALS =
  /예측|전망|언제\s*(쯤|까지|부터)|언제.{0,24}\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파)|\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파).{0,24}(?:언제|시점|예측)|(?:위험\s*(?:수준|레벨|임계|단계)|critical\s*(?:level|threshold)).{0,24}(?:도달|초과|넘|시점|예측|reach|hit)|앞으로|미래|될\s*(것|거|듯)|임계(?:치|값)?.*(?:전|넘|초과|도달)|넘기\s*전|미리\s*알|고갈|포화|will\s+\w+|forecast|predict|going\s+to|future|projection|when\s+will|(?:when|how\s+soon).{0,40}(?:exceed|reach|hit|breach).{0,16}\d{1,3}\s*%?/i;

// Advisory: "should", "recommend", "what to do", "advice", "suggest", "how to"
const ADVISORY_SIGNALS =
  /해야\s*(해|할|하나)|어떻게\s*(해야|하면|할|하나)|추천|권고|조언|방법|어떤\s*(조치|대응|방법)\s*(이|을)|should\s+[iI]|recommend|what\s+to\s+do|advice|suggest|how\s+to\s+fix|best\s+practice/i;

// Filter: numeric threshold with comparison operator
// e.g. "> 80%", "이상 70", "초과 90%", "이하 20"
const THRESHOLD_FILTER_SIGNALS =
  /(\d{1,3})\s*%?\s*(이상|초과|이하|미만|넘|>=|<=|>|<)\s*\d{0,3}|[><=!]{1,2}\s*\d{1,3}\s*%?|(status|상태)\s*(:\s*)?(warning|critical|offline|정상)/i;

// Ranking: ordinal + metric — "top N", "highest", "lowest", "rank by"
// e.g. "상위 5개", "top 3 by CPU", "가장 높은", "순위"
const RANKING_SIGNALS =
  /(상위|하위|top|bottom)\s*\d{1,2}|(가장\s*(높|낮|많|적))|(\d{1,2}\s*(개|위|번째))\s*(순|위)|순위|랭킹|rank(ing|ed)?\s+by|sort\s+by|highest|lowest|most|least|높은|낮은/i;

// Metric issue filter without an explicit threshold.
// e.g. "네트워크 문제가 있는 서버만", "방금 분석한 서버 중 disk 이상만 골라줘"
const METRIC_ISSUE_FILTER_SIGNALS =
  /(?:문제|이상|비정상|위험|경고|포화|병목|장애).{0,24}(?:있는|인|난|발생|서버|것)|(?:있는\s*것만|골라|추려|필터|filter|only|문제\s*있는)/i;

const DEFAULT_ISSUE_THRESHOLD_BY_METRIC: Record<
  Exclude<QueryMetric, 'status'>,
  number
> = {
  cpu: 80,
  memory: 80,
  disk: 80,
  network: 70,
};

function normalizeOperator(raw: string): QueryOperator {
  const value = raw.trim().toLowerCase();
  if (value === '이상') return '>=';
  if (value === '초과' || value.startsWith('넘')) return '>';
  if (value === '이하') return '<=';
  if (value === '미만') return '<';
  if (value === '=') return '==';
  if (value === '!==') return '!=';
  return value as QueryOperator;
}

function parseMetric(query: string): QueryMetric | undefined {
  if (/\bcpu\b|씨피유/i.test(query)) return 'cpu';
  if (/메모리|\bmem\b|\bmemory\b|\bmemori\b|\bmemroy\b/i.test(query)) {
    return 'memory';
  }
  if (/디스크|\bdisk\b|스토리지|\bstorage\b/i.test(query)) return 'disk';
  if (/네트워크|\bnetwork\b|\bnet\b/i.test(query)) return 'network';
  if (/상태|\bstatus\b|offline|online|warning|critical|오프라인|온라인|정상|경고|위험/i.test(query)) {
    return 'status';
  }
  return undefined;
}

function parseStatusValue(query: string): QueryStatus | undefined {
  if (/offline|오프라인/i.test(query)) return 'offline';
  if (/critical|위험/i.test(query)) return 'critical';
  if (/warning|경고/i.test(query)) return 'warning';
  if (/online|온라인|정상/i.test(query)) return 'online';
  return undefined;
}

function getDefaultIssueThreshold(
  metric: QueryMetric | undefined
): number | undefined {
  if (!metric || metric === 'status') return undefined;
  return DEFAULT_ISSUE_THRESHOLD_BY_METRIC[metric];
}

function hasExplicitStatusFilter(query: string): boolean {
  return (
    /\bstatus\b\s*[:=]\s*(online|warning|critical|offline)|상태\s*[:=]\s*(정상|경고|위험|오프라인|온라인)/i.test(query) ||
    /(online|warning|critical|offline|오프라인|온라인|정상|경고|위험)\s*(상태\s*)?서버/i.test(query) ||
    /서버\s*(중|가|는)?\s*(online|warning|critical|offline|오프라인|온라인|정상|경고|위험)/i.test(query)
  );
}

function parseThresholdComparison(
  query: string
): { operator: QueryOperator; threshold: number } | undefined {
  const patterns: Array<RegExp> = [
    /([<>]=?|={1,2}|!=)\s*(\d{1,3})\s*%?/i,
    /(\d{1,3})\s*%?\s*(>=|<=|>|<|={1,2}|!=|이상|초과|이하|미만|넘(?:는|은)?)/i,
    /(이상|초과|이하|미만|넘(?:는|은)?|>=|<=|>|<|={1,2}|!=)\s*(\d{1,3})\s*%?/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (!match) continue;

    const first = match[1] ?? '';
    const second = match[2] ?? '';
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    const threshold = Number.isFinite(firstNumber) ? firstNumber : secondNumber;
    const operatorRaw = Number.isFinite(firstNumber) ? second : first;

    if (Number.isFinite(threshold) && threshold >= 0 && threshold <= 100) {
      return {
        operator: normalizeOperator(operatorRaw),
        threshold,
      };
    }
  }

  return undefined;
}

export function classifyQueryIntent(query: string): IntentClassification {
  // Priority order: causal > predictive > explicit metric ranking
  // Then: advisory > filter. Ranking stays deterministic even when the user also
  // asks for remediation guidance, so broad TOP-N questions do not fall into
  // server-id clarification prompts.
  // Default: data-lookup
  const metric = parseMetric(query);
  const statusValue = parseStatusValue(query);
  const comparison = parseThresholdComparison(query);
  const rankCount = extractRankCount(query);
  const rankOrder: QueryRankOrder =
    /하위|bottom|낮|lowest|least|asc/i.test(query) ? 'asc' : 'desc';

  if (CAUSAL_SIGNALS.test(query)) {
    return { intent: 'causal-analysis', confidence: 'high', metric, statusValue };
  }

  if (PREDICTIVE_SIGNALS.test(query)) {
    return { intent: 'predictive', confidence: 'high', metric, statusValue };
  }

  if (shouldPreferAdvisorForOperationalAdvice(query)) {
    return { intent: 'advisory', confidence: 'high', metric, statusValue };
  }

  // Minimum-value ranking: "부하 가장 낮은", "CPU 최저 서버"
  // Must be checked before RANKING_SIGNALS to ensure ascending order is set.
  if (MIN_METRIC_SIGNALS.test(query) && !CAUSAL_SIGNALS.test(query)) {
    return {
      intent: 'data-ranking',
      confidence: 'high',
      metric: metric ?? 'cpu',
      rankCount,
      rankOrder: 'asc',
    };
  }

  if (RANKING_SIGNALS.test(query) && metric && metric !== 'status') {
    return {
      intent: 'data-ranking',
      confidence: 'high',
      metric,
      rankCount,
      rankOrder,
    };
  }

  if (ADVISORY_SIGNALS.test(query)) {
    return { intent: 'advisory', confidence: 'high', metric, statusValue };
  }

  if (metric === 'status' && statusValue && hasExplicitStatusFilter(query)) {
    return {
      intent: 'data-filter',
      confidence: 'high',
      metric,
      operator: '==',
      statusValue,
    };
  }

  if (comparison && metric && metric !== 'status') {
    return {
      intent: 'data-filter',
      confidence: 'high',
      metric,
      operator: comparison.operator,
      threshold: comparison.threshold,
    };
  }

  const defaultIssueThreshold = getDefaultIssueThreshold(metric);
  if (
    defaultIssueThreshold !== undefined &&
    METRIC_ISSUE_FILTER_SIGNALS.test(query)
  ) {
    return {
      intent: 'data-filter',
      confidence: 'high',
      metric,
      operator: '>=',
      threshold: defaultIssueThreshold,
      inferredThreshold: true,
    };
  }

  // Inverse filter: "정상 범위인 서버", "이상 없는 서버"
  // Operator '<' (below threshold = healthy state).
  if (INVERSE_STATUS_SIGNALS.test(query)) {
    const inferredThreshold = metric
      ? getDefaultIssueThreshold(metric) ?? 80
      : 80;
    return {
      intent: 'data-filter',
      confidence: metric ? 'high' : 'medium',
      metric: metric ?? 'cpu',
      operator: '<',
      threshold: inferredThreshold,
      inferredThreshold: true,
    };
  }

  if (THRESHOLD_FILTER_SIGNALS.test(query)) {
    return {
      intent: 'data-filter',
      confidence: metric ? 'high' : 'low',
      metric,
      operator: comparison?.operator,
      threshold: comparison?.threshold,
      statusValue,
    };
  }

  // If the query mentions monitoring entities (server, metric names) but has no
  // complex signal, treat as a plain lookup.
  const hasMonitoringTarget =
    /서버|인프라|시스템|메트릭|server|infra|system|metric|node|host|instance|cluster|pod|container/i.test(
      query
    );

  if (hasMonitoringTarget) {
    return { intent: 'data-lookup', confidence: 'medium', metric, statusValue };
  }

  return { intent: 'unknown', confidence: 'low', metric, statusValue };
}

/**
 * Returns true when the query intent is satisfiable directly from tool results
 * and the tool results contain enough data to answer.
 *
 * This replaces the previous env-specific regex approach:
 * - Old: pattern match on Korean/English monitoring keywords
 * - New: structural intent + data completeness check
 */
export function shouldPreferDeterministic(
  classification: IntentClassification,
  toolResultServerCount: number
): boolean {
  // LLM-required intents — never bypass
  if (
    classification.intent === 'causal-analysis' ||
    classification.intent === 'predictive' ||
    classification.intent === 'advisory' ||
    classification.intent === 'unknown'
  ) {
    return false;
  }

  // Data-driven intents — prefer deterministic only when tools returned data
  if (toolResultServerCount === 0) {
    return false;
  }

  if (classification.intent === 'data-filter') {
    if (classification.metric === 'status') {
      return Boolean(classification.statusValue);
    }
    return Boolean(
      classification.metric &&
        classification.operator &&
        classification.threshold !== undefined
    );
  }

  if (classification.intent === 'data-ranking') {
    return Boolean(classification.metric && classification.metric !== 'status');
  }

  return classification.intent === 'data-lookup';
}

/**
 * Extract numeric threshold from a filter query.
 * Works on any language using digit + comparison word pattern.
 */
export function extractThreshold(query: string, fallback = 70): number {
  return parseThresholdComparison(query)?.threshold ?? fallback;
}

/**
 * Extract requested item count from a ranking query.
 * e.g. "상위 5개" → 5, "top 3" → 3
 */
export function extractRankCount(query: string, fallback = 3): number {
  const match =
    query.match(/(?:상위|하위|top|bottom)\s*(\d{1,2})/i) ??
    query.match(/(\d{1,2})\s*(?:개|대|위)/);

  if (match) {
    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > 0) return Math.min(parsed, 10);
  }

  return fallback;
}
