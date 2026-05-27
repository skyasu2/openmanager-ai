import {
  classifyQueryIntent,
  shouldPreferDeterministic,
} from './orchestrator-query-intent';
import {
  buildMetricThresholdPredictionFromPayload,
  buildMetricRankingFromPayload,
  buildMetricThresholdFilterFromPayload,
  isMetricThresholdPredictionQuery,
} from './orchestrator-summary-metric';
import {
  buildActionNeededAnswer,
  buildRequestedServerStatusAnswer,
} from './orchestrator-summary-current-status';
import {
  buildExplicitServerOperationalAnswer,
  buildHaproxyDistributionAnswer,
  buildSummaryFromPayloadForQuery,
  isExplicitServerOperationalQuery,
  isStatusAlertOperationalQuery,
} from './orchestrator-summary-operational';
import {
  buildSummaryPayloadFromCurrentState,
  getMetricsPayload,
  getPayloadServerEvidenceCount,
  type CollectedToolResult,
  type MetricsToolPayload,
  type ServerSnapshot,
} from './orchestrator-summary-payload';
import { isServiceCommandGuidanceQuery } from '../../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';

export { classifyQueryIntent, shouldPreferDeterministic };

type ComparableMetric = 'cpu' | 'memory' | 'disk' | 'network';

