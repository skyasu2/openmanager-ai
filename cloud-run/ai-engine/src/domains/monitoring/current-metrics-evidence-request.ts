import type {
  DomainEvidenceRequest,
  DomainIntentFrame,
} from '../../core/assistant-runtime';
import {
  classifyQueryIntent,
  type QueryMetric,
  type QueryOperator,
  type QueryRankOrder,
} from '../../services/ai-sdk/agents/orchestrator-query-intent';
import {
  FORCE_KB_QUERY_PATTERN,
  shouldPreferAdvisorForOperationalAdvice,
} from '../../services/ai-sdk/routing/query-routing-signals';
import { isServiceCommandGuidanceQuery } from '../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  ACTION_NEEDED_PATTERN,
  COMPOSITE_LOAD_RANKING_PATTERN,
  CURRENT_METRIC_GROUP_PATTERN,
  DEFAULT_TREND_METRICS,
  GENERIC_METRIC_TREND_PATTERN,
  GROUP_SERVER_LIST_PATTERN,
  HISTORICAL_OR_TREND_PATTERN,
  METRIC_TREND_PATTERN,
  SERVER_DETAIL_PATTERN,
  SERVER_HEALTH_EXCLUSION_PATTERN,
  SERVER_HEALTH_PATTERN,
} from './current-metrics-evidence-patterns';
import {
  extractMetricDirectionalConditions,
  type MetricCondition,
} from './current-metrics-directional-conditions';
import {
  extractContextualServerTargetsFromMessages,
  extractGroupTargetsFromMessage,
  extractServerIdTargetsFromMessage,
  inferGroupTargetFromMessage,
  isCurrentServerComparisonMessage,
  isHealthyOnlyServerListMessage,
  normalizeCompositeLoadRankCount,
  normalizeRankCount,
  normalizeRankOrder,
  normalizeTargets,
  reconcileTargetsWithMessage,
} from './current-metrics-request-helpers';

export type CurrentMetricsEvidenceIntent =
  | 'metric_current'
  | 'metric_ranking'
  | 'metric_trend'
  | 'server_health';
export type SupportedMetric = Exclude<QueryMetric, 'status'>;
export type { MetricCondition };

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
  metricConditions?: MetricCondition[];
  rankCount?: number;
  rankOrder?: QueryRankOrder;
  rankBasis?: 'composite-load';
  statusFilter?: 'healthy-only';
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

function resolveTrendMetrics(message: string, metric: SupportedMetric | null): SupportedMetric[] {
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

function isAndMetricFilterMessage(message: string): boolean {
  return /모두|둘\s*다|동시에|전부|와|과|및|고(?=\s)|면서|반면|\band\b|&&|\+/i.test(
    message
  );
}

function resolveMetricTargets(params: {
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
  const frameTargets = reconcileTargetsWithMessage(
    normalizeTargets(frame.targets),
    request.message
  );
  const targets =
    frameTargets.length > 0
      ? frameTargets
      : extractContextualServerTargetsFromMessages(request);
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
    const mentionedMetrics = extractMentionedMetrics(request.message);
    if (mentionedMetrics.length >= 2 && isAndMetricFilterMessage(request.message)) {
      return null;
    }

    if (
      METRIC_TREND_PATTERN.test(request.message) ||
      HISTORICAL_OR_TREND_PATTERN.test(request.message)
    ) {
      return null;
    }

    const groupTargetsForFrame = extractGroupTargetsFromMessage(request.message);
    const isExplicitServerCompare =
      explicitServerTargets.length >= 2 &&
      isCurrentServerComparisonMessage(request.message);
    const serverCompareMetrics =
      isExplicitServerCompare && mentionedMetrics.length >= 2
        ? mentionedMetrics
        : null;
    const metricTargets = isExplicitServerCompare ? explicitServerTargets : targets;
    if (
      groupTargetsForFrame.length >= 2 &&
      isCurrentServerComparisonMessage(request.message)
    ) {
      return {
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        sourceIntent: 'group-compare',
        answerQuery: request.message,
        metric,
        groupTargets: groupTargetsForFrame.slice(0, 2),
      };
    }

    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: isExplicitServerCompare ? 'server-compare' : frame.intent,
      answerQuery: request.message,
      ...(serverCompareMetrics ? { metrics: serverCompareMetrics } : { metric }),
      ...(frameThreshold ?? {}),
      ...(metricTargets.length > 0 && { targets: metricTargets }),
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
    !metric &&
    frame.intent === 'metric_trend' &&
    (capabilityId === undefined ||
      capabilityId === MONITORING_METRIC_TREND_CAPABILITY_ID)
  ) {
    const trendMetrics = resolveTrendMetrics(request.message, null);
    if (trendMetrics.length > 0) {
      return {
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        sourceIntent: frame.intent,
        answerQuery: request.message,
        metrics: trendMetrics,
        ...(targets.length > 0 && { targets }),
      };
    }
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
      ...(targets.length > 0 && { targets }),
    };
  }

  return null;
}

