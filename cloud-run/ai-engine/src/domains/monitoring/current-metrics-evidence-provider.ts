import type {
  DomainEvidenceProvider,
  DomainEvidenceRequest,
  DomainSnapshot,
} from '../../core/assistant-runtime';
import { METRICS_QUERY_AGENT_NAME } from '../../core/assistant-runtime/agent-name-compat';
import {
  buildDeterministicSummaryFromCurrentState,
} from '../../services/ai-sdk/agents/orchestrator-summary-fallback';
import {
  buildCompositeLoadRankingAnswer,
  buildGroupHealthCompareAnswer,
  buildGroupServerHealthAnswer,
  buildHealthyOnlyServerAnswer,
  buildMetricCurrentAnswer,
  buildMetricRankingAnswer,
  buildMetricTrendAnswer,
  buildTopBottomServerHealthAnswer,
} from './current-metrics-evidence-answers';
import {
  filterSnapshotServers,
  getMetricValue,
  normalizeRankCount,
} from './current-metrics-answer-utils';
import { buildDirectionalMultiMetricFilterAnswer } from './current-metrics-directional-answer';
import {
  parseCurrentMetricsEvidenceRequest,
  type CurrentMetricsEvidenceIntent,
  type ParsedCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-request';
import {
  readSnapshotSlotIndex,
  readSnapshotServers,
  readSnapshotTimeLabel,
} from './snapshot-utils';

export type {
  MetricCondition,
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
} from './current-metrics-evidence-request';
export { parseCurrentMetricsEvidenceRequest } from './current-metrics-evidence-request';

async function resolveCurrentSnapshot(
  request: DomainEvidenceRequest
): Promise<DomainSnapshot | null> {
  return request.dataSource?.snapshot(request) ?? null;
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

function resolveRankingCrossMetricTargets(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): ParsedCurrentMetricsEvidenceRequest {
  if (
    params.parsed.sourceIntent !== 'ranking-cross-metric' ||
    !params.parsed.sourceMetric
  ) {
    return params.parsed;
  }

  const sourceMetric = params.parsed.sourceMetric;
  const allServers = readSnapshotServers(params.snapshot);
  const { servers } = filterSnapshotServers(allServers, params.parsed.targets);
  const rankOrder = params.parsed.rankOrder ?? 'desc';
  const rankedTargets = servers
    .filter((server) => server.status !== 'offline')
    .map((server) => ({
      server,
      value: getMetricValue(server, sourceMetric),
    }))
    .filter(
      (row): row is { server: (typeof servers)[number]; value: number } =>
        row.value !== null
    )
    .sort((left, right) =>
      rankOrder === 'asc' ? left.value - right.value : right.value - left.value
    )
    .slice(0, normalizeRankCount(params.parsed.rankCount))
    .map((row) => row.server.id);

  if (rankedTargets.length === 0) return params.parsed;

  return {
    ...params.parsed,
    targets: rankedTargets,
    contextualTargets: false,
  };
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

  const parsedForAnswer = resolveRankingCrossMetricTargets({ parsed, snapshot });

  let answer: string | null;
  if (parsedForAnswer.intent === 'metric_current') {
    answer =
      parsedForAnswer.metricConditions &&
      parsedForAnswer.metricConditions.length > 0
        ? buildDirectionalMultiMetricFilterAnswer({
            metricConditions: parsedForAnswer.metricConditions,
            parsed: parsedForAnswer,
            snapshot,
          })
        : buildMetricCurrentAnswer({ parsed: parsedForAnswer, snapshot });
  } else if (parsedForAnswer.intent === 'metric_trend') {
    answer = buildMetricTrendAnswer({ parsed: parsedForAnswer, snapshot });
  } else if (
    parsedForAnswer.intent === 'metric_ranking' &&
    parsedForAnswer.rankBasis === 'composite-load'
  ) {
    answer = buildCompositeLoadRankingAnswer({ parsed: parsedForAnswer, snapshot });
  } else if (parsedForAnswer.intent === 'metric_ranking') {
    answer = buildMetricRankingAnswer({ parsed: parsedForAnswer, snapshot });
  } else if (
    parsedForAnswer.intent === 'server_health' &&
    parsedForAnswer.sourceIntent === 'group-health-compare'
  ) {
    answer = buildGroupHealthCompareAnswer({ parsed: parsedForAnswer, snapshot });
  } else if (
    parsedForAnswer.intent === 'server_health' &&
    parsedForAnswer.sourceIntent === 'top-bottom-health'
  ) {
    answer = buildTopBottomServerHealthAnswer({ parsed: parsedForAnswer, snapshot });
  } else if (
    parsedForAnswer.intent === 'server_health' &&
    parsedForAnswer.sourceIntent === 'group-server-list'
  ) {
    answer = buildGroupServerHealthAnswer({ parsed: parsedForAnswer, snapshot });
  } else if (
    parsedForAnswer.intent === 'server_health' &&
    parsedForAnswer.statusFilter === 'healthy-only'
  ) {
    answer = buildHealthyOnlyServerAnswer({ parsed: parsedForAnswer, snapshot });
  } else {
    answer =
      buildDeterministicSummaryFromCurrentState(
        parsedForAnswer.answerQuery,
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
    prompt: buildCurrentMetricsPrompt({ parsed: parsedForAnswer, snapshot, answer }),
    fallback: answer,
    metadata: {
      responsePolicy: 'deterministic_answer',
      capabilityId: parsedForAnswer.capabilityId,
      intent: parsedForAnswer.intent,
      sourceIntent: parsedForAnswer.sourceIntent,
      timestamp: snapshot.timestamp,
      ...(readSnapshotSlotIndex(snapshot) !== undefined && {
        slotIndex: readSnapshotSlotIndex(snapshot),
      }),
      ...(readSnapshotTimeLabel(snapshot) && {
        timeLabel: readSnapshotTimeLabel(snapshot),
      }),
      ...(parsedForAnswer.targets && { targets: parsedForAnswer.targets }),
      ...(parsedForAnswer.groupTargets && {
        groupTargets: parsedForAnswer.groupTargets,
      }),
      ...(parsedForAnswer.metric && { metric: parsedForAnswer.metric }),
      ...(parsedForAnswer.sourceMetric && {
        sourceMetric: parsedForAnswer.sourceMetric,
      }),
      ...(parsedForAnswer.metrics && { metrics: parsedForAnswer.metrics }),
      ...(parsedForAnswer.threshold !== undefined && {
        threshold: parsedForAnswer.threshold,
      }),
      ...(parsedForAnswer.thresholdOperator && {
        thresholdOperator: parsedForAnswer.thresholdOperator,
      }),
      ...(parsedForAnswer.filterOperator && {
        filterOperator: parsedForAnswer.filterOperator,
      }),
      ...(parsedForAnswer.metricConditions && {
        metricConditions: parsedForAnswer.metricConditions,
      }),
      ...(parsedForAnswer.filterConditions && {
        filterConditions: parsedForAnswer.filterConditions,
      }),
      ...(parsedForAnswer.rankCount && { rankCount: parsedForAnswer.rankCount }),
      ...(parsedForAnswer.rankOrder && { rankOrder: parsedForAnswer.rankOrder }),
      ...(parsedForAnswer.rankRange && { rankRange: parsedForAnswer.rankRange }),
      ...(parsedForAnswer.rankBasis && { rankBasis: parsedForAnswer.rankBasis }),
      ...(parsedForAnswer.statusFilter && {
        statusFilter: parsedForAnswer.statusFilter,
      }),
      ...(parsedForAnswer.trendDirection && {
        trendDirection: parsedForAnswer.trendDirection,
      }),
      ...(parsedForAnswer.trendRankBy && {
        trendRankBy: parsedForAnswer.trendRankBy,
      }),
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
