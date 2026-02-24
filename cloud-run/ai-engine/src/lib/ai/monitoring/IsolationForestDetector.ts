/**
 * 🌲 Isolation Forest Anomaly Detector
 *
 * @description
 * Machine Learning based anomaly detection using Isolation Forest algorithm.
 * Complements the statistical approach (SimpleAnomalyDetector) with:
 * - Multivariate analysis (CPU + Memory + Disk + Network together)
 * - Non-linear pattern detection
 * - Outlier isolation without explicit threshold tuning
 *
 * @algorithm
 * 1. Build ensemble of isolation trees (default: 100 trees)
 * 2. Each tree randomly partitions data points
 * 3. Anomalies are isolated with fewer partitions (shorter path)
 * 4. Anomaly score = 2^(-E(h(x))/c(n)) where h(x) is path length
 *
 * @references
 * - Liu, Ting, Zhou (2008): Isolation Forest
 * - NPM: isolation-forest package
 *
 * @version 1.0.0
 * @date 2026-01-01
 */

import { IsolationForest } from 'isolation-forest';
import type { AnomalyDetectionResult } from './SimpleAnomalyDetector';
import { logger } from '../../logger';

// ============================================================================
// Types
// ============================================================================

export interface MultiMetricDataPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

export interface IsolationForestConfig {
  /**
   * Number of isolation trees in the forest.
   * More trees = more stable but slower. Default: 100
   */
  numberOfTrees: number;

  /**
   * Subsampling size for each tree.
   * Should be smaller than data size. Default: 256
   */
  subsamplingSize: number;

  /**
   * Threshold for anomaly score (0-1).
   * Higher = stricter. Default: 0.6
   */
  anomalyThreshold: number;

  /**
   * Minimum data points required for training.
   * Default: 50
   */
  minTrainingPoints: number;

  /**
   * Whether to auto-retrain when new data arrives.
   * Default: false
   */
  autoRetrain: boolean;
}

export interface IsolationForestResult extends AnomalyDetectionResult {
  /** Raw anomaly score from Isolation Forest (0-1) */
  anomalyScore: number;

  /** Individual metric contributions (if available) */
  metricContributions?: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

// ============================================================================
// Implementation
// ============================================================================

export class IsolationForestDetector {
  private forest: IsolationForest;
  private config: IsolationForestConfig;
  private isTrained = false;
  private trainingData: MultiMetricDataPoint[] = [];
  private lastTrainedAt: number | null = null;

