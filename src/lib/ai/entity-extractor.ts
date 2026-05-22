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
import type { InputType } from './query-guard';

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
  /** QueryGuard 입력 형태 분류 */
  inputType?: InputType;
  /** 로그 붙여넣기/혼합 입력에서 추출한 관련 로그 발췌 */
  logExtract?: string;
  /** QueryGuard가 NLQ 또는 supervisor용 입력을 줄였는지 여부 */
  truncated?: boolean;
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
  'anomaly_detection',
  'anomaly_prediction',
  'capacity_forecast',
  'failure_risk',
  'server_health',
  'root_cause',
  'incident_report',
  'ops_advice',
  'log_analysis',
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
  'all',
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

export const SEMANTIC_EXECUTION_MODES = ['single', 'multi', 'unknown'] as const;
export type SemanticExecutionMode = (typeof SEMANTIC_EXECUTION_MODES)[number];

const QUERY_GUARD_INPUT_TYPES = [
  'natural_query',
  'log_paste',
  'mixed',
  'oversized',
] as const satisfies readonly InputType[];
const LOG_EXTRACT_CHAR_LIMIT = 8_000;

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
  executionMode: SemanticExecutionMode;
  confidence: number;
}

const GROUP_TARGET_HINTS = [
  {
    target: 'cache',
    pattern: /(?:캐시|cache|redis)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'storage',
    pattern: /(?:스토리지|저장소|storage|nfs|s3gw)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'web',
    pattern: /(?:웹|web|nginx)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'database',
    pattern: /(?:db|database|mysql|디비|데이터베이스)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'loadbalancer',
    pattern:
      /(?:로드\s*밸런서|로드밸런서|load\s*balancer|loadbalancer|lb)\s*(?:서버|그룹)?/i,
  },
] as const;

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
    "intent": "<metric_peak|metric_current|metric_trend|anomaly_detection|anomaly_prediction|capacity_forecast|failure_risk|server_health|root_cause|incident_report|ops_advice|log_analysis|unknown>",
    "scope": "<whole_fleet|server|group|unknown>",
    "targets": ["<known server ID or group hint>"],
    "metric": "<cpu|memory|disk|network|load1|load5|all|unknown>",
    "timeWindow": "<current|1h|6h|24h|7d|unknown>",
    "aggregation": "<peak|max|avg|top_n|summary|unknown>",
    "topN": <number or null>,
    "ambiguity": "<low|medium|high>",
    "executionMode": "<single|multi|unknown>",
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
- Set executionMode "single" for simple/current metric lookups, rankings, status checks, and formatting-only rewrites.
- Set intent "anomaly_detection" for current anomaly, abnormal, spike, detection, "이상 탐지", "비정상 감지" questions.
- Set intent "anomaly_prediction" for future-looking anomaly signal questions such as "이상 징후 예측", "미리 감지", or "위험 징후".
- Set intent "capacity_forecast" for resource exhaustion/capacity forecasts such as disk/memory/cpu saturation, "고갈", "임계치 넘기 전", "언제 포화", or "언제 90% 넘을까".
- Set intent "failure_risk" for broad failure-risk questions such as "장애 날 것 같은 서버", "장애 위험", or "불안정한 서버".
- Set intent "root_cause" for RCA, causality, correlation, incident cause, "왜", "원인", "근본 원인" questions.
- Set intent "incident_report" for incident/failure report creation or timeline report requests.
- Set intent "ops_advice" for runbooks, commands, remediation, troubleshooting, or action-plan advice.
- Set intent "log_analysis" for pasted logs or requests to analyze error/warning logs.
- Set executionMode "multi" for anomaly detection/prediction, capacity forecast, failure risk, root-cause analysis, incident reports, runbooks, advice/action plans, log analysis, correlation, prediction/trend analysis, or multi-step operational investigation.
- Set executionMode "unknown" when the execution path is unclear; do not guess from provider/tool names.
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

function isSemanticExecutionMode(
  value: unknown
): value is SemanticExecutionMode {
  return (
    typeof value === 'string' &&
    (SEMANTIC_EXECUTION_MODES as readonly string[]).includes(value)
  );
}

function isQueryGuardInputType(value: unknown): value is InputType {
  return (
    typeof value === 'string' &&
    (QUERY_GUARD_INPUT_TYPES as readonly string[]).includes(value)
  );
}

function normalizeLogExtract(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, LOG_EXTRACT_CHAR_LIMIT);
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