interface GroupToolPayload {
  group: string;
  label: string;
  servers: ServerSnapshot[];
  timeLabel?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeComparableMetric(value: string | undefined): ComparableMetric | null {
  if (
    value === 'cpu' ||
    value === 'memory' ||
    value === 'disk' ||
    value === 'network'
  ) {
    return value;
  }
  return null;
}

function inferComparableMetric(query: string): ComparableMetric | null {
  const classification = classifyQueryIntent(query);
  const classifiedMetric = normalizeComparableMetric(classification.metric);
  if (classifiedMetric) return classifiedMetric;

  if (/\bcpu\b|씨피유/i.test(query)) return 'cpu';
  if (/메모리|\bmem\b|\bmemory\b/i.test(query)) return 'memory';
  if (/디스크|\bdisk\b|스토리지|\bstorage\b/i.test(query)) return 'disk';
  if (/네트워크|\bnetwork\b|\bnet\b/i.test(query)) return 'network';
  return null;
}

function getComparableMetricLabel(metric: ComparableMetric): string {
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

function getGroupLabel(group: string, servers: ServerSnapshot[]): string {
  const normalized = (group || servers[0]?.type || '').toLowerCase();
  switch (normalized) {
    case 'application':
    case 'api':
    case 'app':
    case 'backend':
    case 'was':
      return '애플리케이션 서버';
    case 'web':
    case 'nginx':
      return '웹 서버';
    case 'database':
    case 'db':
    case 'mysql':
      return 'DB 서버';
    case 'cache':
    case 'redis':
      return '캐시 서버';
    case 'storage':
    case 'nfs':
      return '스토리지 서버';
    case 'loadbalancer':
    case 'lb':
    case 'haproxy':
      return '로드밸런서';
    default:
      return '서버 그룹';
  }
}

function readGroupToolPayload(entry: CollectedToolResult): GroupToolPayload | null {
  if (
    entry.toolName !== 'getServerByGroup' &&
    entry.toolName !== 'getServerByGroupAdvanced'
  ) {
    return null;
  }
  if (!isRecord(entry.result)) return null;

  const servers = Array.isArray(entry.result.servers)
    ? entry.result.servers.filter(
        (server): server is ServerSnapshot =>
          isRecord(server) &&
          typeof server.id === 'string' &&
          typeof server.status === 'string'
      )
    : [];
  if (servers.length === 0) return null;

  const group =
    typeof entry.result.group === 'string'
      ? entry.result.group.trim()
      : servers[0]?.type ?? '';
  const dataSlot = isRecord(entry.result.dataSlot)
    ? entry.result.dataSlot
    : undefined;
  const timeLabel =
    typeof dataSlot?.timeLabel === 'string'
      ? dataSlot.timeLabel.trim()
      : undefined;

  return {
    group,
    label: getGroupLabel(group, servers),
    servers,
    ...(timeLabel && { timeLabel }),
  };
}

function readMetricValue(
  server: ServerSnapshot,
  metric: ComparableMetric
): number | null {
  const value = server[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number): string {
  return `${round1(value)}%`;
}

function isGroupMetricComparisonQuery(query: string): boolean {
  return /\bvs\.?\b|versus|비교|대비|차이|보다|와|과|\band\b|더\s*많|더\s*높|높아|많이/i.test(
    query
  );
}

function buildGroupMetricComparisonFallback(
  query: string,
  toolResults: CollectedToolResult[]
): string | null {
  if (!isGroupMetricComparisonQuery(query)) return null;

  const metric = inferComparableMetric(query);
  if (!metric) return null;

  const seenGroups = new Set<string>();
  const groupPayloads: GroupToolPayload[] = [];
  for (const entry of toolResults) {
    const payload = readGroupToolPayload(entry);
    if (!payload) continue;

    const groupKey = payload.group.toLowerCase() || payload.label;
    if (seenGroups.has(groupKey)) continue;
    seenGroups.add(groupKey);
    groupPayloads.push(payload);
    if (groupPayloads.length >= 2) break;
  }
  if (groupPayloads.length < 2) return null;

  const metricLabel = getComparableMetricLabel(metric);
  const summaries = groupPayloads
    .map((payload) => {
      const rows = payload.servers
        .map((server) => ({
          server,
          value: readMetricValue(server, metric),
        }))
        .filter(
          (row): row is { server: ServerSnapshot; value: number } =>
            row.value !== null
        )
        .sort((left, right) => right.value - left.value);
      if (rows.length === 0) return null;

      const values = rows.map((row) => row.value);
      const avg = round1(
        values.reduce((sum, value) => sum + value, 0) / values.length
      );
      return { ...payload, rows, avg };
    })
    .filter((summary): summary is NonNullable<typeof summary> => summary !== null);
  if (summaries.length < 2) return null;

  const sortedByAverage = [...summaries].sort(
    (left, right) => right.avg - left.avg
  );
  const leader = sortedByAverage[0];
  const follower = sortedByAverage[1];
  if (!leader || !follower) return null;

  const diff = round1(leader.avg - follower.avg);
  const timeLabel = summaries.find((summary) => summary.timeLabel)?.timeLabel;
  const conclusion =
    diff === 0
      ? `두 그룹의 평균 ${metricLabel}가 동일합니다.`
      : `${leader.label}가 ${follower.label}보다 평균 ${metricLabel} ${diff}%p 높습니다.`;

  return [
    `📊 **${summaries.map((summary) => summary.label).join(' vs ')} ${metricLabel} 비교**`,
    `• 대상: ${summaries
      .map((summary) => `${summary.label} ${summary.rows.length}대`)
      .join(' · ')}${timeLabel ? ` · 데이터 슬롯 ${timeLabel}` : ''}`,
    `• 평균: ${summaries
      .map((summary) => `${summary.label} ${formatPercent(summary.avg)}`)
      .join(' · ')}`,
    `• 결론: ${conclusion}`,
    '',
    '📌 **그룹별 서버 현황**',
    ...summaries.flatMap((summary) =>
      summary.rows.map(
        (row, index) =>
          `${index + 1}. ${summary.label} / **${row.server.id}**: ${metricLabel} ${formatPercent(row.value)} (상태 ${row.server.status})`
      )
    ),
  ].join('\n');
}

/**
 * Determines whether to prefer deterministic (LLM-free) response for this
 * query, based on structural intent classification and tool result completeness.
 *
 * Replaces the previous env-specific regex approach with parseable
 * intent + metric metadata.
 */
export function isDeterministicSummaryQuery(
  query: string,
  _agentName: string,
  toolResultServerCount = 0
): boolean {
  if (isServiceCommandGuidanceQuery(query)) {
    return false;
  }

  if (
    toolResultServerCount > 0 &&
    (isStatusAlertOperationalQuery(query) ||
      isExplicitServerOperationalQuery(query))
  ) {
    return true;
  }

  const classification = classifyQueryIntent(query);
  if (
    toolResultServerCount > 0 &&
    isMetricThresholdPredictionQuery(query, classification)
  ) {
    return true;
  }

  return shouldPreferDeterministic(classification, toolResultServerCount);
}

function buildDeterministicAnswerFromPayload(
  query: string,
  payload: MetricsToolPayload,
  lookupPayload?: MetricsToolPayload | null
): string {
  const explicitServerAnswer = buildExplicitServerOperationalAnswer(
    query,
    payload,
    lookupPayload
  );
  if (explicitServerAnswer) {
    return explicitServerAnswer;
  }

  const haproxyDistributionAnswer = buildHaproxyDistributionAnswer(query, payload);
  if (haproxyDistributionAnswer) {
    return haproxyDistributionAnswer;
  }

  const requestedServerStatusAnswer = buildRequestedServerStatusAnswer(
    query,
    payload,
    lookupPayload
  );
  if (requestedServerStatusAnswer) {
    return requestedServerStatusAnswer;
  }

  const actionNeededAnswer = buildActionNeededAnswer(query, payload);
  if (actionNeededAnswer) {
    return actionNeededAnswer;
  }

  const classification = classifyQueryIntent(query);

  if (classification.intent === 'predictive') {
    const metricPredictionAnswer = buildMetricThresholdPredictionFromPayload(
      query,
      payload,
      classification
    );
    if (metricPredictionAnswer) {
      return metricPredictionAnswer;
    }
  }

  if (classification.intent === 'data-filter') {
    const metricFilterAnswer = buildMetricThresholdFilterFromPayload(
      payload,
      classification
    );
    if (metricFilterAnswer) {
      return metricFilterAnswer;
    }
  }

  if (classification.intent === 'data-ranking') {
    const metricRankingAnswer = buildMetricRankingFromPayload(payload, classification);
    if (metricRankingAnswer) {
      return metricRankingAnswer;
    }
  }

  return buildSummaryFromPayloadForQuery(query, payload);
}

// Deterministic fallback avoids another LLM call when metrics data is already available.
export function buildDeterministicSummaryFallback(
  query: string,
  agentName: string,
  toolResults: CollectedToolResult[],
  stateData?: unknown
): string | null {
  const payload = getMetricsPayload(toolResults);
  if (!payload) {
    return null;
  }
  const lookupPayload = buildSummaryPayloadFromCurrentState(stateData);

  if (!isDeterministicSummaryQuery(query, agentName, getPayloadServerEvidenceCount(payload))) {
    return null;
  }

  const groupMetricComparison = buildGroupMetricComparisonFallback(query, toolResults);
  if (groupMetricComparison) {
    return groupMetricComparison;
  }

  return buildDeterministicAnswerFromPayload(query, payload, lookupPayload);
}

// Final fallback for summary prompts when model emits no text and skips all tool calls.
export function buildDeterministicSummaryFromCurrentState(
  query: string,
  agentName: string,
  stateData?: unknown
): string | null {
  const payload = buildSummaryPayloadFromCurrentState(stateData);
  if (!payload) {
    return null;
  }

  if (!isDeterministicSummaryQuery(query, agentName, getPayloadServerEvidenceCount(payload))) {
    return null;
  }

  return buildDeterministicAnswerFromPayload(query, payload, payload);
}
