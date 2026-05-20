import type {
  DomainEvidenceProvider,
  DomainEvidenceRequest,
  DomainIntentFrame,
  DomainSnapshot,
} from '../../core/assistant-runtime';
import { METRICS_QUERY_AGENT_NAME } from '../../core/assistant-runtime/agent-name-compat';
import {
  buildDeterministicSummaryFromCurrentState,
} from '../../services/ai-sdk/agents/orchestrator-summary-fallback';
import {
  classifyQueryIntent,
  type QueryMetric,
  type QueryRankOrder,
} from '../../services/ai-sdk/agents/orchestrator-query-intent';
import { FORCE_KB_QUERY_PATTERN } from '../../services/ai-sdk/routing/query-routing-signals';
import { isServiceCommandGuidanceQuery } from '../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';

type CurrentMetricsEvidenceIntent = 'metric_ranking' | 'server_health';
type SupportedMetric = Exclude<QueryMetric, 'status'>;

export interface ParsedCurrentMetricsEvidenceRequest {
  intent: CurrentMetricsEvidenceIntent;
  capabilityId: string;
  sourceIntent: string;
  answerQuery: string;
  targets?: string[];
  metric?: SupportedMetric;
  rankCount?: number;
  rankOrder?: QueryRankOrder;
}

const HISTORICAL_OR_TREND_PATTERN =
  /(지난\s*\d|최근\s*\d|24\s*시간|하루|어제|last\s+\d|last24h|past\s+\d|평균|avg|추세|트렌드|trend|예측|forecast|비교|대비|변화|compare)/i;
const SERVER_HEALTH_PATTERN =
  /(?:서버|인프라|시스템|fleet|server|infra|system).{0,20}(상태|현황|요약|health|summary|status)|(?:상태|현황|요약|health|summary|status).{0,20}(서버|인프라|시스템|fleet|server|infra|system)/i;
const SERVER_HEALTH_EXCLUSION_PATTERN =
  /왜|원인|해결|방법|명령어|command|script|예측|트렌드|보고서|리포트|장애\s*보고서/i;
const SERVER_DETAIL_PATTERN =
  /\b[a-z0-9]+(?:-[a-z0-9]+){1,}\b.{0,24}(상태|현황|자세|상세|health|status|detail|어때|알려)/i;
const ACTION_NEEDED_PATTERN =
  /(?:지금|현재|당장|즉시).{0,24}(?:조치|대응).{0,24}(?:필요|해야|대상|있)|(?:조치|대응).{0,12}(?:필요한|필요|대상).{0,12}서버|immediate\s+action|action\s+needed/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function normalizeSupportedMetric(metric: string | undefined): SupportedMetric | null {
  if (!metric) return null;
  const normalized = metric.toLowerCase();
  return ['cpu', 'memory', 'disk', 'network'].includes(normalized)
    ? (normalized as SupportedMetric)
    : null;
}

function normalizeRankCount(value: number | undefined): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? Math.min(value, 10)
    : 3;
}

function normalizeRankOrder(
  frame: DomainIntentFrame,
  message: string
): QueryRankOrder {
  return /하위|낮|bottom|lowest|least|asc|min/i.test(
    `${frame.aggregation ?? ''} ${message}`
  )
    ? 'asc'
    : 'desc';
}

function normalizeTargets(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((target): target is string => typeof target === 'string')
    .map((target) => target.trim())
    .filter((target) => target.length > 0);
}

function isMetricRankingFrame(frame: DomainIntentFrame): boolean {
  return (
    frame.intent === 'metric_ranking' ||
    (frame.intent === 'metric_current' && /top_n|rank|ranking/i.test(
      frame.aggregation ?? ''
    ))
  );
}

function parseCurrentMetricsFrame(
  request: DomainEvidenceRequest
): ParsedCurrentMetricsEvidenceRequest | null {
  const frame = request.intentFrame;
  if (!frame || frame.domainId !== MONITORING_DOMAIN_ID) return null;

  const capabilityId = request.capability?.id ?? frame.capabilityId;
  if (
    frame.intent === 'server_health' &&
    (capabilityId === undefined ||
      capabilityId === MONITORING_SERVER_HEALTH_CAPABILITY_ID)
  ) {
    const targets = normalizeTargets(frame.targets);
    const shouldUseRawMessage =
      ACTION_NEEDED_PATTERN.test(request.message) ||
      SERVER_DETAIL_PATTERN.test(request.message);
    return {
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: frame.intent,
      answerQuery:
        targets.length > 0
          ? `${targets[0]} 상태를 자세히 알려줘`
          : shouldUseRawMessage
            ? request.message
          : '현재 모든 서버 상태 요약해줘',
      ...(targets.length > 0 && { targets }),
    };
  }

  const metric = normalizeSupportedMetric(frame.metric);
  if (
    metric &&
    isMetricRankingFrame(frame) &&
    (capabilityId === undefined ||
      capabilityId === MONITORING_METRIC_RANKING_CAPABILITY_ID)
  ) {
    const rankCount = normalizeRankCount(frame.topN);
    const rankOrder = normalizeRankOrder(frame, request.message);
    return {
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      sourceIntent: frame.intent,
      answerQuery: `${metric} ${rankOrder === 'asc' ? '하위' : '상위'} ${rankCount}개 서버 알려줘`,
      metric,
      rankCount,
      rankOrder,
    };
  }

  return null;
}

