export interface AdaptiveThresholdConfig {
  baseSigma: number;
  hourlyWeight: number;
  dailyWeight: number;
  emaSmoothingFactor: number;
  minSamplesPerBucket: number;
  maxHistorySize: number;
}

export interface TemporalBucket {
  sum: number;
  sumSquared: number;
  count: number;
  mean: number;
  stdDev: number;
  lastUpdated: number;
}

export interface AdaptiveThresholds {
  upper: number;
  lower: number;
  expectedMean: number;
  expectedStdDev: number;
  confidence: number;
  debug: {
    hour: number;
    dayOfWeek: number;
    hourlyBucketCount: number;
    dailyBucketCount: number;
    blendedMean: number;
    blendedStdDev: number;
  };
}

export interface MetricHistoryPoint {
  timestamp: number;
  value: number;
}
