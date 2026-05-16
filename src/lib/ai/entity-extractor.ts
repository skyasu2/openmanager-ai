/**
 * LLM Entity Extractor — Groq Llama 4 Scout 기반
 *
 * 쿼리에서 server_id / metric / time_range 슬롯을 추출하여
 * 불필요한 클래리피케이션을 사전 차단합니다.
 *
 * 모델: Groq meta-llama/llama-4-scout-17b-16e-instruct (500K TPD, 무료)
 * 평균 레이턴시: ~200ms (단문 JSON 추출)
 */

import {
  getRegisteredServerIds,
  type RegisteredServerId,
} from '@/config/server-registry';

export interface ExtractedEntities {
  /** 명시된 서버 ID (예: api-was-dc1-01) */
  server?: KnownEntityServerId;
  /** 명시된 메트릭 타입 (예: cpu, memory, disk) */
  metric?: ExtractedMetric;
  /** 명시된 시간 범위 (예: 1h, 24h, 7d) */
  timeRange?: ExtractedTimeRange;
  /** 자연어 질의를 실행 가능한 도메인 의미로 해석한 힌트 */
  intentFrame?: SemanticIntentFrame;
  /** 추출 신뢰도 0-100 */
  confidence: number;
  /** QueryGuard가 입력을 차단했는지 여부 */
  blocked?: boolean;
  /** 차단 원인 코드 */
  blockReason?: string;
  /** 사용자 표시용 차단 메시지 */
  message?: string;
}

export const ENTITY_CONFIDENCE_THRESHOLD = 80;

export const KNOWN_ENTITY_SERVER_IDS = getRegisteredServerIds() as [
  RegisteredServerId,
  ...RegisteredServerId[],
];

export type KnownEntityServerId = RegisteredServerId;

// Legacy top-level metric slots stay limited to dashboard metrics.
// Load metrics are carried by intentFrame.metric as load1/load5.
export const EXTRACTED_METRICS = ['cpu', 'memory', 'disk', 'network'] as const;
export type ExtractedMetric = (typeof EXTRACTED_METRICS)[number];

export const EXTRACTED_TIME_RANGES = ['1h', '6h', '24h', '7d'] as const;
export type ExtractedTimeRange = (typeof EXTRACTED_TIME_RANGES)[number];

export const SEMANTIC_DOMAINS = ['monitoring', 'unknown'] as const;
export type SemanticDomain = (typeof SEMANTIC_DOMAINS)[number];

export const SEMANTIC_INTENTS = [
  'metric_peak',
  'metric_current',
  'metric_trend',
  'server_health',
  'unknown',
] as const;
export type SemanticIntent = (typeof SEMANTIC_INTENTS)[number];

export const SEMANTIC_SCOPES = [
  'whole_fleet',
  'server',
  'group',
  'unknown',
] as const;
export type SemanticScope = (typeof SEMANTIC_SCOPES)[number];

export const SEMANTIC_METRICS = [
  'cpu',
  'memory',
  'disk',
  'network',
  'load1',
  'load5',
  'unknown',
] as const;
export type SemanticMetric = (typeof SEMANTIC_METRICS)[number];

export const SEMANTIC_TIME_WINDOWS = [
  'current',
  '1h',
  '6h',
  '24h',
  '7d',
  'unknown',
] as const;
export type SemanticTimeWindow = (typeof SEMANTIC_TIME_WINDOWS)[number];

export const SEMANTIC_AGGREGATIONS = [
  'peak',
  'max',
  'avg',
  'top_n',
  'summary',
  'unknown',
] as const;
export type SemanticAggregation = (typeof SEMANTIC_AGGREGATIONS)[number];

export const SEMANTIC_AMBIGUITIES = ['low', 'medium', 'high'] as const;
export type SemanticAmbiguity = (typeof SEMANTIC_AMBIGUITIES)[number];

export interface SemanticIntentFrame {
  domain: SemanticDomain;
  intent: SemanticIntent;
  scope: SemanticScope;
  targets: string[];
  metric: SemanticMetric;
  timeWindow: SemanticTimeWindow;
  aggregation: SemanticAggregation;
  topN?: number;
  ambiguity: SemanticAmbiguity;
  confidence: number;
}

const LOCAL_METRIC_PEAK_CONFIDENCE = 94;
const LOCAL_METRIC_PEAK_PATTERN =
  /가장|제일|최고|최대|피크|최고점|최댓값|높|힘들(?:었|었던|었나|었어|었냐|던)?|튀(?:는|었|었다|었던|었는|었냐|었어|었고|ㄴ|었나)?|튄|스파이크|spike|버거(?:운|웠|웠던|웠나|웠어)|부담|압박|몰린|집중|병목|이상치|포화|\bbottleneck\b|\boutlier\b|\banomal(?:y|ies)\b|\bsaturation\b|high|highest|peak|max/i;
