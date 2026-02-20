export interface TrendDataPoint {
  timestamp: number;
  value: number;
}

export interface TrendPredictionConfig {
  regressionWindow: number;
  slopeThreshold: number;
  minR2: number;
}

export interface TrendPrediction {
  trend: 'increasing' | 'decreasing' | 'stable';
  prediction: number;
  confidence: number;
  details: {
    currentValue: number;
    slope: number;
    intercept: number;
    r2: number;
    predictedChange: number;
    predictedChangePercent: number;
  };
  timestamp: number;
}

export interface ThresholdBreachPrediction {
  willBreachWarning: boolean;
  timeToWarning: number | null;
  willBreachCritical: boolean;
  timeToCritical: number | null;
  humanReadable: string;
}

export interface RecoveryPrediction {
  willRecover: boolean;
  timeToRecovery: number | null;
  humanReadable: string | null;
}

export interface EnhancedTrendPrediction extends TrendPrediction {
  thresholdBreach: ThresholdBreachPrediction;
  recovery: RecoveryPrediction;
  currentStatus: 'online' | 'warning' | 'critical';
}

export interface MetricThresholds {
  warning: number;
  critical: number;
  recovery: number;
}

export const DEFAULT_THRESHOLDS: Record<string, MetricThresholds> = {
  cpu: { warning: 70, critical: 90, recovery: 65 },
  memory: { warning: 80, critical: 90, recovery: 75 },
  disk: { warning: 80, critical: 90, recovery: 75 },
  network: { warning: 70, critical: 90, recovery: 60 },
};

export const MAX_PREDICTION_HORIZON = 24 * 60 * 60 * 1000;