function parseCurrentMetricsMessage(
  request: DomainEvidenceRequest
): ParsedCurrentMetricsEvidenceRequest | null {
  const message = request.message;
  if (isServiceCommandGuidanceQuery(message)) return null;

  const classification = classifyQueryIntent(message);
  const metric =
    classification.metric && classification.metric !== 'status'
      ? classification.metric
      : null;
  const groupTarget = inferGroupTargetFromMessage(message);
  const groupTargets = extractGroupTargetsFromMessage(message);
  const mentionedMetrics = extractMentionedMetrics(message);
  const metricConditions = extractMetricDirectionalConditions(message);
  const explicitServerTargets = extractServerIdTargetsFromMessage(message);
  const metricTargets = resolveMetricTargets({
    request,
    explicitServerTargets,
    groupTarget,
  });

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
    const serverCompareMetrics =
      mentionedMetrics.length >= 2 ? mentionedMetrics : null;
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-compare',
      answerQuery: message,
      ...(serverCompareMetrics ? { metrics: serverCompareMetrics } : { metric }),
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
    groupTargets.length === 1 &&
    explicitServerTargets.length === 0 &&
    /평균|average|avg/i.test(message) &&
    !isCurrentServerComparisonMessage(message) &&
    !METRIC_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'group-aggregate',
      answerQuery: message,
      metric,
      targets: groupTargets,
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
    metricConditions.length >= 2 &&
    isAndMetricFilterMessage(message) &&
    !HISTORICAL_OR_TREND_PATTERN.test(message) &&
    explicitServerTargets.length === 0
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'multi-metric-directional-filter',
      answerQuery: message,
      metrics: metricConditions.map((condition) => condition.metric),
      metricConditions,
      filterOperator: 'AND',
      ...(metricTargets.length > 0 && { targets: metricTargets }),
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
        ...(metricTargets.length > 0 && { targets: metricTargets }),
      };
    }
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'multi-metric-no-threshold',
      answerQuery: message,
      metrics: mentionedMetrics,
      filterOperator: 'AND',
      ...(metricTargets.length > 0 && { targets: metricTargets }),
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
      ...(metricTargets.length > 0 && { targets: metricTargets }),
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
      ...(metricTargets.length > 0 && { targets: metricTargets }),
    };
  }

  if (
    classification.intent === 'data-lookup' &&
    metric &&
    metricTargets.length > 0 &&
    !HISTORICAL_OR_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'contextual-follow-up',
      answerQuery: message,
      metric,
      targets: metricTargets,
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
      ...(metricTargets.length > 0 && { targets: metricTargets }),
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
      ...(metricTargets.length > 0 && { targets: metricTargets }),
    };
  }

  if (
    classification.intent === 'data-lookup' &&
    !metric &&
    METRIC_TREND_PATTERN.test(message)
  ) {
    const trendMetrics = resolveTrendMetrics(message, null);
    if (trendMetrics.length > 0) {
      return {
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        sourceIntent: 'generic-metric-trend',
        answerQuery: message,
        metrics: trendMetrics,
        ...(metricTargets.length > 0 && { targets: metricTargets }),
      };
    }
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
  if (shouldPreferAdvisorForOperationalAdvice(request.message)) return null;

  return (
    parseCurrentMetricsFrame(request) ?? parseCurrentMetricsMessage(request)
  );
}
