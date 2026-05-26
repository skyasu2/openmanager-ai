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
  buildGroupServerHealthAnswer,
  buildHealthyOnlyServerAnswer,
  buildMetricCurrentAnswer,
  buildMetricTrendAnswer,
} from './current-metrics-evidence-answers';
import {
  parseCurrentMetricsEvidenceRequest,
  type CurrentMetricsEvidenceIntent,
  type ParsedCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-request';

export type {
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
} from './current-metrics-evidence-request';
export { parseCurrentMetricsEvidenceRequest } from './current-metrics-evidence-request';

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