  constructor(config?: Partial<IsolationForestConfig>) {
    this.config = {
      numberOfTrees: config?.numberOfTrees ?? 100,
      subsamplingSize: config?.subsamplingSize ?? 256,
      anomalyThreshold: config?.anomalyThreshold ?? 0.6,
      minTrainingPoints: config?.minTrainingPoints ?? 50,
      autoRetrain: config?.autoRetrain ?? false,
    };

    this.forest = new IsolationForest(
      this.config.numberOfTrees,
      this.config.subsamplingSize
    );
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Train the Isolation Forest model with historical data.
   *
   * @param historicalData - Array of multivariate metric data points
   * @returns true if training successful, false otherwise
   */
  public fit(historicalData: MultiMetricDataPoint[]): boolean {
    if (historicalData.length < this.config.minTrainingPoints) {
      logger.warn(
        `[IsolationForest] Insufficient data for training: ${historicalData.length}/${this.config.minTrainingPoints}`
      );
      return false;
    }

    try {
      // Convert to format expected by isolation-forest package
      const trainingData = historicalData.map((d) => ({
        cpu: d.cpu,
        memory: d.memory,
        disk: d.disk,
        network: d.network,
      }));

      this.forest.fit(trainingData);
      this.trainingData = [...historicalData];
      this.isTrained = true;
      this.lastTrainedAt = Date.now();

      logger.info(
        `[IsolationForest] Model trained with ${historicalData.length} samples`
      );
      return true;
    } catch (error) {
      logger.error('[IsolationForest] Training failed:', error);
      return false;
    }
  }

  /**
   * Detect anomaly in current metrics using trained model.
   *
   * @param current - Current multivariate metric data point
   * @returns Anomaly detection result with score
   */
  public detect(current: MultiMetricDataPoint): IsolationForestResult {
    const timestamp = Date.now();

    // If not trained, return safe default
    if (!this.isTrained) {
      return this.createDefaultResult(current, timestamp);
    }

    try {
      // Predict anomaly score
      const scores = this.forest.predict([
        {
          cpu: current.cpu,
          memory: current.memory,
          disk: current.disk,
          network: current.network,
        },
      ]);

      const anomalyScore = scores[0];
      const isAnomaly = anomalyScore > this.config.anomalyThreshold;
      const severity = this.calculateSeverity(anomalyScore);
      const confidence = this.calculateConfidence(anomalyScore);

      // Calculate per-metric contributions (approximation)
      const metricContributions = this.estimateMetricContributions(current);

      return {
        isAnomaly,
        severity,
        confidence,
        anomalyScore,
        metricContributions,
        details: {
          currentValue: this.getDominantMetricValue(current, metricContributions),
          mean: 0, // Not applicable for IF
          stdDev: 0,
          upperThreshold: this.config.anomalyThreshold,
          lowerThreshold: 0,
          deviation: anomalyScore,
        },
        timestamp,
      };
    } catch (error) {
      logger.error('[IsolationForest] Detection failed:', error);
      return this.createDefaultResult(current, timestamp);
    }
  }

  /**
   * Batch detect anomalies for multiple data points.
   *
   * @param dataPoints - Array of multivariate metric data points
   * @returns Array of detection results
   */
  public detectBatch(dataPoints: MultiMetricDataPoint[]): IsolationForestResult[] {
    if (!this.isTrained || dataPoints.length === 0) {
      return dataPoints.map((d) => this.createDefaultResult(d, Date.now()));
    }

    try {
      const inputData = dataPoints.map((d) => ({
        cpu: d.cpu,
        memory: d.memory,
        disk: d.disk,
        network: d.network,
      }));

      const scores = this.forest.predict(inputData);

      return dataPoints.map((current, index) => {
        const anomalyScore = scores[index];
        const isAnomaly = anomalyScore > this.config.anomalyThreshold;
        const severity = this.calculateSeverity(anomalyScore);
        const confidence = this.calculateConfidence(anomalyScore);
        const metricContributions = this.estimateMetricContributions(current);

        return {
          isAnomaly,
          severity,
          confidence,
          anomalyScore,
          metricContributions,
          details: {
            currentValue: this.getDominantMetricValue(current, metricContributions),
            mean: 0,
            stdDev: 0,
            upperThreshold: this.config.anomalyThreshold,
            lowerThreshold: 0,
            deviation: anomalyScore,
          },
          timestamp: current.timestamp,
        };
      });
    } catch (error) {
      logger.error('[IsolationForest] Batch detection failed:', error);
      return dataPoints.map((d) => this.createDefaultResult(d, Date.now()));
    }
  }

  /**
   * Update model with new data (incremental learning simulation).
   *
   * @param newData - New data points to incorporate
   * @param maxHistory - Maximum history to keep (default: 500)
   */
  public update(newData: MultiMetricDataPoint[], maxHistory = 500): void {
    if (!this.config.autoRetrain) {
      return;
    }

    // Append new data
    this.trainingData = [...this.trainingData, ...newData];

    // Keep only recent history
    if (this.trainingData.length > maxHistory) {
      this.trainingData = this.trainingData.slice(-maxHistory);
    }

    // Retrain if enough new data
    if (newData.length >= 10) {
      this.fit(this.trainingData);
    }
  }

  /**
   * Get model status.
   */
  public getStatus(): {
    isTrained: boolean;
    trainingSize: number;
    lastTrainedAt: number | null;
    config: IsolationForestConfig;
  } {
    return {
      isTrained: this.isTrained,
      trainingSize: this.trainingData.length,
      lastTrainedAt: this.lastTrainedAt,
      config: { ...this.config },
    };
  }

  /**
   * Reset the model (clear training).
   */
  public reset(): void {
    this.forest = new IsolationForest(
      this.config.numberOfTrees,
      this.config.subsamplingSize
    );
    this.isTrained = false;
    this.trainingData = [];
    this.lastTrainedAt = null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private calculateSeverity(anomalyScore: number): 'low' | 'medium' | 'high' {
    if (anomalyScore >= 0.8) return 'high';
    if (anomalyScore >= 0.7) return 'medium';
    return 'low';
  }

  private calculateConfidence(anomalyScore: number): number {
    // Confidence based on how decisive the score is
    // Score near 0.5 = low confidence, near 0 or 1 = high confidence
    return Math.abs(anomalyScore - 0.5) * 2;
  }

  /**
   * Estimate which metrics contributed most to anomaly.
   * This is an approximation using individual metric z-scores.
   */
  private estimateMetricContributions(
    current: MultiMetricDataPoint
  ): { cpu: number; memory: number; disk: number; network: number } {
    if (this.trainingData.length === 0) {
      return { cpu: 0.25, memory: 0.25, disk: 0.25, network: 0.25 };
    }

    const metrics: (keyof MultiMetricDataPoint)[] = ['cpu', 'memory', 'disk', 'network'];
    const contributions: Record<string, number> = {};

    for (const metric of metrics) {
      if (metric === 'timestamp') continue;

      const values = this.trainingData.map((d) => d[metric] as number);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
      );

      // Calculate z-score for current value
      const zScore = stdDev > 0 ? Math.abs((current[metric] as number) - mean) / stdDev : 0;
      contributions[metric] = zScore;
    }

    // Normalize contributions to sum to 1
    const total = Object.values(contributions).reduce((a, b) => a + b, 0);
    if (total > 0) {
      for (const metric of metrics) {
        if (metric !== 'timestamp') {
          contributions[metric] /= total;
        }
      }
    }

    return {
      cpu: contributions.cpu || 0.25,
      memory: contributions.memory || 0.25,
      disk: contributions.disk || 0.25,
      network: contributions.network || 0.25,
    };
  }

  private getDominantMetricValue(
    current: MultiMetricDataPoint,
    contributions: { cpu: number; memory: number; disk: number; network: number }
  ): number {
    // Return the value of the metric with highest contribution
    const entries = Object.entries(contributions) as [
      keyof typeof contributions,
      number
    ][];
    const [dominantMetric] = entries.reduce((max, entry) =>
      entry[1] > max[1] ? entry : max
    );
    return current[dominantMetric];
  }

  private createDefaultResult(
    current: MultiMetricDataPoint,
    timestamp: number
  ): IsolationForestResult {
    return {
      isAnomaly: false,
      severity: 'low',
      confidence: 0,
      anomalyScore: 0.5, // Neutral score
      details: {
        currentValue: current.cpu,
        mean: 0,
        stdDev: 0,
        upperThreshold: this.config.anomalyThreshold,
        lowerThreshold: 0,
        deviation: 0,
      },
      timestamp,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let instance: IsolationForestDetector | null = null;

/**
 * Get singleton instance of IsolationForestDetector.
 */
export function getIsolationForestDetector(
  config?: Partial<IsolationForestConfig>
): IsolationForestDetector {
  if (!instance) {
    instance = new IsolationForestDetector(config);
  }
  return instance;
}

/**
 * Reset the singleton instance.
 */
export function resetIsolationForestDetector(): void {
  instance = null;
}
