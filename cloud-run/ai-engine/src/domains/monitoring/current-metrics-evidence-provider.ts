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
  get24hTrendSummaries,
  normalizeServerType,
} from '../../tools-ai-sdk/server-metrics/data';

type CurrentMetricsEvidenceIntent =
  | 'metric_current'
  | 'metric_ranking'
  | 'metric_trend'
  | 'server_health';
type SupportedMetric = Exclude<QueryMetric, 'status'>;

type SnapshotServer = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
};

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
  /(?:지금|현재|당장|즉시).{0,32}(?:조치|대응).{0,32}(?:필요|해야|대상|있|시급).{0,16}(?:서버|대상|순위)|(?:조치|대응).{0,16}(?:필요한|필요|대상|시급).{0,16}(?:서버|순위)|(?:서버|대상).{0,16}(?:조치|대응).{0,16}(?:필요|시급|우선순위|순위)|immediate\s+action|urgent\s+action|action\s+needed/i;
const CURRENT_METRIC_GROUP_PATTERN =
  /(?:\b(?:db|database|web|cache|storage|lb|loadbalancer|mysql|redis|nfs|was|api|app|application|backend)\b|로드\s*밸런서|캐시|스토리지|저장소|웹|디비|데이터베이스|애플리케이션)\s*(서버|그룹)?/i;
const METRIC_TREND_PATTERN = /추이|추세|trend|변화|변동/i;
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

function compareMetricValue(
  value: number,
  operator: QueryOperator | undefined,
  threshold: number
): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '>=':
    case undefined:
      return value >= threshold;
    case '==':
      return value === threshold;
    case '!=':
      return value !== threshold;
  }
}

function getThresholdOperatorLabel(
  operator: QueryOperator | undefined
): string {
  switch (operator) {
    case '>':
      return '초과';
    case '<':
      return '미만';
    case '<=':
      return '이하';
    case '==':
      return '동일';
    case '!=':
      return '제외';
    case '>=':
    case undefined:
      return '이상';
  }
}

