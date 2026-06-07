import type { DomainEvidenceRequest } from '../../core/assistant-runtime';
import { STATUS_THRESHOLDS } from '../../config/status-thresholds';
import {
  classifyQueryIntent,
} from '../../services/ai-sdk/agents/orchestrator-query-intent';
import {
  isCurrentNearFullMetricLookup,
} from '../../services/ai-sdk/routing/routing-patterns';
import { isServiceCommandGuidanceQuery } from '../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';
import {
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  ACTION_NEEDED_PATTERN,
  COMPOSITE_LOAD_RANKING_PATTERN,
  COMPOSITE_PRESSURE_RANKING_PATTERN,
  CURRENT_METRIC_GROUP_PATTERN,
  GROUP_SERVER_LIST_PATTERN,
  HISTORICAL_OR_TREND_PATTERN,
  METRIC_RISK_COMPARISON_PATTERN,
  METRIC_TREND_PATTERN,
  METRIC_TREND_RANKING_PATTERN,
  NEAR_THRESHOLD_PATTERN,
  NEAR_THRESHOLD_INFERRED_VALUE,
  SERVER_HEALTH_EXCLUSION_PATTERN,
  SERVER_HEALTH_PATTERN,
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
  normalizeCompositeLoadRankCount,
  normalizeCompositePressureRankCount,
} from './current-metrics-request-helpers';
import {
  buildGroupHealthCompareRequest,
  buildCrossMetricConditionAggregateRequest,
  buildMetricRiskComparisonRequest,
  buildRankingCrossMetricRequest,
  buildTrendRequestOptions,
  extractMentionedMetrics,
  inferMetricRankingRange,
  isAndMetricFilterMessage,
  normalizeMetricRankingCount,
  resolveMetricTargets,
  resolveTrendMetrics,
} from './current-metrics-evidence-request-utils';
import {
  isTopBottomServerHealthMessage,
  resolveExplicitStatusFilter,
} from './current-metrics-evidence-status';
import type { ParsedCurrentMetricsEvidenceRequest } from './current-metrics-evidence-request-types';

