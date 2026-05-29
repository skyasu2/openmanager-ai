import type {
  DomainEvidenceRequest,
  DomainIntentFrame,
} from '../../core/assistant-runtime';
import type { classifyQueryIntent } from '../../services/ai-sdk/agents/orchestrator-query-intent';
import {
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  DEFAULT_TREND_METRICS,
  GENERIC_METRIC_TREND_PATTERN,
  GROUP_HEALTH_COMPARISON_PATTERN,
  METRIC_RISK_COMPARISON_PATTERN,
  METRIC_TREND_RANKING_PATTERN,
} from './current-metrics-evidence-patterns';
import {
  extractContextualServerTargetsFromMessages,
  isCurrentServerComparisonMessage,
  normalizeRankCount,
} from './current-metrics-request-helpers';
import type {
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
  TrendDirection,
  TrendRankBy,
} from './current-metrics-evidence-request';

export function normalizeSupportedMetric(
  metric: string | undefined
): SupportedMetric | null {
  if (!metric) return null;
  const normalized = metric.toLowerCase();
  return ['cpu', 'memory', 'disk', 'network'].includes(normalized)
    ? (normalized as SupportedMetric)
    : null;
}

export function extractMentionedMetrics(message: string): SupportedMetric[] {
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

export function resolveTrendMetrics(
  message: string,
  metric: SupportedMetric | null
): SupportedMetric[] {
  if (metric && metric !== 'network') return [metric];
  if (metric === 'network') return [];

  const mentionedMetrics = extractMentionedMetrics(message).filter(
    (mentionedMetric) => mentionedMetric !== 'network'
  );
  if (mentionedMetrics.length > 0) return mentionedMetrics;

  return GENERIC_METRIC_TREND_PATTERN.test(message)
    ? DEFAULT_TREND_METRICS
    : [];
}

export function isAndMetricFilterMessage(message: string): boolean {
  return /모두|둘\s*다|동시에|전부|와|과|및|고(?=\s)|면서|반면|\band\b|&&|\+/i.test(
    message
  );
}

function extractExplicitTrendRankCount(message: string): number | undefined {
  const match =
    message.match(/(?:상위|하위|top|bottom)\s*(\d{1,2})/i) ??
    message.match(/(\d{1,2})\s*(?:개|대|위)/);
  if (!match) return undefined;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0
    ? normalizeRankCount(parsed)
    : undefined;
}

function inferTrendRankBy(message: string): TrendRankBy | undefined {
  return METRIC_TREND_RANKING_PATTERN.test(message) ? 'delta' : undefined;
}

function inferTrendDirection(message: string): TrendDirection | undefined {
  if (/감소|하락|내려|낮아|줄어|decreas|declin|drop|fall/i.test(message)) {
    return 'decrease';
  }
  if (/증가|상승|올라|높아|늘어|increase|rise|grow/i.test(message)) {
    return 'increase';
  }
  return undefined;
}

export function buildTrendRequestOptions(
  message: string
): Pick<
  ParsedCurrentMetricsEvidenceRequest,
  'rankCount' | 'trendDirection' | 'trendRankBy'
> {
  const rankCount = extractExplicitTrendRankCount(message);
  const trendDirection = inferTrendDirection(message);
  const trendRankBy = inferTrendRankBy(message);
  return {
    ...(rankCount !== undefined && { rankCount }),
    ...(trendDirection && { trendDirection }),
    ...(trendRankBy && { trendRankBy }),
  };
}

export function buildTrendThresholdOptions(
  classification: ReturnType<typeof classifyQueryIntent>,
  metric: SupportedMetric
): Pick<
  ParsedCurrentMetricsEvidenceRequest,
  'threshold' | 'thresholdOperator'
> {
  return classification.intent === 'data-filter' &&
    classification.metric === metric &&
    classification.threshold !== undefined
    ? {
        threshold: classification.threshold,
        thresholdOperator: classification.operator ?? '>=',
      }
    : {};
}

export function buildGroupHealthCompareRequest(params: {
  message: string;
  groupTargets: string[];
  metric: SupportedMetric | null;
}): ParsedCurrentMetricsEvidenceRequest | null {
  if (
    params.metric ||
    params.groupTargets.length < 2 ||
    !isCurrentServerComparisonMessage(params.message) ||
    !GROUP_HEALTH_COMPARISON_PATTERN.test(params.message)
  ) {
    return null;
  }

  return {
    intent: 'server_health',
    capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
    sourceIntent: 'group-health-compare',
    answerQuery: params.message,
    groupTargets: params.groupTargets.slice(0, 2),
  };
}

export function normalizeMetricRankingCount(
  message: string,
  rankCount: number | undefined
): number {
  const hasExplicitRankCount =
    /(?:상위|하위|top|bottom)\s*\d{1,2}|(\d{1,2})\s*(?:개|대|위)/i.test(
      message
    );
  if (hasExplicitRankCount) return normalizeRankCount(rankCount);
  return /가장|최저|최고|highest|lowest|most|least/i.test(message) ? 1 : 3;
}

export function resolveMetricTargets(params: {
  request: DomainEvidenceRequest;
  explicitServerTargets: string[];
  groupTarget?: string;
}): string[] {
  if (params.explicitServerTargets.length > 0) {
    return params.explicitServerTargets;
  }
  if (params.groupTarget) return [params.groupTarget];
  return extractContextualServerTargetsFromMessages(params.request);
}

export function buildMetricRiskComparisonRequest(params: {
  message: string;
  metrics: SupportedMetric[];
  targets: string[];
}): ParsedCurrentMetricsEvidenceRequest | null {
  if (
    params.metrics.length < 2 ||
    !METRIC_RISK_COMPARISON_PATTERN.test(params.message)
  ) {
    return null;
  }

  return {
    intent: 'metric_current',
    capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
    sourceIntent: 'metric-risk-compare',
    answerQuery: params.message,
    metrics: params.metrics,
    rankOrder: 'desc',
    rankCount: params.metrics.length,
    ...(params.targets.length > 0 && { targets: params.targets }),
  };
}

export function isMetricRankingFrame(frame: DomainIntentFrame): boolean {
  return (
    frame.intent === 'metric_ranking' ||
    (frame.intent === 'metric_current' &&
      /top_n|rank|ranking/i.test(frame.aggregation ?? ''))
  );
}
