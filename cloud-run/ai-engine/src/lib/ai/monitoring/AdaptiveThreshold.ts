/**
 * 📊 Adaptive Threshold Manager
 *
 * @description
 * Dynamic threshold adjustment based on temporal patterns:
 * - Time-of-day patterns (24 hourly buckets)
 * - Day-of-week patterns (7 daily buckets)
 * - Exponential moving average for smooth adaptation
 *
 * @benefits
 * - Reduces false positives during peak hours
 * - Catches subtle anomalies during quiet periods
 * - Self-learning without manual tuning
 *
 * @algorithm
 * 1. Bucket metrics by hour (0-23) and day (0-6)
 * 2. Calculate per-bucket statistics (mean, stdDev)
 * 3. Blend hourly + daily patterns with weights
 * 4. Apply EMA smoothing for gradual adaptation
 *
 * @version 1.0.0
 * @date 2026-01-01
 */

import type {
  AdaptiveThresholdConfig,
  AdaptiveThresholds,
  MetricHistoryPoint,
  TemporalBucket,
} from './AdaptiveThreshold.types';
export type {
  AdaptiveThresholdConfig,
  AdaptiveThresholds,
  MetricHistoryPoint,
  TemporalBucket,
} from './AdaptiveThreshold.types';

// ============================================================================
// Implementation
// ============================================================================

export class AdaptiveThreshold {
  private config: AdaptiveThresholdConfig;

  // Per-metric storage
  private hourlyBuckets: Map<string, TemporalBucket[]> = new Map(); // metric -> 24 buckets
  private dailyBuckets: Map<string, TemporalBucket[]> = new Map(); // metric -> 7 buckets
  private globalStats: Map<string, { mean: number; stdDev: number; count: number }> =
    new Map();