const LOCAL_METRIC_PEAK_TIME_FOCUS_PATTERN =
  /언제|(?:^|[^\d])시간(?:대|은|이|을|를)?|시각|시점|몇\s*시|때|구간|순간|\btimestamp\b|\bwhen\b|\btime\b|top\s*server|상위\s*서버|주범\s*서버|범인\s*서버|영향.*서버|어떤\s*서버|어느\s*서버/i;
const LOCAL_METRIC_PEAK_WINDOW_PATTERN =
  /24\s*시간|\b24\s*h(?:ours?)?\b|하루|최근|지난|어제(?:부터)?|지금까지|부터\s*지금|last\s*24|last\s*day|past\s*day|since\s*yesterday|from\s*yesterday\s*to\s*now/i;
const LOCAL_LOAD_METRIC_PATTERN =
  /부하|로드|시스템\s*(?:load|pressure)|system\s*(?:load|pressure)|load\s*(?:average|avg)|\bload(?:1|5)?\b|node_load[15]\b/i;
const LOCAL_METRIC_PEAK_COMPLEX_PATTERN =
  /조치|방법|해결|어떻게|대응|처리|해야\s*해|어쩌|원인|왜|분석|보고서|리포트|명령어|command|script|runbook/i;

const SYSTEM_PROMPT = `You are an entity extractor for a server monitoring system.
Extract entities from the user query and return ONLY valid JSON.
You are a semantic parser, not an answer generator.
Do not mention or choose internal provider/function names.

Known server IDs:
${KNOWN_ENTITY_SERVER_IDS.join(', ')}

Output format (JSON only, no explanation):
{
  "server": "<exact server ID or null>",
  "metric": "<cpu|memory|disk|network|null>",
  "timeRange": "<1h|6h|24h|7d|null>",
  "intentFrame": {
    "domain": "<monitoring|unknown>",
    "intent": "<metric_peak|metric_current|metric_trend|server_health|unknown>",
    "scope": "<whole_fleet|server|group|unknown>",
    "targets": ["<known server ID or group hint>"],
    "metric": "<cpu|memory|disk|network|load1|load5|unknown>",
    "timeWindow": "<current|1h|6h|24h|7d|unknown>",
    "aggregation": "<peak|max|avg|top_n|summary|unknown>",
    "topN": <number or null>,
    "ambiguity": "<low|medium|high>",
    "confidence": <0-100>
  },
  "confidence": <0-100>
}

Rules:
- "24h", "last 24h", "최근 24시간", "최근 하루", "지난 24시간", "어제부터 지금까지", "since yesterday", "from yesterday to now" => timeWindow "24h".
- "load", "load1", "load average", "로드", "부하", "system pressure" with peak/max/highest wording => metric "load1" and intent "metric_peak" when a peak time, peak interval, or top load is requested.
- "1분 load", "system load", "시스템 load", "제일 튄 시각", "제일 버거웠던 때", "제일 힘들었던 순간", "가장 높았던 구간", "부하 최고점 top server" with recent/day/time wording => metric "load1", timeWindow "24h", aggregation "peak".
- If the user says "CPU 말고" or "not CPU" and also mentions load/system load, do not select CPU; select metric "load1".
- Whole-fleet questions do not need a server ID. Use scope "whole_fleet" when the user asks across all servers, the fleet, or does not name a single server but asks for a ranking/peak/summary.
- Use scope "server" only when the user asks about one specific server.
- Keep provider/function/tool names out of every field.`;

function isKnownServerId(value: unknown): value is KnownEntityServerId {
  return (
    typeof value === 'string' &&
    (KNOWN_ENTITY_SERVER_IDS as readonly string[]).includes(value)
  );
}

function isExtractedMetric(value: unknown): value is ExtractedMetric {
  return (
    typeof value === 'string' &&
    (EXTRACTED_METRICS as readonly string[]).includes(value)
  );
}

function isExtractedTimeRange(value: unknown): value is ExtractedTimeRange {
  return (
    typeof value === 'string' &&
    (EXTRACTED_TIME_RANGES as readonly string[]).includes(value)
  );
}

function isSemanticDomain(value: unknown): value is SemanticDomain {
  return (
    typeof value === 'string' &&
    (SEMANTIC_DOMAINS as readonly string[]).includes(value)
  );
}

function isSemanticIntent(value: unknown): value is SemanticIntent {
  return (
    typeof value === 'string' &&
    (SEMANTIC_INTENTS as readonly string[]).includes(value)
  );
}

function isSemanticScope(value: unknown): value is SemanticScope {
  return (
    typeof value === 'string' &&
    (SEMANTIC_SCOPES as readonly string[]).includes(value)
  );
}

function isSemanticMetric(value: unknown): value is SemanticMetric {
  return (
    typeof value === 'string' &&
    (SEMANTIC_METRICS as readonly string[]).includes(value)
  );
}

function isSemanticTimeWindow(value: unknown): value is SemanticTimeWindow {
  return (
    typeof value === 'string' &&
    (SEMANTIC_TIME_WINDOWS as readonly string[]).includes(value)
  );
}

