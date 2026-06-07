import type { DomainEvidenceRequest } from '../../core/assistant-runtime';
import { STATUS_THRESHOLDS } from '../../config/status-thresholds';
import {
  classifyQueryIntent,
} from '../../services/ai-sdk/agents/orchestrator-query-intent';
import {
  isCurrentNearFullMetricLookup,
} from '../../services/ai-sdk/routing/routing-patterns';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  ACTION_NEEDED_PATTERN,
  GROUP_SERVER_LIST_PATTERN,
  HISTORICAL_OR_TREND_PATTERN,
  METRIC_RISK_COMPARISON_PATTERN,
  METRIC_TREND_PATTERN,
  SERVER_DETAIL_PATTERN,
} from './current-metrics-evidence-patterns';
import {
  extractMetricDirectionalConditions,
} from './current-metrics-directional-conditions';
import {
  extractGroupTargetsFromMessage,
  extractServerIdTargetsFromMessage,
  inferGroupTargetFromMessage,
  isCurrentServerComparisonMessage,
  isHealthyOnlyServerListMessage,
  normalizeRankCount,
  normalizeRankOrder,
  normalizeTargets,
  reconcileTargetsWithMessage,
} from './current-metrics-request-helpers';
import {
  buildGroupHealthCompareRequest,
  buildCrossMetricConditionAggregateRequest,
  buildMetricRiskComparisonRequest,
  buildRankingCrossMetricRequest,
  buildTrendRequestOptions,
  buildTrendThresholdOptions,
  extractMentionedMetrics,
  inferMetricRankingRange,
  isAndMetricFilterMessage,
  isMetricRankingFrame,
  normalizeSupportedMetric,
  resolveMetricTargets,
  resolveTrendMetrics,
} from './current-metrics-evidence-request-utils';
import {
  isTopBottomServerHealthMessage,
  resolveExplicitStatusFilter,
} from './current-metrics-evidence-status';
import type { ParsedCurrentMetricsEvidenceRequest } from './current-metrics-evidence-request-types';

export function parseCurrentMetricsFrame(
  request: DomainEvidenceRequest
): ParsedCurrentMetricsEvidenceRequest | null {
  const frame = request.intentFrame;
  if (!frame || frame.domainId !== MONITORING_DOMAIN_ID) return null;

  const capabilityId = request.capability?.id ?? frame.capabilityId;
  const classification = classifyQueryIntent(request.message);
  const messageMetric = normalizeSupportedMetric(classification.metric);
  const explicitServerTargets = extractServerIdTargetsFromMessage(request.message);
  const requestGroupTarget = inferGroupTargetFromMessage(request.message);
  const mentionedMetrics = extractMentionedMetrics(request.message);
  const metricConditions = extractMetricDirectionalConditions(request.message);
  const statusFilter = resolveExplicitStatusFilter(
    request.message,
    classification.statusValue
  );

  if (
    mentionedMetrics.length >= 2 &&
    METRIC_RISK_COMPARISON_PATTERN.test(request.message)
  ) {
    const metricTargets = resolveMetricTargets({
      request,
      explicitServerTargets,
      groupTarget: requestGroupTarget,
    });
    return buildMetricRiskComparisonRequest({
      message: request.message,
      metrics: mentionedMetrics,
      targets: metricTargets,
    });
  }

  if (
    messageMetric &&
    isCurrentNearFullMetricLookup(request.message) &&
    !HISTORICAL_OR_TREND_PATTERN.test(request.message)
  ) {
    const metricTargets = resolveMetricTargets({
      request,
      explicitServerTargets,
      groupTarget: requestGroupTarget,
    });
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'current-near-full-filter',
      answerQuery: request.message,
      metric: messageMetric,
      threshold: STATUS_THRESHOLDS[messageMetric].warning,
      thresholdOperator: '>=',
      ...(metricTargets.length > 0 && { targets: metricTargets }),
    };
  }

  if (
    metricConditions.length >= 2 &&
    isAndMetricFilterMessage(request.message) &&
    !HISTORICAL_OR_TREND_PATTERN.test(request.message) &&
    explicitServerTargets.length === 0
  ) {
    const groupTarget = inferGroupTargetFromMessage(request.message);
    const metricTargets = resolveMetricTargets({
      request,
      explicitServerTargets,
      groupTarget,
    });
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'multi-metric-directional-filter',
      answerQuery: request.message,
      metrics: metricConditions.map((condition) => condition.metric),
      metricConditions,
      filterOperator: 'AND',
      ...(metricTargets.length > 0 && { targets: metricTargets }),
    };
  }

  if (
    explicitServerTargets.length === 1 &&
    mentionedMetrics.length >= 2 &&
    !HISTORICAL_OR_TREND_PATTERN.test(request.message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-multi-metric',
      answerQuery: request.message,
      metrics: mentionedMetrics,
      targets: explicitServerTargets,
    };
  }

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
    if (isTopBottomServerHealthMessage(request.message)) {
      const healthGroupTarget = inferGroupTargetFromMessage(request.message);
      return {
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        sourceIntent: 'top-bottom-health',
        answerQuery: request.message,
        rankCount: normalizeRankCount(frame.topN),
        ...(healthGroupTarget && { targets: [healthGroupTarget] }),
      };
    }

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

    const healthGroupTargets = extractGroupTargetsFromMessage(request.message);
    const healthGroupCompare = buildGroupHealthCompareRequest({
      message: request.message,
      groupTargets: healthGroupTargets,
      metric: messageMetric,
      statusFilter,
    });
    if (healthGroupCompare) return healthGroupCompare;

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
      : resolveMetricTargets({
          request,
          explicitServerTargets,
          groupTarget: requestGroupTarget,
        });
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
    const crossMetricAggregate = buildCrossMetricConditionAggregateRequest({
      message: request.message,
      targets,
      statusFilter,
    });
    if (crossMetricAggregate) return crossMetricAggregate;

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
      ...(statusFilter && { statusFilter }),
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
      ...buildTrendThresholdOptions(classification, metric),
      ...buildTrendRequestOptions(request.message),
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
        ...buildTrendRequestOptions(request.message),
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
    const rankingCrossMetric = buildRankingCrossMetricRequest({
      message: request.message,
      targets,
    });
    if (rankingCrossMetric) return rankingCrossMetric;

    const rankCount = normalizeRankCount(frame.topN);
    const rankOrder = normalizeRankOrder(frame, request.message);
    const rankRange = inferMetricRankingRange(request.message);
    return {
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      sourceIntent: frame.intent,
      answerQuery:
        rankRange === 'top-bottom'
          ? request.message
          : `${metric} ${rankOrder === 'asc' ? '하위' : '상위'} ${rankCount}개 서버 알려줘`,
      metric,
      rankCount,
      rankOrder,
      ...(rankRange && { rankRange }),
      ...(targets.length > 0 && { targets }),
    };
  }

  return null;
}