  constructor(config?: Partial<AdaptiveThresholdConfig>) {
    this.config = {
      baseSigma: config?.baseSigma ?? 2.0,
      hourlyWeight: config?.hourlyWeight ?? 0.7,
      dailyWeight: config?.dailyWeight ?? 0.3,
      emaSmoothingFactor: config?.emaSmoothingFactor ?? 0.1,
      minSamplesPerBucket: config?.minSamplesPerBucket ?? 10,
      maxHistorySize: config?.maxHistorySize ?? 1000,
    };

    // Normalize weights
    const totalWeight = this.config.hourlyWeight + this.config.dailyWeight;
    this.config.hourlyWeight /= totalWeight;
    this.config.dailyWeight /= totalWeight;
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Initialize with historical data.
   *
   * @param metricName - Name of the metric (e.g., 'cpu', 'memory')
   * @param history - Historical data points with timestamps
   */
  public learn(metricName: string, history: MetricHistoryPoint[]): void {
    // Initialize buckets if needed
    this.ensureBucketsExist(metricName);

    // Process each historical point
    for (const point of history) {
      this.updateBuckets(metricName, point.value, point.timestamp);
    }

    // Calculate cached statistics
    this.recalculateBucketStats(metricName);

    console.log(
      `[AdaptiveThreshold] Learned patterns for ${metricName} from ${history.length} samples`
    );
  }

  /**
   * Update with a new data point (online learning).
   *
   * @param metricName - Name of the metric
   * @param value - Current metric value
   * @param timestamp - Timestamp (default: now)
   */
  public update(metricName: string, value: number, timestamp?: number): void {
    const ts = timestamp ?? Date.now();
    this.ensureBucketsExist(metricName);
    this.updateBuckets(metricName, value, ts);
    this.updateGlobalStats(metricName, value);
  }

  /**
   * Get adaptive thresholds for current time.
   *
   * @param metricName - Name of the metric
   * @param timestamp - Timestamp to get thresholds for (default: now)
   * @returns Adaptive thresholds with confidence
   */
  public getThresholds(metricName: string, timestamp?: number): AdaptiveThresholds {
    const ts = timestamp ?? Date.now();
    const date = new Date(ts);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Get buckets
    const hourlyBuckets = this.hourlyBuckets.get(metricName);
    const dailyBuckets = this.dailyBuckets.get(metricName);
    const global = this.globalStats.get(metricName);

    // Fallback to global stats if no temporal patterns
    if (!hourlyBuckets || !dailyBuckets || !global) {
      return this.createFallbackThresholds(hour, dayOfWeek);
    }

    const hourlyBucket = hourlyBuckets[hour];
    const dailyBucket = dailyBuckets[dayOfWeek];

    // Calculate confidence based on sample counts
    const hourlyConfidence = Math.min(
      hourlyBucket.count / this.config.minSamplesPerBucket,
      1.0
    );
    const dailyConfidence = Math.min(
      dailyBucket.count / this.config.minSamplesPerBucket,
      1.0
    );

    // Blend hourly and daily patterns
    let blendedMean: number;
    let blendedStdDev: number;

    if (hourlyConfidence > 0.5 && dailyConfidence > 0.5) {
      // Both have enough data - weighted blend
      blendedMean =
        hourlyBucket.mean * this.config.hourlyWeight +
        dailyBucket.mean * this.config.dailyWeight;
      blendedStdDev =
        hourlyBucket.stdDev * this.config.hourlyWeight +
        dailyBucket.stdDev * this.config.dailyWeight;
    } else if (hourlyConfidence > 0.5) {
      // Only hourly has data
      blendedMean = hourlyBucket.mean;
      blendedStdDev = hourlyBucket.stdDev;
    } else if (dailyConfidence > 0.5) {
      // Only daily has data
      blendedMean = dailyBucket.mean;
      blendedStdDev = dailyBucket.stdDev;
    } else {
      // Fall back to global stats
      blendedMean = global.mean;
      blendedStdDev = global.stdDev;
    }

    // Ensure minimum stdDev to avoid zero thresholds
    blendedStdDev = Math.max(blendedStdDev, blendedMean * 0.05, 1.0);

    // Calculate thresholds
    const margin = this.config.baseSigma * blendedStdDev;
    const upper = blendedMean + margin;
    const lower = Math.max(0, blendedMean - margin);

    // Overall confidence
    const confidence = (hourlyConfidence + dailyConfidence) / 2;

    return {
      upper,
      lower,
      expectedMean: blendedMean,
      expectedStdDev: blendedStdDev,
      confidence,
      debug: {
        hour,
        dayOfWeek,
        hourlyBucketCount: hourlyBucket.count,
        dailyBucketCount: dailyBucket.count,
        blendedMean,
        blendedStdDev,
      },
    };
  }

  /**
   * Check if a value is anomalous based on adaptive thresholds.
   *
   * @param metricName - Name of the metric
   * @param value - Value to check
   * @param timestamp - Timestamp (default: now)
   * @returns Anomaly check result
   */
  public isAnomaly(
    metricName: string,
    value: number,
    timestamp?: number
  ): {
    isAnomaly: boolean;
    thresholds: AdaptiveThresholds;
    deviation: number;
    direction: 'high' | 'low' | 'normal';
  } {
    const thresholds = this.getThresholds(metricName, timestamp);

    let isAnomaly = false;
    let direction: 'high' | 'low' | 'normal' = 'normal';
    let deviation = 0;

    if (value > thresholds.upper) {
      isAnomaly = true;
      direction = 'high';
      deviation = (value - thresholds.expectedMean) / thresholds.expectedStdDev;
    } else if (value < thresholds.lower) {
      isAnomaly = true;
      direction = 'low';
      deviation = (thresholds.expectedMean - value) / thresholds.expectedStdDev;
    }

    // Update with this observation (online learning)
    this.update(metricName, value, timestamp);

    return { isAnomaly, thresholds, deviation, direction };
  }

  /**
   * Get status of adaptive thresholds for all metrics.
   */
  public getStatus(): {
    metrics: string[];
    hourlyBuckets: Record<string, number[]>;
    dailyBuckets: Record<string, number[]>;
    globalStats: Record<string, { mean: number; stdDev: number; count: number }>;
    config: AdaptiveThresholdConfig;
  } {
    const hourlyBucketCounts: Record<string, number[]> = {};
    const dailyBucketCounts: Record<string, number[]> = {};
    const globalStatsObj: Record<
      string,
      { mean: number; stdDev: number; count: number }
    > = {};

    for (const [metric, buckets] of this.hourlyBuckets) {
      hourlyBucketCounts[metric] = buckets.map((b) => b.count);
    }

    for (const [metric, buckets] of this.dailyBuckets) {
      dailyBucketCounts[metric] = buckets.map((b) => b.count);
    }

    for (const [metric, stats] of this.globalStats) {
      globalStatsObj[metric] = { ...stats };
    }

    return {
      metrics: Array.from(this.hourlyBuckets.keys()),
      hourlyBuckets: hourlyBucketCounts,
      dailyBuckets: dailyBucketCounts,
      globalStats: globalStatsObj,
      config: { ...this.config },
    };
  }

  /**
   * Reset all learned patterns.
   */
  public reset(): void {
    this.hourlyBuckets.clear();
    this.dailyBuckets.clear();
    this.globalStats.clear();
  }

  /**
   * Reset patterns for a specific metric.
   */
  public resetMetric(metricName: string): void {
    this.hourlyBuckets.delete(metricName);
    this.dailyBuckets.delete(metricName);
    this.globalStats.delete(metricName);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureBucketsExist(metricName: string): void {
    if (!this.hourlyBuckets.has(metricName)) {
      this.hourlyBuckets.set(
        metricName,
        Array.from({ length: 24 }, () => this.createEmptyBucket())
      );
    }
    if (!this.dailyBuckets.has(metricName)) {
      this.dailyBuckets.set(
        metricName,
        Array.from({ length: 7 }, () => this.createEmptyBucket())
      );
    }
    if (!this.globalStats.has(metricName)) {
      this.globalStats.set(metricName, { mean: 50, stdDev: 15, count: 0 });
    }
  }

  private createEmptyBucket(): TemporalBucket {
    return {
      sum: 0,
      sumSquared: 0,
      count: 0,
      mean: 50, // Default reasonable values
      stdDev: 15,
      lastUpdated: 0,
    };
  }

  private updateBuckets(metricName: string, value: number, timestamp: number): void {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Update hourly bucket
    const hourlyBuckets = this.hourlyBuckets.get(metricName)!;
    const hourlyBucket = hourlyBuckets[hour];
    this.updateBucket(hourlyBucket, value, timestamp);

    // Update daily bucket
    const dailyBuckets = this.dailyBuckets.get(metricName)!;
    const dailyBucket = dailyBuckets[dayOfWeek];
    this.updateBucket(dailyBucket, value, timestamp);
  }

  private updateBucket(
    bucket: TemporalBucket,
    value: number,
    timestamp: number
  ): void {
    // Use EMA for smooth updates instead of pure accumulation
    if (bucket.count === 0) {
      bucket.sum = value;
      bucket.sumSquared = value * value;
      bucket.count = 1;
    } else {
      const alpha = this.config.emaSmoothingFactor;
      bucket.sum = bucket.sum * (1 - alpha) + value;
      bucket.sumSquared = bucket.sumSquared * (1 - alpha) + value * value;
      bucket.count = Math.min(bucket.count + 1, this.config.maxHistorySize);
    }

    // Recalculate stats
    bucket.mean = bucket.sum / (bucket.count > 0 ? 1 : 1); // EMA-adjusted mean
    const variance = Math.max(
      0,
      bucket.sumSquared / (bucket.count > 0 ? 1 : 1) - bucket.mean * bucket.mean
    );
    bucket.stdDev = Math.sqrt(variance);
    bucket.lastUpdated = timestamp;
  }

  private recalculateBucketStats(metricName: string): void {
    const hourlyBuckets = this.hourlyBuckets.get(metricName);
    const dailyBuckets = this.dailyBuckets.get(metricName);

    if (hourlyBuckets) {
      for (const bucket of hourlyBuckets) {
        if (bucket.count > 0) {
          bucket.mean = bucket.sum;
          const variance = Math.max(0, bucket.sumSquared - bucket.mean * bucket.mean);
          bucket.stdDev = Math.sqrt(variance);
        }
      }
    }

    if (dailyBuckets) {
      for (const bucket of dailyBuckets) {
        if (bucket.count > 0) {
          bucket.mean = bucket.sum;
          const variance = Math.max(0, bucket.sumSquared - bucket.mean * bucket.mean);
          bucket.stdDev = Math.sqrt(variance);
        }
      }
    }
  }

  private updateGlobalStats(metricName: string, value: number): void {
    const stats = this.globalStats.get(metricName)!;
    const alpha = this.config.emaSmoothingFactor;

    if (stats.count === 0) {
      stats.mean = value;
      stats.stdDev = 0;
      stats.count = 1;
    } else {
      // EMA update
      const delta = value - stats.mean;
      stats.mean += alpha * delta;
      stats.stdDev = Math.sqrt((1 - alpha) * (stats.stdDev * stats.stdDev + alpha * delta * delta));
      stats.count = Math.min(stats.count + 1, this.config.maxHistorySize);
    }
  }

  private createFallbackThresholds(
    hour: number,
    dayOfWeek: number
  ): AdaptiveThresholds {
    // Default thresholds when no data is available
    const defaultMean = 50;
    const defaultStdDev = 20;

    return {
      upper: defaultMean + this.config.baseSigma * defaultStdDev,
      lower: Math.max(0, defaultMean - this.config.baseSigma * defaultStdDev),
      expectedMean: defaultMean,
      expectedStdDev: defaultStdDev,
      confidence: 0,
      debug: {
        hour,
        dayOfWeek,
        hourlyBucketCount: 0,
        dailyBucketCount: 0,
        blendedMean: defaultMean,
        blendedStdDev: defaultStdDev,
      },
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let adaptiveInstance: AdaptiveThreshold | null = null;

/**
 * Get singleton instance of AdaptiveThreshold.
 */
export function getAdaptiveThreshold(
  config?: Partial<AdaptiveThresholdConfig>
): AdaptiveThreshold {
  if (!adaptiveInstance) {
    adaptiveInstance = new AdaptiveThreshold(config);
  }
  return adaptiveInstance;
}

/**
 * Reset the singleton instance.
 */
export function resetAdaptiveThreshold(): void {
  adaptiveInstance = null;
}