export function parseCurrentMetricsMessage(
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
  const statusFilter = resolveExplicitStatusFilter(
    message,
    classification.statusValue
  );

  if (isTopBottomServerHealthMessage(message)) {
    const healthGroupTarget = inferGroupTargetFromMessage(message);
    return {
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'top-bottom-health',
      answerQuery: message,
      rankCount: normalizeMetricRankingCount(message, classification.rankCount),
      ...(healthGroupTarget && { targets: [healthGroupTarget] }),
    };
  }

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

  if (!metric && COMPOSITE_PRESSURE_RANKING_PATTERN.test(message)) {
    return {
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      sourceIntent: 'composite-pressure-ranking',
      answerQuery: message,
      rankBasis: 'composite-load',
      rankOrder: 'desc',
      rankCount: normalizeCompositePressureRankCount(message),
      ...(metricTargets.length > 0 && { targets: metricTargets }),
    };
  }

  if (
    mentionedMetrics.length >= 2 &&
    METRIC_RISK_COMPARISON_PATTERN.test(message)
  ) {
    return buildMetricRiskComparisonRequest({
      message,
      metrics: mentionedMetrics,
      targets: metricTargets,
    });
  }

  const groupHealthCompare = buildGroupHealthCompareRequest({
    message,
    groupTargets,
    metric,
    statusFilter,
  });
  if (groupHealthCompare) return groupHealthCompare;

  if (
    metric &&
    isCurrentNearFullMetricLookup(message) &&
    !HISTORICAL_OR_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'current-near-full-filter',
      answerQuery: message,
      metric,
      threshold: STATUS_THRESHOLDS[metric].warning,
      thresholdOperator: '>=',
      ...(metricTargets.length > 0 && { targets: metricTargets }),
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
      ...(statusFilter && { statusFilter }),
    };
  }

  const crossMetricAggregate = buildCrossMetricConditionAggregateRequest({
    message,
    targets: metricTargets,
    statusFilter,
  });
  if (crossMetricAggregate) return crossMetricAggregate;

  const rankingCrossMetric = buildRankingCrossMetricRequest({
    message,
    targets: metricTargets,
  });
  if (rankingCrossMetric) return rankingCrossMetric;

  // P24: all-scope 평균 집계 — "전체 서버 평균 CPU"처럼 그룹/서버 타깃이 없는
  // 단일 메트릭 평균 질의. buildMetricCurrentAnswer는 targets 미지정 시
  // filterSnapshotServers(allServers, undefined)로 전체 서버(label '전체 서버')의
  // 평균/최고/최저를 계산하므로 별도 answer 분기 없이 그대로 재사용한다.
  // 주의: HISTORICAL_OR_TREND_PATTERN 에는 '평균'이 포함되어 있어 group-aggregate
  // 와 동일하게 METRIC_TREND_PATTERN 만으로 트렌드 질의를 배제한다.
  if (
    metric &&
    groupTargets.length === 0 &&
    explicitServerTargets.length === 0 &&
    metricTargets.length === 0 &&
    /평균|average|avg/i.test(message) &&
    !isCurrentServerComparisonMessage(message) &&
    !METRIC_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'all-aggregate',
      answerQuery: message,
      metric,
      ...(statusFilter && { statusFilter }),
    };
  }

  if (
    explicitServerTargets.length === 1 &&
    mentionedMetrics.length >= 2 &&
    !HISTORICAL_OR_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-multi-metric',
      answerQuery: message,
      metrics: mentionedMetrics,
      targets: explicitServerTargets,
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
    // P18: 임계치 근처 / 곧 위험 — inferred threshold AND filter (multi-metric-filter
    // 분기보다 우선해 sourceIntent를 명확히 보존)
    if (NEAR_THRESHOLD_PATTERN.test(message)) {
      return {
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        sourceIntent: 'multi-metric-near-threshold',
        answerQuery: message,
        metrics: mentionedMetrics,
        threshold: NEAR_THRESHOLD_INFERRED_VALUE,
        thresholdOperator: '>=',
        filterOperator: 'AND',
        ...(metricTargets.length > 0 && { targets: metricTargets }),
      };
    }
    if (
      classification.intent === 'data-filter' &&
      classification.threshold !== undefined
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
    (METRIC_TREND_PATTERN.test(message) ||
      HISTORICAL_OR_TREND_PATTERN.test(message))
  ) {
    return {
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: 'trend-threshold-filter',
      answerQuery: message,
      metric,
      threshold: classification.threshold,
      thresholdOperator: classification.operator ?? '>=',
      ...buildTrendRequestOptions(message),
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
      ...(statusFilter && { statusFilter }),
    };
  }

  if (metric && METRIC_TREND_RANKING_PATTERN.test(message)) {
    return {
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: 'ranking-trend',
      answerQuery: message,
      metric,
      ...buildTrendRequestOptions(message),
      ...(metricTargets.length > 0 && { targets: metricTargets }),
    };
  }

  // P19a: data-ranking이라도 명시적 트렌드 표현(증가율/상승률 등)이면 metric_trend 우선
  if (
    classification.intent === 'data-ranking' &&
    metric &&
    METRIC_TREND_PATTERN.test(message)
  ) {
    return {
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: 'ranking-trend',
      answerQuery: message,
      metric,
      ...buildTrendRequestOptions(message),
      ...(metricTargets.length > 0 && { targets: metricTargets }),
    };
  }

  if (
    classification.intent === 'data-ranking' &&
    metric &&
    !HISTORICAL_OR_TREND_PATTERN.test(message)
  ) {
    const rankRange = inferMetricRankingRange(message);
    return {
      intent: 'metric_ranking',
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      sourceIntent: classification.intent,
      answerQuery: message,
      metric,
      rankCount: normalizeMetricRankingCount(message, classification.rankCount),
      rankOrder: classification.rankOrder ?? 'desc',
      ...(rankRange && { rankRange }),
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
      ...buildTrendRequestOptions(message),
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
        ...buildTrendRequestOptions(message),
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
