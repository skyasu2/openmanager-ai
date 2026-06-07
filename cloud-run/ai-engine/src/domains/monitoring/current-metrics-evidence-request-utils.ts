import type {
  DomainEvidenceRequest,
  DomainIntentFrame,
} from '../../core/assistant-runtime';
import { STATUS_THRESHOLDS } from '../../config/status-thresholds';
import type {
  QueryOperator,
  QueryStatus,
} from '../../services/ai-sdk/agents/orchestrator-query-intent';
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
  RANKING_CROSS_METRIC_PATTERN,
} from './current-metrics-evidence-patterns';
import {
  extractContextualServerTargetsFromMessages,
  isCurrentServerComparisonMessage,
  normalizeRankCount,
} from './current-metrics-request-helpers';
import type {
  MetricCondition,
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
  TrendDirection,
  TrendRankBy,
} from './current-metrics-evidence-request-types';

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

type MetricMention = {
  metric: SupportedMetric;
  startIndex: number;
  endIndex: number;
};

const METRIC_MENTION_PATTERNS: Array<[SupportedMetric, RegExp]> = [
  ['cpu', /\bcpu\b|씨피유/gi],
  ['memory', /메모리|\bmem\b|\bmemory\b|\bmemori\b|\bmemroy\b/gi],
  ['disk', /디스크|\bdisk\b|스토리지|\bstorage\b/gi],
  ['network', /네트워크|\bnetwork\b|\bnet\b/gi],
];

const LOW_THRESHOLD_BY_METRIC: Record<SupportedMetric, number> = {
  cpu: 50,
  memory: 50,
  disk: 50,
  network: 30,
};

function extractMetricMentions(message: string): MetricMention[] {
  const mentions: MetricMention[] = [];
  for (const [metric, pattern] of METRIC_MENTION_PATTERNS) {
    for (const match of message.matchAll(pattern)) {
      const value = match[0];
      if (match.index === undefined || !value) continue;
      mentions.push({
        metric,
        startIndex: match.index,
        endIndex: match.index + value.length,
      });
    }
  }

  const seenMetrics = new Set<SupportedMetric>();
  return mentions
    .sort((left, right) => left.startIndex - right.startIndex)
    .filter((mention) => {
      if (seenMetrics.has(mention.metric)) return false;
      seenMetrics.add(mention.metric);
      return true;
    });
}

function findAverageKeywordIndex(message: string): number | null {
  const match = message.match(/평균|average|avg/i);
  return match?.index ?? null;
}

function inferAggregateMetricFromAveragePhrase(
  message: string,
  mentions: MetricMention[]
): SupportedMetric | null {
  const averageIndex = findAverageKeywordIndex(message);
  if (averageIndex === null || mentions.length === 0) return null;

  const byDistance = [...mentions].sort((left, right) => {
    const leftDistance =
      left.startIndex >= averageIndex
        ? left.startIndex - averageIndex
        : averageIndex - left.endIndex;
    const rightDistance =
      right.startIndex >= averageIndex
        ? right.startIndex - averageIndex
        : averageIndex - right.endIndex;
    return leftDistance - rightDistance;
  });

  return byDistance[0]?.metric ?? null;
}

function normalizeFilterOperator(raw: string | undefined): QueryOperator {
  if (!raw) return '>=';
  const value = raw.trim().toLowerCase();
  if (value === '이상') return '>=';
  if (value === '초과' || value.startsWith('넘')) return '>';
  if (value === '이하') return '<=';
  if (value === '미만') return '<';
  return value as QueryOperator;
}

function parseLocalThresholdCondition(text: string): Pick<
  MetricCondition,
  'operator' | 'threshold'
> | null {
  const patterns: Array<RegExp> = [
    /(\d{1,3})\s*%?\s*(>=|<=|>|<|이상|초과|이하|미만|넘(?:는|은)?)/i,
    /(>=|<=|>|<|이상|초과|이하|미만|넘(?:는|은)?)\s*(\d{1,3})\s*%?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const first = match[1] ?? '';
    const second = match[2] ?? '';
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    const threshold = Number.isFinite(firstNumber) ? firstNumber : secondNumber;
    const operatorRaw = Number.isFinite(firstNumber) ? second : first;

    if (Number.isFinite(threshold) && threshold >= 0 && threshold <= 100) {
      return {
        operator: normalizeFilterOperator(operatorRaw),
        threshold,
      };
    }
  }

  return null;
}

