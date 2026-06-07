import type {
  DomainEvidenceProvider,
  DomainEvidenceRequest,
  DomainEvidenceResult,
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
import { extractServerIdTargetsFromMessage } from './current-metrics-request-helpers';

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

type BoundaryGuardReason =
  | 'unsupported_metric'
  | 'unknown_server'
  | 'ambiguous_single_server';

type UnsupportedMetric = {
  id: string;
  label: string;
};

const SUPPORTED_MONITORING_SCOPE =
  'CPU, 메모리, 디스크, 네트워크, 서버 상태, 24시간 load 피크';

function detectUnsupportedMetric(message: string): UnsupportedMetric | null {
  if (/\bgpu\b|그래픽\s*카드|가속기/i.test(message)) {
    return { id: 'gpu', label: 'GPU 사용률' };
  }
  if (
    /(?:kubernetes|k8s|쿠버네티스|pod|pods|파드|container|컨테이너).{0,40}(?:restart|restarts?|재시작)/i.test(
      message
    )
  ) {
    return { id: 'kubernetes_pod_restart', label: 'Kubernetes pod restart' };
  }
  return null;
}

function isAmbiguousSingleServerDetailPrompt(message: string): boolean {
  if (extractServerIdTargetsFromMessage(message).length > 0) return false;

  const asksForSingleServer =
    /(?:서버|호스트|노드)\s*(?:하나|한\s*대|1\s*대|one)|(?:하나|한\s*대|1\s*대|one)\s*(?:서버|호스트|노드)/i.test(
      message
    );
  if (!asksForSingleServer) return false;

  const asksForDetail =
    /자세|상세|상태|현황|알려|보여|detail|status|health|show/i.test(message);
  if (!asksForDetail) return false;

  return !/가장|상위|하위|최고|최저|높|낮|많|적|위험|안정|경고|문제|조치|정상|warning|critical|online|offline|top|bottom|highest|lowest/i.test(
    message
  );
}

function buildBoundaryPrompt(answer: string): string {
  return [
    '[결정적 monitoring 경계 응답]',
    '아래 답변을 그대로 반환하고, 임의 서버/수치/순위를 만들지 마세요.',
    '',
    answer,
  ].join('\n');
}

function buildBoundaryEvidence(params: {
  answer: string;
  reason: BoundaryGuardReason;
  metadata?: Record<string, unknown>;
}): DomainEvidenceResult {
  return {
    id: 'monitoring-boundary-guard',
    prompt: buildBoundaryPrompt(params.answer),
    fallback: params.answer,
    metadata: {
      responsePolicy: 'deterministic_clarification',
      reason: params.reason,
      ...(params.metadata ?? {}),
    },
  };
}

function buildUnsupportedMetricEvidence(
  metric: UnsupportedMetric
): DomainEvidenceResult {
  const answer = [
    `⚠️ **지원하지 않는 지표입니다: ${metric.label}**`,
    `• 현재 OpenManager AI의 결정적 monitoring snapshot은 ${SUPPORTED_MONITORING_SCOPE}만 근거로 제공합니다.`,
    '• 실제 근거 없이 GPU, pod restart 같은 미수집 지표의 순위나 수치를 만들지 않겠습니다.',
    '• 지원 지표로 다시 질문해 주세요. 예: "네트워크 사용률 상위 서버 3대", "CPU 60% 이상인 서버".',
  ].join('\n');

  return buildBoundaryEvidence({
    answer,
    reason: 'unsupported_metric',
    metadata: {
      unsupportedMetric: metric.id,
      unsupportedMetricLabel: metric.label,
      supportedMetrics: ['cpu', 'memory', 'disk', 'network', 'status', 'load'],
    },
  });
}

function getServerIdSuggestions(params: {
  missingTargets: string[];
  snapshot: DomainSnapshot;
}): string[] {
  const servers = readSnapshotServers(params.snapshot);
  const prefixes = params.missingTargets
    .flatMap((target) => target.toLowerCase().split('-').slice(0, 2))
    .filter((part) => part.length >= 2);
  const matched = servers
    .map((server) => server.id)
    .filter((serverId) =>
      prefixes.some((prefix) => serverId.toLowerCase().includes(prefix))
    );
  const suggestions =
    matched.length > 0 ? matched : servers.map((server) => server.id);
  return Array.from(new Set(suggestions)).slice(0, 5);
}

function buildUnknownServerEvidence(params: {
  missingTargets: string[];
  snapshot: DomainSnapshot;
}): DomainEvidenceResult {
  const suggestions = getServerIdSuggestions(params);
  const answer = [
    '⚠️ **서버를 찾지 못했습니다**',
    `• 요청한 서버 ID: ${params.missingTargets.join(', ')}`,
    '• 현재 OTel snapshot에 이 서버 ID가 없습니다. 비슷한 그룹명으로 전체 서버를 대신 조회하지 않겠습니다.',
    suggestions.length > 0
      ? `• 사용 가능한 예시 서버 ID: ${suggestions.join(', ')}`
      : '• 서버 ID를 다시 확인해 주세요.',
  ].join('\n');

  return buildBoundaryEvidence({
    answer,
    reason: 'unknown_server',
    metadata: {
      missingTargets: params.missingTargets,
      suggestedTargets: suggestions,
    },
  });
}

async function buildAmbiguousSingleServerEvidence(
  request: DomainEvidenceRequest
): Promise<DomainEvidenceResult> {
  const snapshot = await resolveCurrentSnapshot(request);
  const examples = snapshot
    ? readSnapshotServers(snapshot)
        .map((server) => server.id)
        .slice(0, 4)
    : [];
  const answer = [
    '⚠️ **어떤 서버를 볼지 지정해 주세요**',
    '• "서버 하나"만으로는 대상 서버를 결정할 근거가 부족합니다.',
    '• 서버 ID나 그룹을 함께 알려주면 해당 범위만 조회하겠습니다.',
    examples.length > 0
      ? `• 예: ${examples.join(', ')}`
      : '• 예: "web-nginx-dc1-01 자세히 알려줘", "DB 서버 상태 알려줘".',
  ].join('\n');

  return buildBoundaryEvidence({
    answer,
    reason: 'ambiguous_single_server',
  });
}

function getMissingExplicitServerTargets(params: {
  request: DomainEvidenceRequest;
  snapshot: DomainSnapshot;
}): string[] {
  const explicitTargets = extractServerIdTargetsFromMessage(
    params.request.message
  );
  if (explicitTargets.length === 0) return [];

  const existingIds = new Set(
    readSnapshotServers(params.snapshot).map((server) => server.id.toLowerCase())
  );
  return explicitTargets.filter(
    (target) => !existingIds.has(target.toLowerCase())
  );
}

async function resolveBoundaryGuardEvidence(
  request: DomainEvidenceRequest
): Promise<DomainEvidenceResult | null> {
  const unsupportedMetric = detectUnsupportedMetric(request.message);
  if (unsupportedMetric) {
    return buildUnsupportedMetricEvidence(unsupportedMetric);
  }

  if (isAmbiguousSingleServerDetailPrompt(request.message)) {
    return buildAmbiguousSingleServerEvidence(request);
  }

  const explicitTargets = extractServerIdTargetsFromMessage(request.message);
  if (explicitTargets.length === 0) return null;

  const snapshot = await resolveCurrentSnapshot(request);
  if (!snapshot) return null;

  const missingTargets = getMissingExplicitServerTargets({ request, snapshot });
  if (missingTargets.length === 0) return null;

  return buildUnknownServerEvidence({ missingTargets, snapshot });
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

export const monitoringBoundaryGuardEvidenceProvider: DomainEvidenceProvider = {
  id: 'monitoring-boundary-guard',
  canHandle(request: DomainEvidenceRequest): boolean {
    return (
      detectUnsupportedMetric(request.message) !== null ||
      isAmbiguousSingleServerDetailPrompt(request.message) ||
      extractServerIdTargetsFromMessage(request.message).length > 0
    );
  },
  resolve(request: DomainEvidenceRequest) {
    return resolveBoundaryGuardEvidence(request);
  },
};

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
