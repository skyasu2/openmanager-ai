/**
 * 🔍 Simple Anomaly Detector
 *
 * @description
 * Statistical anomaly detection using Adaptive Algorithm (moving average + 2σ).
 * Inspired by Grafana's anomaly detection approach.
 *
 * @algorithm
 * 1. Calculate moving average from historical data (default: 6-hour window)
 * 2. Calculate standard deviation (σ)
 * 3. Threshold = mean + (2 × σ) for upper bound
 * 4. Threshold = mean - (2 × σ) for lower bound
 * 5. Anomaly if value outside threshold
 *
 * @note
 * - Data source: FIXED_24H_DATASETS (SSOT - Dashboard와 동일)
 * - Actual usage: 36 data points (6시간 × 10분 간격)
 * - Algorithm adapts to available data (minimum 12 points required)
 *
 * @features
 * - Client-side calculation (no API calls)
 * - Learns 6-hour patterns from same data shown in Dashboard
 * - Adaptive to system changes
 * - Low false positive rate (~5%)
 *
 * @version 1.2.0
 * @date 2025-12-21
 */

export interface MetricDataPoint {
  timestamp: number;
  value: number;
}

export interface AnomalyDetectionConfig {
  /**
   * Number of data points to use for moving average.
   * Default: 36 (6 hours × 6 points/hour at 10-minute intervals)
   */
  movingAverageWindow: number;

  /**
   * Standard deviation multiplier for threshold.
   * Default: 2 (95.4% confidence interval)
   */
  stdDevMultiplier: number;

  /**
   * Minimum data points required for reliable detection.
   * Default: 24 (2 hours of data)
   */
  minDataPoints: number;
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  details: {
    currentValue: number;
    mean: number;
    stdDev: number;
    upperThreshold: number;
    lowerThreshold: number;
    deviation: number; // How many σ away from mean
  };
  timestamp: number;
}

export interface BaselineDriftResult {
  hasDrift: boolean;
  direction: 'increasing' | 'decreasing' | 'stable';
  magnitude: number;
  magnitudeSigma: number;
  confidence: number;
}

export class SimpleAnomalyDetector {
  private config: AnomalyDetectionConfig;

  constructor(config?: Partial<AnomalyDetectionConfig>) {
    this.config = {
      movingAverageWindow: config?.movingAverageWindow ?? 36, // 6시간 × 6포인트/시간 (10분 간격)
      stdDevMultiplier: config?.stdDevMultiplier ?? 2,
      minDataPoints: config?.minDataPoints ?? 12, // 2시간 minimum (12 points)
    };
  }

  /**
   * Detect anomaly in a metric value using historical data.
   *
   * @param currentValue - Current metric value to check
   * @param historicalData - Array of historical data points (sorted by timestamp, oldest first)
   * @returns Anomaly detection result
   */
  public detectAnomaly(
    currentValue: number,
    historicalData: MetricDataPoint[]
  ): AnomalyDetectionResult {
    const timestamp = Date.now();

    // Validate input
    if (historicalData.length < this.config.minDataPoints) {
      return {
        isAnomaly: false,
        severity: 'low',
        confidence: 0,
        details: {
          currentValue,
          mean: currentValue,
          stdDev: 0,
          upperThreshold: currentValue,
          lowerThreshold: currentValue,
          deviation: 0,
        },
        timestamp,
      };
    }

    // Extract recent values for moving average
    const recentValues = historicalData
      .slice(-this.config.movingAverageWindow)
      .map((d) => d.value);

    // Calculate statistics
    const mean = this.calculateMean(recentValues);
    const stdDev = this.calculateStdDev(recentValues, mean);
    const upperThreshold = mean + this.config.stdDevMultiplier * stdDev;
    const lowerThreshold = mean - this.config.stdDevMultiplier * stdDev;

    // Check for anomaly
    const isAnomaly =
      currentValue > upperThreshold || currentValue < lowerThreshold;

    // Calculate deviation in terms of σ
    const deviation = Math.abs(currentValue - mean) / (stdDev || 1);

    // Determine severity based on deviation
    const severity = this.calculateSeverity(deviation);

    // Calculate confidence based on data availability
    const confidence = this.calculateConfidence(historicalData.length);

    return {
      isAnomaly,
      severity,
      confidence,
      details: {
        currentValue,
        mean,
        stdDev,
        upperThreshold,
        lowerThreshold,
        deviation,
      },
      timestamp,
    };
  }

