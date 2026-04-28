import type {
  MetricAnomalyResult,
  MetricTrendResult,
  ServerAnalysisResult,
  SystemAnalysisSummary,
} from '@/types/intelligent-monitoring.types';

const severityScore: Record<MetricAnomalyResult['severity'], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function normalizeFinite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function getThresholdDistance(result: MetricAnomalyResult): number {
  const { currentValue, threshold } = result;
  if (currentValue > threshold.upper) {
    return currentValue - threshold.upper;
  }
  if (currentValue < threshold.lower) {
    return threshold.lower - currentValue;
  }
  return 0;
}

function createIssueReason(result: MetricAnomalyResult): string | null {
  const { currentValue, threshold } = result;
  if (currentValue > threshold.upper) {
    return `상한 ${Math.round(threshold.upper)}% 초과`;
  }
  if (currentValue < threshold.lower) {
    return `하한 ${Math.round(threshold.lower)}% 미만`;
  }
  return null;
}

function createRecommendation(
  metric: string,
  severity: MetricAnomalyResult['severity']
): string {
  const metricLabel = metric.toUpperCase();
  if (severity === 'high') {
    return `${metricLabel} 포화 원인을 즉시 확인하세요`;
  }
  return `${metricLabel} 추세와 관련 로그를 점검하세요`;
}

function shouldPromoteIssue(
  result: MetricAnomalyResult,
  reason: string | null
): boolean {
  if (!result.isAnomaly) return false;
  if (result.severity === 'high' || result.severity === 'medium') return true;
  if (!reason) return false;
  return result.confidence >= 0.75 && getThresholdDistance(result) >= 5;
}

function hasUsefulThresholdBreach(result: MetricTrendResult): boolean {
  const message = result.thresholdBreach?.humanReadable;
  return Boolean(
    message &&
      !message.includes('임계값 도달 예상 없음') &&
      !message.includes('도달 예상 없음')
  );
}

export function createSystemAnalysisSummary(
  serverResults: ServerAnalysisResult[]
): SystemAnalysisSummary {
  const healthyServers = serverResults.filter(
    (server) => server.overallStatus === 'online'
  ).length;
  const warningServers = serverResults.filter(
    (server) => server.overallStatus === 'warning'
  ).length;
  const criticalServers = serverResults.filter(
    (server) => server.overallStatus === 'critical'
  ).length;

  const overallStatus =
    criticalServers > 0
      ? 'critical'
      : warningServers > 0
        ? 'warning'
        : 'online';

  const topIssues: SystemAnalysisSummary['topIssues'] = [];
  for (const server of serverResults) {
    if (!server.anomalyDetection?.hasAnomalies) continue;

    for (const [metric, result] of Object.entries(
      server.anomalyDetection.results || {}
    )) {
      const reason = createIssueReason(result);
      if (!shouldPromoteIssue(result, reason)) continue;

      topIssues.push({
        serverId: server.serverId,
        serverName: server.serverName,
        metric,
        severity: result.severity,
        currentValue: result.currentValue,
        confidence: result.confidence,
        threshold: result.threshold,
        reason: reason ?? '평소 범위 이탈',
        recommendation: createRecommendation(metric, result.severity),
      });
    }
  }

  topIssues.sort((left, right) => {
    const severityDelta =
      severityScore[right.severity] - severityScore[left.severity];
    if (severityDelta !== 0) return severityDelta;

    const distanceDelta =
      getThresholdDistance({
        isAnomaly: true,
        severity: right.severity,
        confidence: right.confidence ?? 0,
        currentValue: right.currentValue,
        threshold: right.threshold ?? { lower: 0, upper: 100 },
      }) -
      getThresholdDistance({
        isAnomaly: true,
        severity: left.severity,
        confidence: left.confidence ?? 0,
        currentValue: left.currentValue,
        threshold: left.threshold ?? { lower: 0, upper: 100 },
      });
    if (distanceDelta !== 0) return distanceDelta;

    return (right.confidence ?? 0) - (left.confidence ?? 0);
  });

  const predictions: SystemAnalysisSummary['predictions'] = [];
  for (const server of serverResults) {
    if (!server.trendPrediction?.summary?.hasRisingTrends) continue;

    for (const [metric, result] of Object.entries(
      server.trendPrediction.results || {}
    )) {
      const changePercent = normalizeFinite(result.changePercent) ?? 0;
      const hasThresholdBreach = hasUsefulThresholdBreach(result);
      if (
        result.trend !== 'increasing' ||
        (changePercent <= 5 && !hasThresholdBreach)
      ) {
        continue;
      }

      const predictedValue = normalizeFinite(result.predictedValue);
      predictions.push({
        serverId: server.serverId,
        serverName: server.serverName,
        metric,
        trend: result.trend,
        currentValue: result.currentValue,
        predictedValue,
        predictionState: predictedValue === null ? 'missing' : 'available',
        changePercent,
        confidence: result.confidence,
        thresholdBreachMessage: result.thresholdBreach?.humanReadable,
      });
    }
  }

  predictions.sort((left, right) => {
    const leftBreach = left.thresholdBreachMessage ? 1 : 0;
    const rightBreach = right.thresholdBreachMessage ? 1 : 0;
    if (leftBreach !== rightBreach) return rightBreach - leftBreach;

    const changeDelta = right.changePercent - left.changePercent;
    if (changeDelta !== 0) return changeDelta;

    return (right.confidence ?? 0) - (left.confidence ?? 0);
  });

  return {
    totalServers: serverResults.length,
    healthyServers,
    warningServers,
    criticalServers,
    overallStatus,
    topIssues: topIssues.slice(0, 5),
    predictions: predictions.slice(0, 5),
  };
}
