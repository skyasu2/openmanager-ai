import type { AnomalyDetectionResult, MetricDataPoint } from './SimpleAnomalyDetector';
import type { AdaptiveThresholds } from './AdaptiveThreshold';
import type { IsolationForestResult, MultiMetricDataPoint } from './IsolationForestDetector';

export interface UnifiedEngineConfig {
  enableStatistical: boolean;
  enableIsolationForest: boolean;
  enableAdaptive: boolean;
  weights: {
    statistical: number;
    isolationForest: number;
    adaptive: number;
  };
  votingThreshold: number;
  emitEvents: boolean;
  autoTrain: boolean;
  streamBufferSize: number;
}

export interface ServerMetricInput {
  serverId: string;
  serverName: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  timestamp?: number;
}

export interface UnifiedDetectionResult {
  serverId: string;
  serverName: string;
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  anomalyScore: number;
  detectors: {
    statistical: {
      enabled: boolean;
      isAnomaly: boolean;
      severity: string;
      confidence: number;
      metrics: Record<string, { isAnomaly: boolean; value: number }>;
    };
    isolationForest: {
      enabled: boolean;
      isAnomaly: boolean;
      anomalyScore: number;
      metricContributions: Record<string, number>;
    };
    adaptive: {
      enabled: boolean;
      isAnomaly: boolean;
      direction: string;
      expectedMean: number;
      thresholdConfidence: number;
    };
  };
  voting: {
    votes: { statistical: boolean; isolationForest: boolean; adaptive: boolean };
    weightedScore: number;
    consensusLevel: 'none' | 'partial' | 'full';
  };
  dominantMetric: string | null;
  timeContext: {
    timestamp: number;
    hour: number;
    dayOfWeek: string;
  };
  latencyMs: number;
}

export interface StreamingStats {
  totalProcessed: number;
  anomaliesDetected: number;
  averageLatencyMs: number;
  lastProcessedAt: number;
  bufferSize: number;
  modelsStatus: {
    statisticalReady: boolean;
    isolationForestTrained: boolean;
    adaptiveLearnedMetrics: string[];
  };
}

export type StatisticalDetectionResults = Record<string, AnomalyDetectionResult>;

export interface AdaptiveMetricResult {
  isAnomaly: boolean;
  direction: string;
  deviation: number;
  thresholds: AdaptiveThresholds;
}

export type AdaptiveDetectionResults = Record<string, AdaptiveMetricResult>;

export interface DetectionInputContext {
  metricBuffer: Map<string, MetricDataPoint[]>;
  multiMetricBuffer: MultiMetricDataPoint[];
  input: ServerMetricInput;
  timestamp: number;
  streamBufferSize: number;
}

export interface CombinedDetectionContext {
  config: UnifiedEngineConfig;
  input: ServerMetricInput;
  statResult: StatisticalDetectionResults | null;
  ifResult: IsolationForestResult | null;
  adaptiveResult: AdaptiveDetectionResults | null;
  timestamp: number;
  date: Date;
}
