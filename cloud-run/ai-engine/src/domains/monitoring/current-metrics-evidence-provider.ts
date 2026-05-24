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
  type QueryOperator,
  type QueryRankOrder,
} from '../../services/ai-sdk/agents/orchestrator-query-intent';
import { FORCE_KB_QUERY_PATTERN } from '../../services/ai-sdk/routing/query-routing-signals';
import { isServiceCommandGuidanceQuery } from '../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  buildCompositeLoadRankingAnswer,
  buildGroupServerHealthAnswer,
  buildHealthyOnlyServerAnswer,
  buildMetricCurrentAnswer,
  buildMetricTrendAnswer,
} from './current-metrics-evidence-answers';

type CurrentMetricsEvidenceIntent =
  | 'metric_current'
  | 'metric_ranking'
  | 'metric_trend'
  | 'server_health';
export type SupportedMetric = Exclude<QueryMetric, 'status'>;

export interface ParsedCurrentMetricsEvidenceRequest {
  intent: CurrentMetricsEvidenceIntent;
  capabilityId: string;
  sourceIntent: string;
  answerQuery: string;
  targets?: string[];
  groupTargets?: string[];
  metric?: SupportedMetric;
  metrics?: SupportedMetric[];
  threshold?: number;
  thresholdOperator?: QueryOperator;
  filterOperator?: 'AND' | 'OR';
  rankCount?: number;
  rankOrder?: QueryRankOrder;
  rankBasis?: 'composite-load';
  statusFilter?: 'healthy-only';
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
  /(?:지금|현재|당장|즉시).{0,32}(?:조치|대응|위험).{0,32}(?:필요|해야|대상|있|시급|서버)|(?:조치|대응).{0,16}(?:필요한|필요|대상|시급).{0,16}(?:서버|순위)|(?:서버|대상).{0,16}(?:조치|대응).{0,16}(?:필요|시급|우선순위|순위)|(?:가장\s*)?(?:위험한|위험도\s*높은).{0,24}(?:서버|대상|순위)|(?:어떤|어느|무슨)?\s*(?:서버|대상).{0,24}(?:가장\s*)?(?:위험한|위험도\s*높은)|문제\s*(?:있는|가\s*있는|있\s*는)\s*(?:서버|대상|시스템)|(?:서버|대상|시스템).{0,20}문제\s*(?:있|가\s*있)|이상\s*(?:있는|이\s*있는)\s*(?:서버|대상)|비정상\s*(?:서버|대상|인\s*서버)|장애\s*(?:있는|가\s*있는)\s*(?:서버|대상)|immediate\s+action|urgent\s+action|action\s+needed|most\s+at\s+risk|problematic\s+servers?|faulty\s+servers?|unhealthy\s+servers?/i;
const HEALTHY_ONLY_PATTERN =
  /정상\s*범위|이상\s*없는|문제\s*없는|괜찮은\s*서버|정상.{0,12}서버|healthy|normal|ok\s+servers?/i;
const HEALTHY_ONLY_EXCLUSION_PATTERN =
  /비정상|문제\s*있는|위험|경고|warning|critical|offline|장애|포화|병목/i;
const COMPOSITE_LOAD_RANKING_PATTERN =
  /(?:부하|로드|\bload\b).{0,24}(?:가장\s*)?(?:낮|적|최저|여유|한가)|(?:가장\s*)?(?:낮|적|최저|여유|한가).{0,24}(?:부하|로드|\bload\b)|여유\s*있는\s*서버|한가한\s*서버|available\s+servers?/i;
const CURRENT_METRIC_GROUP_PATTERN =
  /(?:\b(?:db|database|web|cache|storage|lb|loadbalancer|mysql|redis|nfs|was|api|app|application|backend)\b|로드\s*밸런서|캐시|스토리지|저장소|웹|디비|데이터베이스|애플리케이션)\s*(서버|그룹)?/i;
const METRIC_TREND_PATTERN =
  /추이|추세|트렌드|trend|변화|변동|(?:계속|지속|꾸준히|점점).{0,20}(?:올라|내려|높아|낮아|증가|감소|상승|하락|늘어|줄어)|(?:올라가|내려가).{0,8}(?:고\s*있|는\s*서버)|(?:상승|하락|증가|감소)\s*(?:중|추세|경향)/i;
const GROUP_SERVER_LIST_PATTERN =
  /서버\s*(?:들|목록|리스트)|호스트\s*(?:목록|리스트)?|목록|리스트|보여|알려|나열|show|list|servers?|hosts?|instances?|nodes?/i;
const SERVER_ID_PATTERN = /\b[a-z][a-z0-9]+(?:-[a-z0-9]+){2,}\b/gi;
const SERVER_COMPARISON_CONNECTOR_PATTERN =
  /\bvs\.?\b|versus|비교|대비|차이|와|과|\band\b/i;
const TIME_SERIES_COMPARISON_PATTERN =
  /(지난\s*\d|최근\s*\d|24\s*시간|하루|어제|last\s+\d|last24h|past\s+\d|평균|avg|추세|트렌드|trend|예측|forecast|변화)/i;
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
    target: 'application',
    pattern: /(?:\b(?:was|api|app|backend|application)\b|애플리케이션)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'database',
    pattern: /(?:db|database|mysql|디비|데이터베이스)\s*(?:서버|그룹)?/i,
  },
  {
    target: 'loadbalancer',
    pattern: /(?:로드\s*밸런서|로드밸런서|load\s*balancer|loadbalancer|lb)\s*(?:서버|그룹)?/i,
  },
] as const;

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