  /**
   * Batch detect anomalies for multiple metrics.
   *
   * @param metrics - Map of metric name to current value
   * @param historicalData - Map of metric name to historical data points
   * @returns Map of metric name to detection result
   */
  public detectAnomalies(
    metrics: Record<string, number>,
    historicalData: Record<string, MetricDataPoint[]>
  ): Record<string, AnomalyDetectionResult> {
    const results: Record<string, AnomalyDetectionResult> = {};

    for (const [metricName, currentValue] of Object.entries(metrics)) {
      const history = historicalData[metricName] || [];
      results[metricName] = this.detectAnomaly(currentValue, history);
    }

    return results;
  }

  /**
   * Calculate aggregate anomaly score for all metrics.
   *
   * @param results - Map of metric name to detection result
   * @returns Aggregate anomaly score (0-1)
   */
  public calculateAggregateScore(
    results: Record<string, AnomalyDetectionResult>
  ): number {
    const anomalies = Object.values(results).filter((r) => r.isAnomaly);

    if (anomalies.length === 0) {
      return 0;
    }

    // Weight by severity and confidence
    const severityWeights = { low: 0.3, medium: 0.6, high: 1.0 };
    const totalWeight = anomalies.reduce((sum, result) => {
      const weight = severityWeights[result.severity];
      return sum + weight * result.confidence;
    }, 0);

    // Normalize to 0-1 scale
    const maxPossibleWeight = Object.keys(results).length * 1.0; // All high severity
    return Math.min(totalWeight / maxPossibleWeight, 1.0);
  }

  /**
   * Detect baseline drift by comparing first half vs second half of a 6-hour window.
   * Drift is flagged when the difference exceeds driftThresholdSigma standard deviations.
   *
   * @param historicalData - Array of historical data points (6-hour window recommended)
   * @param driftThresholdSigma - Sigma threshold for drift detection (default: 1.0)
   * @returns Baseline drift result
   */
  public detectBaselineDrift(
    historicalData: MetricDataPoint[],
    driftThresholdSigma: number = 1.0
  ): BaselineDriftResult {
    if (historicalData.length < this.config.minDataPoints) {
      return {
        hasDrift: false,
        direction: 'stable',
        magnitude: 0,
        magnitudeSigma: 0,
        confidence: 0,
      };
    }

    const recentValues = historicalData
      .slice(-this.config.movingAverageWindow)
      .map((d) => d.value);

    const midpoint = Math.floor(recentValues.length / 2);
    const firstHalf = recentValues.slice(0, midpoint);
    const secondHalf = recentValues.slice(midpoint);

    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return {
        hasDrift: false,
        direction: 'stable',
        magnitude: 0,
        magnitudeSigma: 0,
        confidence: 0,
      };
    }

    const meanFirst = this.calculateMean(firstHalf);
    const meanSecond = this.calculateMean(secondHalf);
    const overallStdDev = this.calculateStdDev(recentValues, this.calculateMean(recentValues));

    const magnitude = meanSecond - meanFirst;
    const magnitudeSigma = overallStdDev > 0 ? Math.abs(magnitude) / overallStdDev : 0;
    const hasDrift = magnitudeSigma > driftThresholdSigma;

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (hasDrift) {
      direction = magnitude > 0 ? 'increasing' : 'decreasing';
    }

    const confidence = this.calculateConfidence(historicalData.length);

    return {
      hasDrift,
      direction,
      magnitude: Math.round(magnitude * 100) / 100,
      magnitudeSigma: Math.round(magnitudeSigma * 100) / 100,
      confidence,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  private calculateStdDev(values: number[], mean: number): number {
    if (values.length < 2) return 0;

    const squaredDiffs = values.map((val) => (val - mean) ** 2);
    const variance =
      squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateSeverity(deviation: number): 'low' | 'medium' | 'high' {
    if (deviation >= 3) return 'high'; // > 3σ (0.3% probability)
    if (deviation >= 2.5) return 'medium'; // > 2.5σ (1.2% probability)
    return 'low'; // 2-2.5σ (5% probability)
  }

  private calculateConfidence(dataPoints: number): number {
    // Confidence increases with more data points
    const minPoints = this.config.minDataPoints;
    const maxPoints = this.config.movingAverageWindow;

    if (dataPoints < minPoints) return 0;
    if (dataPoints >= maxPoints) return 1;

    // Linear interpolation between min and max
    return (dataPoints - minPoints) / (maxPoints - minPoints);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a singleton instance of SimpleAnomalyDetector.
 */
let instance: SimpleAnomalyDetector | null = null;

export function getAnomalyDetector(
  config?: Partial<AnomalyDetectionConfig>
): SimpleAnomalyDetector {
  if (!instance) {
    instance = new SimpleAnomalyDetector(config);
  }
  return instance;
}
