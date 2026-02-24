/**
 * 🚀 Unified Anomaly Detection Engine
 *
 * @description
 * Production-grade anomaly detection combining all approaches:
 * 1. Statistical (SimpleAnomalyDetector): Fast, low-latency baseline
 * 2. Machine Learning (IsolationForestDetector): Multivariate patterns
 * 3. Adaptive Thresholds: Temporal pattern awareness
 *
 * @features
 * - Streaming mode: Process metrics in real-time
 * - Batch mode: Bulk historical analysis
 * - Auto-learning: Continuous model improvement
 * - Fallback chain: Graceful degradation
 * - Event emission: Integration with alerting systems
 *
 * @architecture
 * ```
 * Metrics Stream → [Statistical] → Quick Check
 *                → [IF Detector] → Multivariate Check
 *                → [Adaptive]    → Temporal Check
 *                       ↓
 *                  [Ensemble Voting]
 *                       ↓
 *                  [Event Emission]
 * ```
 *
 * @version 1.0.0
 * @date 2026-01-01
 */

import { EventEmitter } from 'events';
import { logger } from '../../logger';
import {
  SimpleAnomalyDetector,
  getAnomalyDetector,
  type MetricDataPoint,
} from './SimpleAnomalyDetector';
import {
  IsolationForestDetector,
  getIsolationForestDetector,
  type MultiMetricDataPoint,
} from './IsolationForestDetector';
import {
  AdaptiveThreshold,
  getAdaptiveThreshold,
} from './AdaptiveThreshold';
import {
  combineDetectionResults,
  runAdaptiveDetection,
  runIsolationForestDetection,
  runStatisticalDetection,
  updateBuffers,
} from './UnifiedAnomalyEngine.helpers';
import type {
  StreamingStats,
  UnifiedDetectionResult,
  UnifiedEngineConfig,
  ServerMetricInput,
} from './UnifiedAnomalyEngine.types';
export type {
  StreamingStats,
  UnifiedDetectionResult,
  UnifiedEngineConfig,
  ServerMetricInput,
} from './UnifiedAnomalyEngine.types';

// ============================================================================
// Implementation
// ============================================================================

export class UnifiedAnomalyEngine extends EventEmitter {
  private config: UnifiedEngineConfig;
  private statisticalDetector: SimpleAnomalyDetector;
  private isolationForestDetector: IsolationForestDetector;
  private adaptiveThreshold: AdaptiveThreshold;

  // Streaming state
  private metricBuffer: Map<string, MetricDataPoint[]> = new Map();
  private multiMetricBuffer: MultiMetricDataPoint[] = [];
  private stats: StreamingStats = {
    totalProcessed: 0,
    anomaliesDetected: 0,
    averageLatencyMs: 0,
    lastProcessedAt: 0,
    bufferSize: 0,
    modelsStatus: {
      statisticalReady: true,
      isolationForestTrained: false,
      adaptiveLearnedMetrics: [],
    },
  };