function extractMentionedMetrics(message: string): SupportedMetric[] {
  const metrics: SupportedMetric[] = [];
  if (/\bcpu\b|씨피유/i.test(message)) metrics.push('cpu');
  if (/메모리|\bmem\b|\bmemory\b|\bmemori\b|\bmemroy\b/i.test(message)) {
    metrics.push('memory');
  }
  if (/디스크|\bdisk\b|스토리지|\bstorage\b/i.test(message)) {
    metrics.push('disk');
  }
  if (/네트워크|\bnetwork\b|\bnet\b/i.test(message)) metrics.push('network');
  return metrics;
}

function isAndMetricFilterMessage(message: string): boolean {
  return /모두|동시에|전부|와|과|및|\band\b|&&|\+/i.test(message);
}

function normalizeRankCount(value: number | undefined): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? Math.min(value, 10)
    : 3;
}

function extractRankCountFromMessage(message: string): number | undefined {
  const match =
    message.match(/(?:상위|하위|top|bottom)\s*(\d{1,2})/i) ??
    message.match(/(\d{1,2})\s*(?:개|대|위)/);
  if (!match) return undefined;

  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 10) : undefined;
}

function normalizeCompositeLoadRankCount(message: string): number {
  const explicitCount = extractRankCountFromMessage(message);
  if (explicitCount !== undefined) return explicitCount;
  return /가장|최저|lowest|least/i.test(message) ? 1 : 3;
}