function getThresholdOperatorSymbol(
  operator: QueryOperator | undefined
): string {
  return operator ?? '>=';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function getMetricLabel(metric: SupportedMetric): string {
  switch (metric) {
    case 'cpu':
      return 'CPU';
    case 'memory':
      return '메모리';
    case 'disk':
      return '디스크';
    case 'network':
      return '네트워크';
  }
}

function getMetricValue(server: SnapshotServer, metric: SupportedMetric): number | null {
  const value = server[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readSnapshotServers(snapshot: DomainSnapshot): SnapshotServer[] {
  const servers = isRecord(snapshot.data) ? snapshot.data.servers : undefined;
  if (!Array.isArray(servers)) return [];

  return servers.filter((server): server is SnapshotServer => {
    return isRecord(server) && typeof server.id === 'string';
  });
}

function inferTargetType(targets: string[]): string | null {
  for (const target of targets) {
    const normalized = normalizeServerType(target);
    if (normalized !== 'unknown') return normalized;
  }
  return null;
}

function filterSnapshotServers(
  servers: SnapshotServer[],
  targets: string[] | undefined
): { servers: SnapshotServer[]; targetLabel: string } {
  const normalizedTargets = targets ?? [];
  if (normalizedTargets.length === 0) {
    return { servers, targetLabel: '전체 서버' };
  }

  const targetIds = new Set(
    normalizedTargets.map((target) => target.toLowerCase())
  );
  const exactMatches = servers.filter((server) =>
    targetIds.has(server.id.toLowerCase())
  );
  if (exactMatches.length > 0) {
    const uniqueTypes = Array.from(
      new Set(exactMatches.map((server) => normalizeServerType(server.type ?? '')))
    ).filter((type) => type !== 'unknown');
    return {
      servers: exactMatches,
      targetLabel:
        uniqueTypes.length === 1
          ? `${getServerTypeKoreanLabel(uniqueTypes[0])} ${exactMatches.length}대`
          : `지정 서버 ${exactMatches.length}대`,
    };
  }

  const targetType = inferTargetType(normalizedTargets);
  if (targetType) {
    const groupMatches = servers.filter(
      (server) => normalizeServerType(server.type ?? '') === targetType
    );
    if (groupMatches.length > 0) {
      return {
        servers: groupMatches,
        targetLabel: `${getServerTypeKoreanLabel(targetType)} ${groupMatches.length}대`,
      };
    }
  }

  return { servers: [], targetLabel: '지정 서버 0대' };
}

function getServerTypeKoreanLabel(type: string): string {
  switch (normalizeServerType(type)) {
    case 'cache':
      return '캐시 서버';
    case 'database':
      return 'DB 서버';
    case 'loadbalancer':
      return '로드밸런서';
    case 'storage':
      return '스토리지 서버';
    case 'web':
      return '웹 서버';
    case 'application':
      return '애플리케이션 서버';
    default:
      return '서버';
  }
}

function formatMetricPercent(value: number): string {
  return `${round1(value)}%`;
}

function formatTrendDirection(delta: number): string {
  if (delta > 3) return '상승';
  if (delta < -3) return '하락';
  return '안정';
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
  const targets = reconcileTargetsWithMessage(
    normalizeTargets(frame.targets),
    request.message
  );
  if (
    metric &&
    frame.intent === 'metric_current' &&
    !isMetricRankingFrame(frame) &&
    (capabilityId === undefined ||
      capabilityId === MONITORING_METRIC_CURRENT_CAPABILITY_ID ||
      capabilityId === MONITORING_METRIC_RANKING_CAPABILITY_ID)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: frame.intent,
      answerQuery: request.message,
      metric,
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
    classification.intent === 'data-filter' &&
    classification.threshold !== undefined &&
    mentionedMetrics.length >= 2 &&
    isAndMetricFilterMessage(message) &&
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

function buildMetricCurrentAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.groupTargets && params.parsed.groupTargets.length >= 2) {
    return buildGroupMetricCompareAnswer(params);
  }

  if (
    params.parsed.metrics &&
    params.parsed.metrics.length > 0 &&
    params.parsed.threshold !== undefined
  ) {
    return buildMultiMetricFilterAnswer(params);
  }

  const metric = params.parsed.metric;
  if (!metric) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const rows = servers
    .map((server) => ({
      server,
      value: getMetricValue(server, metric),
    }))
    .filter((row): row is { server: SnapshotServer; value: number } => row.value !== null)
    .sort((left, right) => right.value - left.value);
  if (rows.length === 0) return null;

  const values = rows.map((row) => row.value);
  const avg = round1(values.reduce((sum, value) => sum + value, 0) / values.length);
  const max = rows[0];
  const min = rows[rows.length - 1];
  const metricLabel = getMetricLabel(metric);
  const timeLabel = readSnapshotTimeLabel(params.snapshot);

  return [
    `📊 **${targetLabel} ${metricLabel} 현황**`,
    `• 대상: ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 평균 ${metricLabel}: ${formatMetricPercent(avg)} · 최고 ${max.server.id} ${formatMetricPercent(max.value)} · 최저 ${min.server.id} ${formatMetricPercent(min.value)}`,
    `• 서버별: ${rows
      .map(
        (row) =>
          `${row.server.id} ${formatMetricPercent(row.value)} (${row.server.status ?? 'unknown'})`
      )
      .join(', ')}`,
  ].join('\n');
}

function buildGroupMetricCompareAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  const metric = params.parsed.metric;
  const groupTargets = params.parsed.groupTargets ?? [];
  if (!metric || groupTargets.length < 2) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const summaries = groupTargets
    .map((target) => {
      const targetType = normalizeServerType(target);
      const { servers } = filterSnapshotServers(allServers, [target]);
      const rows = servers
        .map((server) => ({
          server,
          value: getMetricValue(server, metric),
        }))
        .filter(
          (row): row is { server: SnapshotServer; value: number } =>
            row.value !== null
        )
        .sort((left, right) => right.value - left.value);
      if (rows.length === 0) return null;

      const values = rows.map((row) => row.value);
      const avg = round1(
        values.reduce((sum, value) => sum + value, 0) / values.length
      );
      const max = rows[0];
      const min = rows[rows.length - 1];
      if (!max || !min) return null;

      return {
        targetType,
        label: getServerTypeKoreanLabel(targetType),
        rows,
        avg,
        max,
        min,
      };
    })
    .filter((summary): summary is NonNullable<typeof summary> => summary !== null);
  if (summaries.length < 2) return null;

  const sortedByAverage = [...summaries].sort((left, right) => right.avg - left.avg);
  const leader = sortedByAverage[0];
  const follower = sortedByAverage[1];
  if (!leader || !follower) return null;

  const metricLabel = getMetricLabel(metric);
  const diff = round1(leader.avg - follower.avg);
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const conclusion =
    diff === 0
      ? `두 그룹의 평균 ${metricLabel}가 동일합니다.`
      : `${leader.label}가 ${follower.label}보다 평균 ${metricLabel} ${diff}%p 높습니다.`;

  return [
    `📊 **${summaries.map((summary) => summary.label).join(' vs ')} ${metricLabel} 비교**`,
    `• 대상: ${summaries
      .map((summary) => `${summary.label} ${summary.rows.length}대`)
      .join(' · ')}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 평균: ${summaries
      .map((summary) => `${summary.label} ${formatMetricPercent(summary.avg)}`)
      .join(' · ')}`,
    `• 결론: ${conclusion}`,
    `• 서버별: ${summaries
      .map(
        (summary) =>
          `${summary.label}: ${summary.rows
            .map((row) => `${row.server.id} ${formatMetricPercent(row.value)}`)
            .join(', ')}`
      )
      .join(' | ')}`,
  ].join('\n');
}

function buildMultiMetricFilterAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  const metrics = params.parsed.metrics ?? [];
  const threshold = params.parsed.threshold;
  if (metrics.length === 0 || threshold === undefined) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const rows = servers
    .map((server) => {
      const values = metrics.map((metric) => ({
        metric,
        value: getMetricValue(server, metric),
      }));
      if (values.some((entry) => entry.value === null)) return null;

      const numericValues = values as Array<{
        metric: SupportedMetric;
        value: number;
      }>;
      const matches =
        params.parsed.filterOperator === 'OR'
          ? numericValues.some((entry) =>
              compareMetricValue(
                entry.value,
                params.parsed.thresholdOperator,
                threshold
              )
            )
          : numericValues.every((entry) =>
              compareMetricValue(
                entry.value,
                params.parsed.thresholdOperator,
                threshold
              )
            );
      if (!matches) return null;

      return {
        server,
        values: numericValues,
        score: numericValues.reduce((sum, entry) => sum + entry.value, 0),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.score - left.score);

  const metricLabels = metrics.map(getMetricLabel);
  const conditionJoiner = params.parsed.filterOperator === 'OR' ? ' OR ' : ' AND ';
  const operatorLabel = getThresholdOperatorLabel(
    params.parsed.thresholdOperator
  );
  const operatorSymbol = getThresholdOperatorSymbol(
    params.parsed.thresholdOperator
  );
  const condition = metrics
    .map((metric) => `${getMetricLabel(metric)} ${operatorSymbol} ${threshold}%`)
    .join(conditionJoiner);
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const title = `${metricLabels.join(' + ')} ${threshold}% ${operatorLabel} 서버`;

  if (rows.length === 0) {
    return [
      `📊 **${title}**`,
      `• 조건: ${condition}`,
      `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      '• 결과: 현재 조건을 동시에 만족하는 서버는 없습니다.',
    ].join('\n');
  }

  return [
    `📊 **${title}**`,
    `• 조건: ${condition}`,
    `• 대상: ${targetLabel} 중 ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 서버별: ${rows
      .map((row) => {
        const metricText = row.values
          .map(
            (entry) =>
              `${getMetricLabel(entry.metric)} ${formatMetricPercent(entry.value)}`
          )
          .join(', ');
        return `${row.server.id} ${metricText} (${row.server.status ?? 'unknown'})`;
      })
      .join(', ')}`,
  ].join('\n');
}

function buildMetricTrendAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  const metric = params.parsed.metric;
  if (!metric || metric === 'network') return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const trendMap = new Map(
    get24hTrendSummaries().map((trend) => [trend.serverId, trend])
  );
  const rows = servers
    .map((server) => {
      const current = getMetricValue(server, metric);
      const trend = trendMap.get(server.id)?.[metric];
      if (current === null || !trend) return null;
      const delta = round1(current - trend.avg);
      return {
        server,
        current,
        avg24h: trend.avg,
        max24h: trend.max,
        min24h: trend.min,
        delta,
        direction: formatTrendDirection(delta),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.current - left.current);
  if (rows.length === 0) return null;

  const metricLabel = getMetricLabel(metric);
  const avgCurrent = round1(
    rows.reduce((sum, row) => sum + row.current, 0) / rows.length
  );
  const avg24h = round1(
    rows.reduce((sum, row) => sum + row.avg24h, 0) / rows.length
  );
  const directionCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.direction] = (acc[row.direction] ?? 0) + 1;
    return acc;
  }, {});
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const topRows = rows.slice(0, 5);

  return [
    `📈 **${targetLabel} ${metricLabel} 추이**`,
    `• 대상: ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 현재 평균 ${metricLabel}: ${formatMetricPercent(avgCurrent)} · 24h 평균 ${formatMetricPercent(avg24h)} · 전체 ${formatTrendDirection(avgCurrent - avg24h)}`,
    `• 추세 분포: 상승 ${directionCounts['상승'] ?? 0}대, 안정 ${directionCounts['안정'] ?? 0}대, 하락 ${directionCounts['하락'] ?? 0}대`,
    `• 현재 ${metricLabel} 상위: ${topRows
      .map(
        (row) =>
          `${row.server.id} ${formatMetricPercent(row.current)} (24h 평균 ${formatMetricPercent(row.avg24h)}, ${row.direction} ${row.delta >= 0 ? '+' : ''}${row.delta}%p)`
      )
      .join(', ')}`,
  ].join('\n');
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
    parsed.intent === 'metric_current'
      ? buildMetricCurrentAnswer({ parsed, snapshot })
      : parsed.intent === 'metric_trend'
        ? buildMetricTrendAnswer({ parsed, snapshot })
        : buildDeterministicSummaryFromCurrentState(
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