function isSemanticAggregation(value: unknown): value is SemanticAggregation {
  return (
    typeof value === 'string' &&
    (SEMANTIC_AGGREGATIONS as readonly string[]).includes(value)
  );
}

function isSemanticAmbiguity(value: unknown): value is SemanticAmbiguity {
  return (
    typeof value === 'string' &&
    (SEMANTIC_AMBIGUITIES as readonly string[]).includes(value)
  );
}

function clampConfidence(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

function normalizeTargets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((target): target is string => typeof target === 'string')
    .map((target) => target.trim())
    .filter((target) => target.length > 0 && target.length <= 80)
    .slice(0, 10);
}

function containsKnownServerId(query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  return KNOWN_ENTITY_SERVER_IDS.some((serverId) =>
    normalizedQuery.includes(serverId.toLowerCase())
  );
}

function extractLocalPeakMetric(query: string): ExtractedEntities | null {
  if (containsKnownServerId(query)) return null;
  if (LOCAL_METRIC_PEAK_COMPLEX_PATTERN.test(query)) return null;
  if (!LOCAL_LOAD_METRIC_PATTERN.test(query)) return null;
  if (!LOCAL_METRIC_PEAK_PATTERN.test(query)) return null;
  if (!LOCAL_METRIC_PEAK_TIME_FOCUS_PATTERN.test(query)) return null;
  if (!LOCAL_METRIC_PEAK_WINDOW_PATTERN.test(query)) return null;

  const metric: SemanticMetric = /\bload5\b|node_load5/i.test(query)
    ? 'load5'
    : 'load1';
  const topNMatch = query.match(/(?:top|상위)\s*(\d{1,2})/i);
  const parsedTopN = Number(topNMatch?.[1]);
  const topN =
    Number.isInteger(parsedTopN) && parsedTopN > 0
      ? Math.min(parsedTopN, 20)
      : 3;

  return {
    timeRange: '24h',
    confidence: LOCAL_METRIC_PEAK_CONFIDENCE,
    intentFrame: {
      domain: 'monitoring',
      intent: 'metric_peak',
      scope: 'whole_fleet',
      targets: [],
      metric,
      timeWindow: '24h',
      aggregation: 'peak',
      topN,
      ambiguity: 'low',
      confidence: LOCAL_METRIC_PEAK_CONFIDENCE,
    },
  };
}

export function extractLocalSemanticEntities(
  query: string
): ExtractedEntities | null {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return null;

  return extractLocalPeakMetric(normalizedQuery);
}

export function normalizeSemanticIntentFrame(
  data: unknown
): SemanticIntentFrame | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const raw = data as Record<string, unknown>;
  if (
    !isSemanticDomain(raw.domain) ||
    !isSemanticIntent(raw.intent) ||
    !isSemanticScope(raw.scope) ||
    !isSemanticMetric(raw.metric) ||
    !isSemanticTimeWindow(raw.timeWindow) ||
    !isSemanticAggregation(raw.aggregation) ||
    !isSemanticAmbiguity(raw.ambiguity)
  ) {
    return undefined;
  }

  const topN =
    typeof raw.topN === 'number' && Number.isInteger(raw.topN) && raw.topN > 0
      ? Math.min(raw.topN, 20)
      : undefined;

  return {
    domain: raw.domain,
    intent: raw.intent,
    scope: raw.scope,
    targets: normalizeTargets(raw.targets),
    metric: raw.metric,
    timeWindow: raw.timeWindow,
    aggregation: raw.aggregation,
    ...(topN !== undefined && { topN }),
    ambiguity: raw.ambiguity,
    confidence: clampConfidence(raw.confidence),
  };
}

export function normalizeExtractedEntities(data: unknown): ExtractedEntities {
  if (!data || typeof data !== 'object') {
    return { confidence: 0 };
  }

  const raw = data as Record<string, unknown>;
  const confidence = clampConfidence(raw.confidence);
  if (raw.blocked === true) {
    return {
      confidence,
      blocked: true,
      ...(typeof raw.blockReason === 'string' && {
        blockReason: raw.blockReason,
      }),
      ...(typeof raw.message === 'string' && { message: raw.message }),
    };
  }

  const intentFrame = normalizeSemanticIntentFrame(raw.intentFrame);

  return {
    ...(isKnownServerId(raw.server) ? { server: raw.server } : {}),
    ...(isExtractedMetric(raw.metric) ? { metric: raw.metric } : {}),
    ...(isExtractedTimeRange(raw.timeRange)
      ? { timeRange: raw.timeRange }
      : {}),
    ...(intentFrame ? { intentFrame } : {}),
    confidence,
  };
}

export async function extractEntities(
  query: string
): Promise<ExtractedEntities> {
  try {
    const res = await fetch('/api/ai/nlq/extract-entities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return { confidence: 0 };

    const data = await res.json();
    return normalizeExtractedEntities(data);
  } catch {
    return { confidence: 0 };
  }
}

export { SYSTEM_PROMPT };