function parseCurrentMetricsMessage(
  message: string
): ParsedCurrentMetricsEvidenceRequest | null {
  if (isServiceCommandGuidanceQuery(message)) return null;

  const classification = classifyQueryIntent(message);
  const metric =
    classification.metric && classification.metric !== 'status'
      ? classification.metric
      : null;

  if (
    classification.intent === 'data-ranking' &&
    metric &&
    !HISTORICAL_OR_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      sourceIntent: classification.intent,
      answerQuery: message,
      metric,
      rankCount: normalizeRankCount(classification.rankCount),
      rankOrder: classification.rankOrder ?? 'desc',
    };
  }

  if (
    classification.intent === 'data-lookup' &&
    SERVER_HEALTH_PATTERN.test(message) &&
    !SERVER_HEALTH_EXCLUSION_PATTERN.test(message)
  ) {
    return {
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: classification.intent,
      answerQuery: message,
    };
  }

  if (ACTION_NEEDED_PATTERN.test(message)) {
    return {
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'action-needed',
      answerQuery: message,
    };
  }

  return null;
}

export function parseCurrentMetricsEvidenceRequest(
  request: DomainEvidenceRequest
): ParsedCurrentMetricsEvidenceRequest | null {
  if (FORCE_KB_QUERY_PATTERN.test(request.message)) return null;

  return (
    parseCurrentMetricsFrame(request) ?? parseCurrentMetricsMessage(request.message)
  );
}

async function resolveCurrentSnapshot(
  request: DomainEvidenceRequest
): Promise<DomainSnapshot | null> {
  return request.dataSource?.snapshot(request) ?? null;
}

function readSnapshotSlotIndex(snapshot: DomainSnapshot): number | undefined {
  return isRecord(snapshot.data) ? readFiniteNumber(snapshot.data.slotIndex) : undefined;
}

function readSnapshotTimeLabel(snapshot: DomainSnapshot): string | undefined {
  return isRecord(snapshot.data) ? readString(snapshot.data.timeLabel) : undefined;
}

function buildCurrentMetricsPrompt(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
  answer: string;
}): string {
  const basis =
    params.parsed.intent === 'metric_ranking'
      ? '현재 서버별 메트릭 값을 정렬한 Top-N 근거'
      : '현재 서버 상태와 warning/critical/offline 집계 근거';

  return [
    '[결정적 monitoring 현재 지표 근거]',
    `intent: ${params.parsed.intent}`,
    `기준: ${basis}`,
    `스냅샷 시각: ${params.snapshot.timestamp}`,
    '아래 서버 ID, 순서, 수치를 바꾸지 말고 그대로 답하세요.',
    '',
    params.answer,
  ].join('\n');
}

async function resolveCurrentMetricsEvidence(
  request: DomainEvidenceRequest,
  expectedIntent: CurrentMetricsEvidenceIntent,
  evidenceId: string
) {
  const parsed = parseCurrentMetricsEvidenceRequest(request);
  if (!parsed || parsed.intent !== expectedIntent) return null;

  const snapshot = await resolveCurrentSnapshot(request);
  if (!snapshot) return null;

  const answer =
    buildDeterministicSummaryFromCurrentState(
      parsed.answerQuery,
      METRICS_QUERY_AGENT_NAME,
      snapshot.data
    ) ??
    buildDeterministicSummaryFromCurrentState(
      request.message,
      METRICS_QUERY_AGENT_NAME,
      snapshot.data
    );

  if (!answer) return null;

  return {
    id: evidenceId,
    prompt: buildCurrentMetricsPrompt({ parsed, snapshot, answer }),
    fallback: answer,
    metadata: {
      responsePolicy: 'deterministic_answer',
      capabilityId: parsed.capabilityId,
      intent: parsed.intent,
      sourceIntent: parsed.sourceIntent,
      timestamp: snapshot.timestamp,
      ...(readSnapshotSlotIndex(snapshot) !== undefined && {
        slotIndex: readSnapshotSlotIndex(snapshot),
      }),
      ...(readSnapshotTimeLabel(snapshot) && {
        timeLabel: readSnapshotTimeLabel(snapshot),
      }),
      ...(parsed.targets && { targets: parsed.targets }),
      ...(parsed.metric && { metric: parsed.metric }),
      ...(parsed.rankCount && { rankCount: parsed.rankCount }),
      ...(parsed.rankOrder && { rankOrder: parsed.rankOrder }),
    },
  };
}

function createCurrentMetricsEvidenceProvider(params: {
  id: string;
  intent: CurrentMetricsEvidenceIntent;
}): DomainEvidenceProvider {
  return {
    id: params.id,
    canHandle(request: DomainEvidenceRequest): boolean {
      return parseCurrentMetricsEvidenceRequest(request)?.intent === params.intent;
    },
    resolve(request: DomainEvidenceRequest) {
      return resolveCurrentMetricsEvidence(request, params.intent, params.id);
    },
  };
}

export const monitoringMetricRankingEvidenceProvider =
  createCurrentMetricsEvidenceProvider({
    id: 'monitoring-metric-ranking',
    intent: 'metric_ranking',
  });

export const monitoringServerHealthEvidenceProvider =
  createCurrentMetricsEvidenceProvider({
    id: 'monitoring-server-health',
    intent: 'server_health',
  });