function buildMetricFilterCondition(
  message: string,
  mention: MetricMention
): MetricCondition | null {
  const before = message.slice(Math.max(0, mention.startIndex - 16), mention.startIndex);
  const after = message.slice(mention.endIndex, Math.min(message.length, mention.endIndex + 32));
  const context = `${before} ${after}`;
  const explicitThreshold = parseLocalThresholdCondition(context);
  if (explicitThreshold) {
    return {
      metric: mention.metric,
      operator: explicitThreshold.operator,
      threshold: explicitThreshold.threshold,
    };
  }

  if (/critical|위험|심각/i.test(context)) {
    return {
      metric: mention.metric,
      operator: '>=',
      threshold: STATUS_THRESHOLDS[mention.metric].critical,
      inferredThreshold: true,
    };
  }

  if (/warning|경고|문제|이상|높|많|과다|포화|high|heavy|elevated/i.test(context)) {
    return {
      metric: mention.metric,
      operator: '>=',
      threshold: STATUS_THRESHOLDS[mention.metric].warning,
      inferredThreshold: true,
    };
  }

  if (/낮|적|여유|한가|low|idle|under/i.test(context)) {
    return {
      metric: mention.metric,
      operator: '<=',
      threshold: LOW_THRESHOLD_BY_METRIC[mention.metric],
      inferredThreshold: true,
    };
  }

  return null;
}

export function buildCrossMetricConditionAggregateRequest(params: {
  message: string;
  targets: string[];
  statusFilter?: QueryStatus;
}): ParsedCurrentMetricsEvidenceRequest | null {
  if (!/평균|average|avg/i.test(params.message)) return null;

  const mentions = extractMetricMentions(params.message);
  if (mentions.length < 2) return null;

  const aggregateMetric = inferAggregateMetricFromAveragePhrase(
    params.message,
    mentions
  );
  if (!aggregateMetric) return null;

  const filterConditions = mentions
    .filter((mention) => mention.metric !== aggregateMetric)
    .map((mention) => buildMetricFilterCondition(params.message, mention))
    .filter(
      (condition): condition is MetricCondition => condition !== null
    );

  // P30: statusFilter + 모든 메트릭이 집계 대상인 경우 (필터 메트릭 없음)
  // e.g., "경고 상태 서버들의 평균 메모리와 평균 디스크는?"
  if (filterConditions.length === 0) {
    if (params.statusFilter) {
      return {
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        sourceIntent: 'status-filter-multi-metric-aggregate',
        answerQuery: params.message,
        metrics: mentions.map((m) => m.metric),
        statusFilter: params.statusFilter,
        ...(params.targets.length > 0 && { targets: params.targets }),
      };
    }
    return null;
  }

  return {
    intent: 'metric_current',
    capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
    sourceIntent: 'cross-metric-condition-aggregate',
    answerQuery: params.message,
    metric: aggregateMetric,
    filterConditions,
    filterOperator: 'AND',
    ...(params.targets.length > 0 && { targets: params.targets }),
  };
}

export function buildRankingCrossMetricRequest(params: {
  message: string;
  targets: string[];
}): ParsedCurrentMetricsEvidenceRequest | null {
  if (!RANKING_CROSS_METRIC_PATTERN.test(params.message)) return null;

  const mentions = extractMetricMentions(params.message);
  if (mentions.length < 2) return null;

  const sourceMetric = mentions[0]?.metric;
  const targetMetric = mentions.at(-1)?.metric;
  if (!sourceMetric || !targetMetric || sourceMetric === targetMetric) {
    return null;
  }

  const rankOrder = /하위|낮|적|bottom|lowest|least/i.test(params.message)
    ? 'asc'
    : 'desc';
  const explicitRankCount =
    params.message.match(/(?:상위|하위|top|bottom)\s*(\d{1,2})/i)?.[1] ??
    params.message.match(/(\d{1,2})\s*(?:개|대|위)/)?.[1];
  const rankCount =
    explicitRankCount !== undefined
      ? normalizeRankCount(Number(explicitRankCount))
      : normalizeMetricRankingCount(params.message, undefined);

  return {
    intent: 'metric_current',
    capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
    sourceIntent: 'ranking-cross-metric',
    answerQuery: params.message,
    metric: targetMetric,
    sourceMetric,
    rankCount,
    rankOrder,
    ...(params.targets.length > 0 && { targets: params.targets }),
  };
}

export function inferMetricRankingRange(
  message: string
): ParsedCurrentMetricsEvidenceRequest['rankRange'] {
  const hasTop =
    /상위|top|최고|가장\s*(?:높|많)|highest|most/i.test(message);
  const hasBottom =
    /하위|bottom|최저|가장\s*(?:낮|적)|lowest|least/i.test(message);
  const hasConnector =
    /\+|와|과|및|그리고|함께|동시|둘\s*다|모두|both|\band\b/i.test(message);
  return hasTop && hasBottom && hasConnector ? 'top-bottom' : undefined;
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
  statusFilter?: QueryStatus;
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
    ...(params.statusFilter && { statusFilter: params.statusFilter }),
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
