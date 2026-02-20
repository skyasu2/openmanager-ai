import type { AdaptiveThreshold } from './AdaptiveThreshold';
import type { IsolationForestDetector, IsolationForestResult, MultiMetricDataPoint } from './IsolationForestDetector';
import type { AnomalyDetectionResult, MetricDataPoint, SimpleAnomalyDetector } from './SimpleAnomalyDetector';
import type {
  AdaptiveDetectionResults,
  CombinedDetectionContext,
  DetectionInputContext,
  StatisticalDetectionResults,
  UnifiedDetectionResult,
} from './UnifiedAnomalyEngine.types';

const METRICS = ['cpu', 'memory', 'disk', 'network'] as const;
const DAY_OF_WEEK_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function updateBuffers({
  metricBuffer,
  multiMetricBuffer,
  input,
  timestamp,
  streamBufferSize,
}: DetectionInputContext): void {
  for (const metric of METRICS) {
    const key = `${input.serverId}_${metric}`;
    if (!metricBuffer.has(key)) {
      metricBuffer.set(key, []);
    }
    const buffer = metricBuffer.get(key)!;
    buffer.push({
      timestamp,
      value: input[metric],
    });

    while (buffer.length > streamBufferSize) {
      buffer.shift();
    }
  }

  multiMetricBuffer.push({
    timestamp,
    cpu: input.cpu,
    memory: input.memory,
    disk: input.disk,
    network: input.network,
  });

  while (multiMetricBuffer.length > streamBufferSize) {
    multiMetricBuffer.shift();
  }
}

export function runStatisticalDetection(
  enabled: boolean,
  detector: SimpleAnomalyDetector,
  input: { serverId: string; cpu: number; memory: number; disk: number; network: number },
  metricBuffer: Map<string, MetricDataPoint[]>
): StatisticalDetectionResults | null {
  if (!enabled) {
    return null;
  }

  const results: StatisticalDetectionResults = {};
  for (const metric of METRICS) {
    const key = `${input.serverId}_${metric}`;
    const history = metricBuffer.get(key) || [];
    results[metric] = detector.detectAnomaly(input[metric], history);
  }

  return results;
}

export function runIsolationForestDetection(
  enabled: boolean,
  detector: IsolationForestDetector,
  input: { cpu: number; memory: number; disk: number; network: number },
  timestamp: number
): IsolationForestResult | null {
  if (!enabled) {
    return null;
  }

  const multiMetric: MultiMetricDataPoint = {
    timestamp,
    cpu: input.cpu,
    memory: input.memory,
    disk: input.disk,
    network: input.network,
  };

  return detector.detect(multiMetric);
}

export function runAdaptiveDetection(
  enabled: boolean,
  adaptiveThreshold: AdaptiveThreshold,
  input: { cpu: number; memory: number; disk: number; network: number },
  timestamp: number
): AdaptiveDetectionResults | null {
  if (!enabled) {
    return null;
  }

  const results: AdaptiveDetectionResults = {};
  for (const metric of METRICS) {
    results[metric] = adaptiveThreshold.isAnomaly(metric, input[metric], timestamp);
  }

  return results;
}

export function combineDetectionResults({
  config,
  input,
  statResult,
  ifResult,
  adaptiveResult,
  timestamp,
  date,
}: CombinedDetectionContext): UnifiedDetectionResult {
  const statVote =
    statResult !== null && Object.values(statResult).some((result) => result.isAnomaly);
  const ifVote = ifResult !== null && ifResult.isAnomaly;
  const adaptiveVote =
    adaptiveResult !== null &&
    Object.values(adaptiveResult).some((result) => result.isAnomaly);

  let weightedScore = 0;
  let activeWeight = 0;

  if (config.enableStatistical && statResult) {
    const statScore = statVote ? getMaxSeverityScore(statResult) : 0;
    weightedScore += statScore * config.weights.statistical;
    activeWeight += config.weights.statistical;
  }

  if (config.enableIsolationForest && ifResult) {
    weightedScore += ifResult.anomalyScore * config.weights.isolationForest;
    activeWeight += config.weights.isolationForest;
  }

  if (config.enableAdaptive && adaptiveResult) {
    const adaptiveScore = adaptiveVote ? getMaxAdaptiveScore(adaptiveResult) : 0;
    weightedScore += adaptiveScore * config.weights.adaptive;
    activeWeight += config.weights.adaptive;
  }

  if (activeWeight > 0 && activeWeight < 1) {
    weightedScore = weightedScore / activeWeight;
  }

  const isAnomaly = weightedScore > config.votingThreshold;
  const severity = calculateSeverity(weightedScore);
  const confidence = calculateConfidence(statResult, ifResult, adaptiveResult);
  const dominantMetric = findDominantMetric(
    statResult,
    ifResult?.metricContributions,
    adaptiveResult
  );

  const votes = [statVote, ifVote, adaptiveVote].filter(Boolean).length;
  const consensusLevel: 'none' | 'partial' | 'full' =
    votes === 0 ? 'none' : votes === 3 ? 'full' : 'partial';

  return {
    serverId: input.serverId,
    serverName: input.serverName,
    isAnomaly,
    severity,
    confidence,
    anomalyScore: Math.round(weightedScore * 100) / 100,
    detectors: {
      statistical: {
        enabled: config.enableStatistical,
        isAnomaly: statVote,
        severity: statResult ? getMaxSeverity(statResult) : 'low',
        confidence: statResult ? getAvgConfidence(statResult) : 0,
        metrics: statResult
          ? Object.fromEntries(
              Object.entries(statResult).map(([metric, result]) => [
                metric,
                { isAnomaly: result.isAnomaly, value: result.details.currentValue },
              ])
            )
          : {},
      },
      isolationForest: {
        enabled: config.enableIsolationForest,
        isAnomaly: ifVote,
        anomalyScore: ifResult?.anomalyScore ?? 0,
        metricContributions: ifResult?.metricContributions ?? {
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 0,
        },
      },
      adaptive: {
        enabled: config.enableAdaptive,
        isAnomaly: adaptiveVote,
        direction: adaptiveResult ? getDominantDirection(adaptiveResult) : 'normal',
        expectedMean: adaptiveResult ? getAvgExpectedMean(adaptiveResult) : 0,
        thresholdConfidence: adaptiveResult ? getAvgThresholdConfidence(adaptiveResult) : 0,
      },
    },
    voting: {
      votes: { statistical: statVote, isolationForest: ifVote, adaptive: adaptiveVote },
      weightedScore: Math.round(weightedScore * 100) / 100,
      consensusLevel,
    },
    dominantMetric,
    timeContext: {
      timestamp,
      hour: date.getHours(),
      dayOfWeek: DAY_OF_WEEK_LABELS[date.getDay()] || '일',
    },
    latencyMs: 0,
  };
}