  constructor(config?: Partial<UnifiedEngineConfig>) {
    super();

    // Normalize weights
    const rawWeights = config?.weights ?? {
      statistical: 0.3,
      isolationForest: 0.4,
      adaptive: 0.3,
    };
    const totalWeight =
      rawWeights.statistical + rawWeights.isolationForest + rawWeights.adaptive;
    const normalizedWeights = {
      statistical: rawWeights.statistical / totalWeight,
      isolationForest: rawWeights.isolationForest / totalWeight,
      adaptive: rawWeights.adaptive / totalWeight,
    };

    this.config = {
      enableStatistical: config?.enableStatistical ?? true,
      enableIsolationForest: config?.enableIsolationForest ?? true,
      enableAdaptive: config?.enableAdaptive ?? true,
      weights: normalizedWeights,
      votingThreshold: config?.votingThreshold ?? 0.5,
      emitEvents: config?.emitEvents ?? true,
      autoTrain: config?.autoTrain ?? true,
      streamBufferSize: config?.streamBufferSize ?? 100,
    };

    // Initialize detectors
    this.statisticalDetector = getAnomalyDetector();
    this.isolationForestDetector = getIsolationForestDetector();
    this.adaptiveThreshold = getAdaptiveThreshold();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Process a single metric input (streaming mode).
   */
  public process(input: ServerMetricInput): UnifiedDetectionResult {
    const startTime = performance.now();
    const timestamp = input.timestamp ?? Date.now();
    const date = new Date(timestamp);

    // Update buffer
    updateBuffers({
      metricBuffer: this.metricBuffer,
      multiMetricBuffer: this.multiMetricBuffer,
      input,
      timestamp,
      streamBufferSize: this.config.streamBufferSize,
    });

    // Run all enabled detectors
    const statResult = runStatisticalDetection(
      this.config.enableStatistical,
      this.statisticalDetector,
      input,
      this.metricBuffer
    );
    const ifResult = runIsolationForestDetection(
      this.config.enableIsolationForest,
      this.isolationForestDetector,
      input,
      timestamp
    );
    const adaptiveResult = runAdaptiveDetection(
      this.config.enableAdaptive,
      this.adaptiveThreshold,
      input,
      timestamp
    );

    // Combine results
    const result = combineDetectionResults({
      config: this.config,
      input,
      statResult,
      ifResult,
      adaptiveResult,
      timestamp,
      date,
    });

    // Calculate latency
    const latencyMs = performance.now() - startTime;
    result.latencyMs = Math.round(latencyMs * 100) / 100;

    // Update stats
    this.updateStats(result, latencyMs);

    // Emit events if configured
    if (this.config.emitEvents && result.isAnomaly) {
      this.emit('anomaly', result);
    }

    // Auto-train if configured
    if (this.config.autoTrain) {
      this.autoTrainModels();
    }

    return result;
  }

  /**
   * Process multiple metrics in batch.
   */
  public processBatch(inputs: ServerMetricInput[]): UnifiedDetectionResult[] {
    return inputs.map((input) => this.process(input));
  }

  /**
   * Initialize models with historical data.
   */
  public initialize(historicalData: {
    multiMetric?: MultiMetricDataPoint[];
    perMetric?: Record<string, MetricDataPoint[]>;
  }): void {
    // Train Isolation Forest
    if (historicalData.multiMetric && historicalData.multiMetric.length >= 50) {
      this.isolationForestDetector.fit(historicalData.multiMetric);
      this.stats.modelsStatus.isolationForestTrained = true;
      logger.info(
        `[UnifiedEngine] IF trained with ${historicalData.multiMetric.length} samples`
      );
    }

    // Initialize adaptive thresholds
    if (historicalData.perMetric) {
      for (const [metric, data] of Object.entries(historicalData.perMetric)) {
        this.adaptiveThreshold.learn(
          metric,
          data.map((d) => ({ timestamp: d.timestamp, value: d.value }))
        );
        if (!this.stats.modelsStatus.adaptiveLearnedMetrics.includes(metric)) {
          this.stats.modelsStatus.adaptiveLearnedMetrics.push(metric);
        }
      }
      logger.info(
        `[UnifiedEngine] Adaptive thresholds initialized for: ${Object.keys(historicalData.perMetric).join(', ')}`
      );
    }
  }

  /**
   * Get streaming statistics.
   */
  public getStats(): StreamingStats {
    return {
      ...this.stats,
      bufferSize: this.multiMetricBuffer.length,
      modelsStatus: {
        ...this.stats.modelsStatus,
        isolationForestTrained: this.isolationForestDetector.getStatus().isTrained,
        adaptiveLearnedMetrics: this.adaptiveThreshold.getStatus().metrics,
      },
    };
  }

  /**
   * Get configuration.
   */
  public getConfig(): UnifiedEngineConfig {
    return { ...this.config };
  }

  /**
   * Reset all state.
   */
  public reset(): void {
    this.metricBuffer.clear();
    this.multiMetricBuffer = [];
    this.isolationForestDetector.reset();
    this.adaptiveThreshold.reset();
    this.stats = {
      totalProcessed: 0,
      anomaliesDetected: 0,
      averageLatencyMs: 0,
      lastProcessedAt: 0,
      bufferSize: 0,
      modelsStatus: {
        statisticalReady: true,
        isolationForestTrained: false,
        adaptiveLearnedMetrics: [],
      },
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private updateStats(result: UnifiedDetectionResult, latencyMs: number): void {
    this.stats.totalProcessed++;
    if (result.isAnomaly) {
      this.stats.anomaliesDetected++;
    }
    this.stats.lastProcessedAt = Date.now();

    // Running average for latency
    const prevTotal =
      this.stats.averageLatencyMs * (this.stats.totalProcessed - 1);
    this.stats.averageLatencyMs =
      (prevTotal + latencyMs) / this.stats.totalProcessed;
  }

  private autoTrainModels(): void {
    // Retrain IF every 50 new samples
    if (
      this.multiMetricBuffer.length >= 50 &&
      this.multiMetricBuffer.length % 50 === 0
    ) {
      this.isolationForestDetector.fit(this.multiMetricBuffer);
      this.stats.modelsStatus.isolationForestTrained = true;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let engineInstance: UnifiedAnomalyEngine | null = null;

/**
 * Get singleton instance of UnifiedAnomalyEngine.
 */
export function getUnifiedAnomalyEngine(
  config?: Partial<UnifiedEngineConfig>
): UnifiedAnomalyEngine {
  if (!engineInstance) {
    engineInstance = new UnifiedAnomalyEngine(config);
  }
  return engineInstance;
}

/**
 * Reset the singleton instance.
 */
export function resetUnifiedAnomalyEngine(): void {
  if (engineInstance) {
    engineInstance.reset();
    engineInstance.removeAllListeners();
  }
  engineInstance = null;
}
