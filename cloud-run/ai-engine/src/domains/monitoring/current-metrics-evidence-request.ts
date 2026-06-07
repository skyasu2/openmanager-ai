import type { DomainEvidenceRequest } from '../../core/assistant-runtime';
import {
  classifyQueryIntent,
  type QueryMetric,
  type QueryOperator,
  type QueryRankOrder,
  type QueryStatus,
} from '../../services/ai-sdk/agents/orchestrator-query-intent';
import {
  isCurrentNearFullMetricLookup,
} from '../../services/ai-sdk/routing/routing-patterns';
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
import { STATUS_THRESHOLDS } from '../../config/status-thresholds';
import {
  ACTION_NEEDED_PATTERN,
  COMPOSITE_LOAD_RANKING_PATTERN,
  COMPOSITE_PRESSURE_RANKING_PATTERN,
  CURRENT_METRIC_GROUP_PATTERN,
  EXPLICIT_RCA_QUERY_PATTERN,
  GROUP_SERVER_LIST_PATTERN,
  HISTORICAL_OR_TREND_PATTERN,
  METRIC_TREND_PATTERN,
  METRIC_RISK_COMPARISON_PATTERN,
  NEAR_THRESHOLD_PATTERN,
  NEAR_THRESHOLD_INFERRED_VALUE,
  SERVER_DETAIL_PATTERN,
  SERVER_HEALTH_EXCLUSION_PATTERN,
  SERVER_HEALTH_PATTERN,
} from './current-metrics-evidence-patterns';
import {
  extractMetricDirectionalConditions,
  type MetricCondition,
} from './current-metrics-directional-conditions';
import {
  extractGroupTargetsFromMessage,
  extractServerIdTargetsFromMessage,
  inferGroupTargetFromMessage,
  isCurrentServerComparisonMessage,
  isHealthyOnlyServerListMessage,
  normalizeCompositeLoadRankCount,
  normalizeCompositePressureRankCount,
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
  normalizeMetricRankingCount,
  normalizeSupportedMetric,
  resolveMetricTargets,
  resolveTrendMetrics,
} from './current-metrics-evidence-request-utils';

export type CurrentMetricsEvidenceIntent =
  | 'metric_current' | 'metric_ranking' | 'metric_trend' | 'server_health';
export type SupportedMetric = Exclude<QueryMetric, 'status'>;
export type { MetricCondition };
export type TrendDirection = 'increase' | 'decrease';
export type TrendRankBy = 'current' | 'delta';

export interface ParsedCurrentMetricsEvidenceRequest {
  intent: CurrentMetricsEvidenceIntent;
  capabilityId: string;
  sourceIntent: string;
  answerQuery: string;
  targets?: string[];
  /** targets가 현재 메시지의 명시 ID/그룹이 아닌 이전 turn(팔로업)에서 유래했는지 */
  contextualTargets?: boolean;
  groupTargets?: string[];
  metric?: SupportedMetric;
  sourceMetric?: SupportedMetric;
  metrics?: SupportedMetric[];
  threshold?: number;
  thresholdOperator?: QueryOperator;
  filterOperator?: 'AND' | 'OR';
  metricConditions?: MetricCondition[];
  filterConditions?: MetricCondition[];
  rankCount?: number;
  rankOrder?: QueryRankOrder;
  rankRange?: 'top-bottom';
  rankBasis?: 'composite-load';
  statusFilter?: 'healthy-only' | QueryStatus;
  trendDirection?: TrendDirection;
  trendRankBy?: TrendRankBy;
}

function resolveExplicitStatusFilter(
  message: string,
  statusValue: QueryStatus | undefined
): QueryStatus | undefined {
  const explicitStatus = statusValue ?? inferExplicitStatusValue(message);
  if (!explicitStatus) return undefined;
  return /(?:상태|status).{0,16}(?:online|warning|critical|offline|온라인|정상|경고|위험|오프라인)|(?:online|warning|critical|offline|온라인|정상|경고|위험|오프라인).{0,16}(?:상태|status|서버|server)/i.test(
    message
  )
    ? explicitStatus
    : undefined;
}

function inferExplicitStatusValue(message: string): QueryStatus | undefined {
  if (/offline|오프라인/i.test(message)) return 'offline';
  if (/critical|위험/i.test(message)) return 'critical';
  if (/warning|경고/i.test(message)) return 'warning';
  if (/online|온라인|정상/i.test(message)) return 'online';
  return undefined;
}

function isTopBottomServerHealthMessage(message: string): boolean {
  return (
    /서버|server/i.test(message) &&
    /위험|위험도|불안정|문제|비정상|critical|risk|unstable|problematic|unhealthy/i.test(
      message
    ) &&
    /안정|정상|안전|괜찮|healthy|stable|safe|lowest\s+risk|least\s+risk/i.test(
      message
    ) &&
    /같이|함께|동시|둘\s*다|모두|와|과|그리고|및|\+|both|and/i.test(message)
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

export function parseCurrentMetricsEvidenceRequest(
  request: DomainEvidenceRequest
): ParsedCurrentMetricsEvidenceRequest | null {
  if (FORCE_KB_QUERY_PATTERN.test(request.message)) return null;
  if (shouldPreferAdvisorForOperationalAdvice(request.message)) return null;
  if (EXPLICIT_RCA_QUERY_PATTERN.test(request.message)) return null;

  const parsed =
    parseCurrentMetricsFrame(request) ?? parseCurrentMetricsMessage(request);

  // 팔로업 대명사("방금 분석한 서버 중 …")로 해석된 타깃은, 현재 메시지에
  // 명시 서버 ID나 그룹 힌트가 없을 때 이전 turn에서 추출된 것이다. 이 경우
  // 답변 라벨이 서버 타입명("로드밸런서 1대")으로 표기되면 일반 그룹 조회와
  // 구분되지 않으므로, 컨텍스트 유래임을 표시해 "지정 서버"로 라벨링한다.
  if (parsed?.targets && parsed.targets.length > 0) {
    const explicitTargets = extractServerIdTargetsFromMessage(request.message);
    const groupTarget = inferGroupTargetFromMessage(request.message);
    if (explicitTargets.length === 0 && !groupTarget) {
      return { ...parsed, contextualTargets: true };
    }
  }

  return parsed;
}