function queryMentionsKnownServerId(query: string): boolean {
  const normalizedQuery = query.toLowerCase();
  return (KNOWN_ENTITY_SERVER_IDS as readonly string[]).some((serverId) =>
    normalizedQuery.includes(serverId.toLowerCase())
  );
}

function inferGroupTargetFromQuery(query: string): string | undefined {
  return GROUP_TARGET_HINTS.find((hint) => hint.pattern.test(query))?.target;
}

const CAPACITY_FORECAST_QUERY_PATTERN =
  /(?:언제.{0,24}\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파)|\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파).{0,24}언제|용량\s*(?:예측|계획|부족|고갈)|capacity\s*(?:forecast|plan|planning|projection)|임계(?:치|값)?.{0,24}(?:도달|초과|넘)|고갈|포화)/i;

function inferCapacityMetricForQuery(
  query: string,
  entities: ExtractedEntities
): SemanticMetric {
  const frameMetric = entities.intentFrame?.metric;
  if (
    frameMetric &&
    frameMetric !== 'unknown' &&
    frameMetric !== 'load1' &&
    frameMetric !== 'load5'
  ) {
    return frameMetric;
  }
  if (entities.metric) return entities.metric;
  if (/\bcpu\b|씨피유/i.test(query)) return 'cpu';
  if (/메모리|\bmem\b|\bmemory\b/i.test(query)) return 'memory';
  if (/디스크|\bdisk\b|스토리지|\bstorage\b|용량/i.test(query)) return 'disk';
  if (/네트워크|\bnetwork\b|\bnet\b/i.test(query)) return 'network';
  return 'all';
}

function buildCapacityForecastCorrection(
  entities: ExtractedEntities,
  query: string
): ExtractedEntities | null {
  if (!CAPACITY_FORECAST_QUERY_PATTERN.test(query)) return null;

  const groupTarget = inferGroupTargetFromQuery(query);
  const hasKnownServer = queryMentionsKnownServerId(query);
  const targets =
    hasKnownServer && entities.server
      ? [entities.server]
      : groupTarget
        ? [groupTarget]
        : (entities.intentFrame?.targets ?? []);
  const scope: SemanticScope = hasKnownServer
    ? 'server'
    : groupTarget
      ? 'group'
      : 'whole_fleet';
  const metric = inferCapacityMetricForQuery(query, entities);
  const confidence = Math.max(
    entities.intentFrame?.confidence ?? 0,
    entities.confidence,
    80
  );

  const { intentFrame: _intentFrame, server: _server, ...rest } = entities;
  return {
    ...rest,
    ...(hasKnownServer && entities.server ? { server: entities.server } : {}),
    intentFrame: {
      domain: 'monitoring',
      intent: 'capacity_forecast',
      scope,
      targets,
      metric,
      timeWindow: '24h',
      aggregation: 'summary',
      ambiguity: 'low',
      executionMode: 'multi',
      confidence,
    },
    confidence,
  };
}

export function normalizeExtractedEntitiesForQuery(
  data: unknown,
  query: string
): ExtractedEntities {
  const entities = normalizeExtractedEntities(data);
  const capacityCorrection = buildCapacityForecastCorrection(entities, query);
  if (capacityCorrection) {
    return capacityCorrection;
  }

  const groupTarget = inferGroupTargetFromQuery(query);
  if (!groupTarget || queryMentionsKnownServerId(query)) {
    return entities;
  }

  const correctedFrame =
    entities.intentFrame && entities.intentFrame.domain === 'monitoring'
      ? {
          ...entities.intentFrame,
          scope: 'group' as const,
          targets: [groupTarget],
          confidence: Math.max(
            entities.intentFrame.confidence,
            entities.confidence
          ),
        }
      : undefined;

  const { server: _server, intentFrame: _intentFrame, ...rest } = entities;
  return {
    ...rest,
    ...(correctedFrame && { intentFrame: correctedFrame }),
  };
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
    executionMode: isSemanticExecutionMode(raw.executionMode)
      ? raw.executionMode
      : 'unknown',
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
  const inputType = isQueryGuardInputType(raw.inputType)
    ? raw.inputType
    : undefined;
  const logExtract = normalizeLogExtract(raw.logExtract);

  return {
    ...(isKnownServerId(raw.server) ? { server: raw.server } : {}),
    ...(isExtractedMetric(raw.metric) ? { metric: raw.metric } : {}),
    ...(isExtractedTimeRange(raw.timeRange)
      ? { timeRange: raw.timeRange }
      : {}),
    ...(intentFrame ? { intentFrame } : {}),
    ...(inputType && { inputType }),
    ...(logExtract && { logExtract }),
    ...(raw.truncated === true && { truncated: true }),
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