function getMaxSeverityScore(results: StatisticalDetectionResults): number {
  const anomalies = Object.values(results).filter((result) => result.isAnomaly);
  if (anomalies.length === 0) {
    return 0;
  }

  const severityScores: Record<string, number> = { low: 0.4, medium: 0.7, high: 1.0 };
  return Math.max(...anomalies.map((result) => severityScores[result.severity] ?? 0));
}

function getMaxAdaptiveScore(results: AdaptiveDetectionResults): number {
  const anomalies = Object.values(results).filter((result) => result.isAnomaly);
  if (anomalies.length === 0) {
    return 0;
  }

  const maxDeviation = Math.max(...anomalies.map((result) => Math.min(result.deviation, 4)));
  return maxDeviation / 4;
}

function calculateSeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 0.85) return 'critical';
  if (score >= 0.7) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function calculateConfidence(
  statResult: StatisticalDetectionResults | null,
  ifResult: IsolationForestResult | null,
  adaptiveResult: AdaptiveDetectionResults | null
): number {
  const confidences: number[] = [];

  if (statResult) {
    confidences.push(getAvgConfidence(statResult));
  }
  if (ifResult) {
    confidences.push(ifResult.confidence);
  }
  if (adaptiveResult) {
    confidences.push(getAvgThresholdConfidence(adaptiveResult));
  }

  if (confidences.length === 0) {
    return 0;
  }

  return (
    Math.round(
      (confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length) *
        100
    ) / 100
  );
}

function getMaxSeverity(results: StatisticalDetectionResults): string {
  const severities = Object.values(results).map((result) => result.severity);
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

function getAvgConfidence(results: StatisticalDetectionResults): number {
  const values = Object.values(results);
  if (values.length === 0) return 0;
  return values.reduce((sum, result) => sum + result.confidence, 0) / values.length;
}

function getDominantDirection(results: AdaptiveDetectionResults): string {
  const directions = Object.values(results).map((result) => result.direction);
  if (directions.includes('high')) return 'high';
  if (directions.includes('low')) return 'low';
  return 'normal';
}

function getAvgExpectedMean(results: AdaptiveDetectionResults): number {
  const values = Object.values(results);
  if (values.length === 0) return 0;
  return values.reduce((sum, result) => sum + result.thresholds.expectedMean, 0) / values.length;
}

function getAvgThresholdConfidence(results: AdaptiveDetectionResults): number {
  const values = Object.values(results);
  if (values.length === 0) return 0;
  return values.reduce((sum, result) => sum + result.thresholds.confidence, 0) / values.length;
}

function findDominantMetric(
  statResult: StatisticalDetectionResults | null,
  ifContributions?: { cpu: number; memory: number; disk: number; network: number },
  adaptiveResult?: AdaptiveDetectionResults | null
): string | null {
  if (statResult) {
    for (const [metric, result] of Object.entries(statResult)) {
      if (result.isAnomaly && result.severity === 'high') {
        return metric;
      }
    }
  }

  if (ifContributions) {
    const entries = Object.entries(ifContributions) as [string, number][];
    const sorted = entries.sort((left, right) => right[1] - left[1]);
    if (sorted[0] && sorted[0][1] > 0.35) {
      return sorted[0][0];
    }
  }

  if (adaptiveResult) {
    const anomalies = Object.entries(adaptiveResult)
      .filter(([, result]) => result.isAnomaly)
      .sort((left, right) => right[1].deviation - left[1].deviation);
    if (anomalies.length > 0) {
      return anomalies[0]?.[0] || null;
    }
  }

  return null;
}