function isHealthyOnlyServerListMessage(message: string): boolean {
  return (
    HEALTHY_ONLY_PATTERN.test(message) &&
    !HEALTHY_ONLY_EXCLUSION_PATTERN.test(message)
  );
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

function messageMentionsTarget(message: string, target: string): boolean {
  return message.toLowerCase().includes(target.toLowerCase());
}

function inferGroupTargetFromMessage(message: string): string | undefined {
  return GROUP_TARGET_HINTS.find((hint) => hint.pattern.test(message))?.target;
}

function extractGroupTargetsFromMessage(message: string): string[] {
  const targets = new Set<string>();
  for (const hint of GROUP_TARGET_HINTS) {
    if (hint.pattern.test(message)) targets.add(hint.target);
  }
  return Array.from(targets);
}

function extractServerIdTargetsFromMessage(message: string): string[] {
  const targets = new Set<string>();
  for (const match of message.matchAll(SERVER_ID_PATTERN)) {
    const serverId = match[0]?.toLowerCase();
    if (serverId) targets.add(serverId);
  }
  return Array.from(targets);
}

function isCurrentServerComparisonMessage(message: string): boolean {
  return (
    SERVER_COMPARISON_CONNECTOR_PATTERN.test(message) &&
    !TIME_SERIES_COMPARISON_PATTERN.test(message)
  );
}

function reconcileTargetsWithMessage(
  targets: string[],
  message: string
): string[] {
  const groupTarget = inferGroupTargetFromMessage(message);
  if (!groupTarget) return targets;

  const hasExplicitTargetMention = targets.some((target) =>
    messageMentionsTarget(message, target)
  );
  return hasExplicitTargetMention ? targets : [groupTarget];
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
  const classification = classifyQueryIntent(request.message);
  const messageMetric = normalizeSupportedMetric(classification.metric);
  const explicitServerTargets = extractServerIdTargetsFromMessage(request.message);

  // Raw "server id + metric" evidence is more specific than a broad server_health frame.
  if (
    messageMetric &&
    explicitServerTargets.length === 1 &&
    !HISTORICAL_OR_TREND_PATTERN.test(request.message) &&
    (frame.intent === 'server_health' ||
      capabilityId === MONITORING_SERVER_HEALTH_CAPABILITY_ID)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-metric',
      answerQuery: request.message,
      metric: messageMetric,
      targets: explicitServerTargets,
    };
  }

  if (
    frame.intent === 'server_health' &&
    (capabilityId === undefined ||
      capabilityId === MONITORING_SERVER_HEALTH_CAPABILITY_ID)
  ) {
    if (isHealthyOnlyServerListMessage(request.message)) {
      const healthGroupTarget = inferGroupTargetFromMessage(request.message);
      return {
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        sourceIntent: 'healthy-only',
        answerQuery: request.message,
        statusFilter: 'healthy-only',
        ...(healthGroupTarget && { targets: [healthGroupTarget] }),
      };
    }

    const groupTarget = inferGroupTargetFromMessage(request.message);
    if (
      !messageMetric &&
      groupTarget &&
      explicitServerTargets.length === 0 &&
      classification.intent === 'data-lookup' &&
      GROUP_SERVER_LIST_PATTERN.test(request.message)
    ) {
      return {
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        sourceIntent: 'group-server-list',
        answerQuery: request.message,
        targets: [groupTarget],
      };
    }

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
  const targets = reconcileTargetsWithMessage(
    normalizeTargets(frame.targets),
    request.message
  );
  const frameThreshold =
    classification.intent === 'data-filter' &&
    classification.metric === metric &&
    classification.threshold !== undefined
      ? {
          threshold: classification.threshold,
          thresholdOperator: classification.operator ?? '>=',
        }
      : null;
  if (
    metric &&
    frame.intent === 'metric_current' &&
    !isMetricRankingFrame(frame) &&
    (capabilityId === undefined ||
      capabilityId === MONITORING_METRIC_CURRENT_CAPABILITY_ID ||
      capabilityId === MONITORING_METRIC_RANKING_CAPABILITY_ID)
  ) {
    // Multi-metric AND 쿼리("CPU와 메모리 둘 다 높은")는 entity extractor가
    // 단일 metric만 반환하더라도 message 기반 파싱으로 처리해야 복합점수가 올바르게 계산됨
    const mentionedMetrics = extractMentionedMetrics(request.message);
    if (mentionedMetrics.length >= 2 && isAndMetricFilterMessage(request.message)) {
      return null;
    }
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: frame.intent,
      answerQuery: request.message,
      metric,
      ...(frameThreshold ?? {}),
      ...(targets.length > 0 && { targets }),
    };
  }

  if (
    metric &&
    frame.intent === 'metric_trend' &&
    (capabilityId === undefined ||
      capabilityId === MONITORING_METRIC_TREND_CAPABILITY_ID)
  ) {
    return {
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: frame.intent,
      answerQuery: request.message,
      metric,
      ...(targets.length > 0 && { targets }),
    };
  }

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
  const groupTarget = inferGroupTargetFromMessage(message);
  const groupTargets = extractGroupTargetsFromMessage(message);
  const mentionedMetrics = extractMentionedMetrics(message);
  const explicitServerTargets = extractServerIdTargetsFromMessage(message);

  if (isHealthyOnlyServerListMessage(message)) {
    const healthGroupTarget = inferGroupTargetFromMessage(message);
    return {
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'healthy-only',
      answerQuery: message,
      statusFilter: 'healthy-only',
      ...(healthGroupTarget && { targets: [healthGroupTarget] }),
    };
  }

  if (COMPOSITE_LOAD_RANKING_PATTERN.test(message)) {
    return {
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      sourceIntent: 'composite-load-ranking',
      answerQuery: message,
      rankBasis: 'composite-load',
      rankOrder: 'asc',
      rankCount: normalizeCompositeLoadRankCount(message),
    };
  }

  if (
    !metric &&
    groupTarget &&
    explicitServerTargets.length === 0 &&
    classification.intent === 'data-lookup' &&
    GROUP_SERVER_LIST_PATTERN.test(message)
  ) {
    return {
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'group-server-list',
      answerQuery: message,
      targets: [groupTarget],
    };
  }

  if (
    metric &&
    explicitServerTargets.length >= 2 &&
    isCurrentServerComparisonMessage(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-compare',
      answerQuery: message,
      metric,
      targets: explicitServerTargets,
    };
  }

  if (
    metric &&
    groupTargets.length >= 2 &&
    isCurrentServerComparisonMessage(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'group-compare',
      answerQuery: message,
      metric,
      groupTargets: groupTargets.slice(0, 2),
    };
  }

  if (
    metric &&
    explicitServerTargets.length === 1 &&
    (classification.intent === 'data-lookup' ||
      classification.intent === 'unknown') &&
    !HISTORICAL_OR_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-metric',
      answerQuery: message,
      metric,
      targets: explicitServerTargets,
    };
  }

  if (
    mentionedMetrics.length >= 2 &&
    isAndMetricFilterMessage(message) &&
    !HISTORICAL_OR_TREND_PATTERN.test(message) &&
    explicitServerTargets.length === 0
  ) {
    if (
      classification.intent === 'data-filter' &&
      classification.threshold !== undefined &&
      (classification.operator === undefined ||
        classification.operator === '>=' ||
        classification.operator === '>')
    ) {
      return {
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        sourceIntent: 'multi-metric-filter',
        answerQuery: message,
        metrics: mentionedMetrics,
        threshold: classification.threshold,
        thresholdOperator: classification.operator ?? '>=',
        filterOperator: 'AND',
        ...(groupTarget && { targets: [groupTarget] }),
      };
    }
    // threshold 없는 "둘 다 높은" 형태 — 복합 메트릭 교차 정렬
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'multi-metric-no-threshold',
      answerQuery: message,
      metrics: mentionedMetrics,
      filterOperator: 'AND',
      ...(groupTarget && { targets: [groupTarget] }),
    };
  }

  if (
    classification.intent === 'data-filter' &&
    metric &&
    classification.threshold !== undefined &&
    !HISTORICAL_OR_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: classification.intent,
      answerQuery: message,
      metric,
      threshold: classification.threshold,
      thresholdOperator: classification.operator ?? '>=',
      ...(explicitServerTargets.length > 0
        ? { targets: explicitServerTargets }
        : groupTarget
          ? { targets: [groupTarget] }
          : {}),
    };
  }

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
    metric &&
    CURRENT_METRIC_GROUP_PATTERN.test(message) &&
    !HISTORICAL_OR_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: classification.intent,
      answerQuery: message,
      metric,
      ...(groupTarget && { targets: [groupTarget] }),
    };
  }

  if (
    classification.intent === 'data-lookup' &&
    metric &&
    METRIC_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: classification.intent,
      answerQuery: message,
      metric,
    };
  }

  if (
    classification.intent === 'data-lookup' &&
    SERVER_HEALTH_PATTERN.test(message) &&
    !SERVER_HEALTH_EXCLUSION_PATTERN.test(message)
  ) {
    const healthGroupTarget = inferGroupTargetFromMessage(message);
    return {
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: classification.intent,
      answerQuery: message,
      ...(healthGroupTarget && { targets: [healthGroupTarget] }),
    };
  }

  if (ACTION_NEEDED_PATTERN.test(message)) {
    const actionGroupTarget = inferGroupTargetFromMessage(message);
    return {
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'action-needed',
      answerQuery: message,
      ...(actionGroupTarget && { targets: [actionGroupTarget] }),
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

  let answer: string | null;
  if (parsed.intent === 'metric_current') {
    answer = buildMetricCurrentAnswer({ parsed, snapshot });
  } else if (parsed.intent === 'metric_trend') {
    answer = buildMetricTrendAnswer({ parsed, snapshot });
  } else if (
    parsed.intent === 'metric_ranking' &&
    parsed.rankBasis === 'composite-load'
  ) {
    answer = buildCompositeLoadRankingAnswer({ parsed, snapshot });
  } else if (
    parsed.intent === 'server_health' &&
    parsed.sourceIntent === 'group-server-list'
  ) {
    answer = buildGroupServerHealthAnswer({ parsed, snapshot });
  } else if (
    parsed.intent === 'server_health' &&
    parsed.statusFilter === 'healthy-only'
  ) {
    answer = buildHealthyOnlyServerAnswer({ parsed, snapshot });
  } else {
    answer =
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
  }

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
      ...(parsed.groupTargets && { groupTargets: parsed.groupTargets }),
      ...(parsed.metric && { metric: parsed.metric }),
      ...(parsed.metrics && { metrics: parsed.metrics }),
      ...(parsed.threshold !== undefined && { threshold: parsed.threshold }),
      ...(parsed.thresholdOperator && {
        thresholdOperator: parsed.thresholdOperator,
      }),
      ...(parsed.filterOperator && { filterOperator: parsed.filterOperator }),
      ...(parsed.rankCount && { rankCount: parsed.rankCount }),
      ...(parsed.rankOrder && { rankOrder: parsed.rankOrder }),
      ...(parsed.rankBasis && { rankBasis: parsed.rankBasis }),
      ...(parsed.statusFilter && { statusFilter: parsed.statusFilter }),
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

export const monitoringMetricCurrentEvidenceProvider =
  createCurrentMetricsEvidenceProvider({
    id: 'monitoring-metric-current',
    intent: 'metric_current',
  });

export const monitoringMetricTrendEvidenceProvider =
  createCurrentMetricsEvidenceProvider({
    id: 'monitoring-metric-trend',
    intent: 'metric_trend',
  });

export const monitoringServerHealthEvidenceProvider =
  createCurrentMetricsEvidenceProvider({
    id: 'monitoring-server-health',
    intent: 'server_health',
  });
