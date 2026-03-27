/**
 * 📈 Trend Predictor
 *
 * @description
 * Simple linear regression-based trend prediction for server metrics.
 * Predicts future values and classifies trends as increasing/decreasing/stable.
 *
 * @algorithm
 * 1. Calculate slope using least squares linear regression
 * 2. Calculate R² (coefficient of determination) for confidence
 * 3. Predict future values using y = mx + b
 * 4. Classify trend based on slope magnitude
 *
 * @features
 * - Client-side calculation (no API calls)
 * - 1-hour prediction using recent 12 data points (5-minute intervals)
 * - R² confidence score
 * - Stable/Increasing/Decreasing classification
 *
 * @version 1.0.0
 * @date 2025-11-21
 */

import {
  type EnhancedTrendPrediction,
  type MetricThresholds,
  type TrendDataPoint,
  type TrendPrediction,
  type TrendPredictionConfig,
} from './TrendPredictor.types';
import {
  determineStatus,
  predictRecovery,
  predictThresholdBreach,
} from './TrendPredictor.enhanced';
import { buildTrendThresholds } from '../../../config/status-thresholds';
export type {
  EnhancedTrendPrediction,
  MetricThresholds,
  RecoveryPrediction,
  ThresholdBreachPrediction,
  TrendDataPoint,
  TrendPrediction,
  TrendPredictionConfig,
} from './TrendPredictor.types';

export class TrendPredictor {
  private config: TrendPredictionConfig;
  private thresholds: Record<string, MetricThresholds>;

  constructor(
    config?: Partial<TrendPredictionConfig>,
    thresholds?: Record<string, MetricThresholds>
  ) {
    this.config = {
      regressionWindow: config?.regressionWindow ?? 12, // 1 hour
      slopeThreshold: config?.slopeThreshold ?? 0.1,
      minR2: config?.minR2 ?? 0.7,
    };
    this.thresholds = thresholds ?? buildTrendThresholds();
  }

  /**
   * Predict trend for a single metric.
   *
   * @param historicalData - Array of historical data points (sorted by timestamp, oldest first)
   * @param predictionHorizon - Time horizon in milliseconds (default: 1 hour)
   * @returns Trend prediction result
   */
  public predictTrend(
    historicalData: TrendDataPoint[],
    predictionHorizon: number = 3600000 // 1 hour in ms
  ): TrendPrediction {
    const timestamp = Date.now();

    // Validate input
    if (historicalData.length < 2) {
      return {
        trend: 'stable',
        prediction: historicalData[0]?.value || 0,
        confidence: 0,
        details: {
          currentValue: historicalData[0]?.value || 0,
          slope: 0,
          intercept: 0,
          r2: 0,
          predictedChange: 0,
          predictedChangePercent: 0,
        },
        timestamp,
      };
    }

    // Extract recent data for regression
    const recentData = historicalData.slice(-this.config.regressionWindow);
    const lastDataPoint = recentData[recentData.length - 1];
    if (!lastDataPoint) {
      return {
        trend: 'stable',
        prediction: 0,
        confidence: 0,
        details: {
          currentValue: 0,
          slope: 0,
          intercept: 0,
          r2: 0,
          predictedChange: 0,
          predictedChangePercent: 0,
        },
        timestamp,
      };
    }
    const currentValue = lastDataPoint.value;

    // Perform linear regression
    const { slope, intercept, r2 } = this.linearRegression(recentData);

    // Predict future value
    const futureTimestamp = timestamp + predictionHorizon;
    const firstDataPoint = recentData[0];
    if (!firstDataPoint) {
      return {
        trend: 'stable',
        prediction: currentValue,
        confidence: 0,
        details: {
          currentValue,
          slope: 0,
          intercept: 0,
          r2: 0,
          predictedChange: 0,
          predictedChangePercent: 0,
        },
        timestamp,
      };
    }
    const prediction = this.predictValue(
      futureTimestamp,
      firstDataPoint.timestamp,
      slope,
      intercept
    );

    // Calculate predicted change
    const predictedChange = prediction - currentValue;
    const predictedChangePercent =
      currentValue !== 0 ? (predictedChange / currentValue) * 100 : 0;

    // Classify trend
    // Convert slope from per-second to per-hour (3600 seconds) and normalize by current value
    // threshold 0.1 means 10% change per hour
    const normalizedSlope = (slope * 3600) / (currentValue || 1);
    const trend = this.classifyTrend(normalizedSlope);

    // Calculate confidence
    const confidence = this.calculateConfidence(r2, recentData.length);

    return {
      trend,
      prediction,
      confidence,
      details: {
        currentValue,
        slope,
        intercept,
        r2,
        predictedChange,
        predictedChangePercent,
      },
      timestamp,
    };
  }

  /**
   * Batch predict trends for multiple metrics.
   *
   * @param metricsData - Map of metric name to historical data points
   * @param predictionHorizon - Time horizon in milliseconds (default: 1 hour)
   * @returns Map of metric name to trend prediction
   */
  public predictTrends(
    metricsData: Record<string, TrendDataPoint[]>,
    predictionHorizon?: number
  ): Record<string, TrendPrediction> {
    const results: Record<string, TrendPrediction> = {};

    for (const [metricName, data] of Object.entries(metricsData)) {
      results[metricName] = this.predictTrend(data, predictionHorizon);
    }

    return results;
  }

  // ============================================================================
  // 🆕 Enhanced Prediction Methods (상용 도구 수준)
  // ============================================================================

  /**
   * 🆕 향상된 예측: 임계값 도달 시간 + 정상 복귀 시간 포함
   *
   * @description
   * Prometheus predict_linear() + Datadog Recovery Forecast 스타일 구현.
   * 현재 상태가 정상이면 → 언제 Warning/Critical이 될지 예측
   * 현재 상태가 Warning/Critical이면 → 언제 정상으로 돌아올지 예측
   *
   * @param historicalData - 과거 데이터 포인트 배열
   * @param metricName - 메트릭 이름 (cpu, memory, disk, network)
   * @returns 향상된 예측 결과
   */
  public predictEnhanced(
    historicalData: TrendDataPoint[],
    metricName: string = 'cpu'
  ): EnhancedTrendPrediction {
    // 1. 기본 예측 실행
    const basePrediction = this.predictTrend(historicalData);
    const currentValue = basePrediction.details.currentValue;
    const slope = basePrediction.details.slope;

    // 1.5. 백분율 메트릭(cpu/memory/disk/network): 포화 모델 적용
    // 선형 회귀는 100% 초과를 예측하지만, 실제로는:
    // - OOM Killer가 프로세스 강제 종료 → 메모리 급락
    // - Redis maxmemory → eviction 발동 → 메모리 감소
    // - 시스템 자체 보호 메커니즘이 100% 도달을 방지
    // 따라서 critical 임계값(90%) 이상에서는 로지스틱 감속을 적용
    const percentMetrics = new Set(['cpu', 'memory', 'disk', 'network']);
    if (percentMetrics.has(metricName)) {
      const cpuFallback = this.thresholds['cpu'] ?? buildTrendThresholds()['cpu'];
      const criticalThreshold = (this.thresholds[metricName] || cpuFallback).critical;
      const linearPrediction = basePrediction.prediction;

      let adjusted: number;
      if (linearPrediction > criticalThreshold && currentValue < criticalThreshold) {
        // 현재 critical 미만 → 예측이 critical 초과: 점진적 감속
        // critical 지점까지는 선형, 이후는 로지스틱 감속
        const overshoot = linearPrediction - criticalThreshold;
        const maxOvershoot = 100 - criticalThreshold; // 10%
        // 로지스틱: overshoot이 클수록 실제 증가분은 줄어듦
        const dampedOvershoot = maxOvershoot * (1 - Math.exp(-overshoot / maxOvershoot));
        adjusted = criticalThreshold + dampedOvershoot;
      } else {
        adjusted = Math.max(0, Math.min(100, linearPrediction));
      }

      if (adjusted !== basePrediction.prediction) {
        basePrediction.prediction = adjusted;
        basePrediction.details.predictedChange = adjusted - currentValue;
        basePrediction.details.predictedChangePercent =
          currentValue !== 0
            ? ((adjusted - currentValue) / currentValue) * 100
            : 0;
      }
    }

    // 2. 임계값 가져오기
    const thresholds = this.thresholds[metricName] || (this.thresholds['cpu'] ?? buildTrendThresholds()['cpu']);

    // 3. 현재 상태 판단
    const currentStatus = determineStatus(currentValue, thresholds);

    // 4. 임계값 도달 예측 (Prometheus predict_linear 스타일)
    const thresholdBreach = predictThresholdBreach(
      currentValue,
      slope,
      thresholds,
      currentStatus
    );

    // 5. 정상 복귀 예측 (Datadog Recovery Forecast 스타일)
    const recovery = predictRecovery(
      currentValue,
      slope,
      thresholds,
      currentStatus
    );

    return {
      ...basePrediction,
      thresholdBreach,
      recovery,
      currentStatus,
    };
  }

  /**
   * 🆕 배치 향상된 예측
   */
  public predictEnhancedBatch(
    metricsData: Record<string, TrendDataPoint[]>
  ): Record<string, EnhancedTrendPrediction> {
    const results: Record<string, EnhancedTrendPrediction> = {};

    for (const [metricName, data] of Object.entries(metricsData)) {
      results[metricName] = this.predictEnhanced(data, metricName);
    }

    return results;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate linear regression coefficients using least squares method.
   *
   * Formula:
   * - slope (m) = (n∑xy - ∑x∑y) / (n∑x² - (∑x)²)
   * - intercept (b) = (∑y - m∑x) / n
   *
   * @param data - Array of data points
   * @returns Slope, intercept, and R² values
   */
  private linearRegression(data: TrendDataPoint[]): {
    slope: number;
    intercept: number;
    r2: number;
  } {
    const n = data.length;

    // Normalize timestamps to start from 0 for numerical stability
    const firstPoint = data[0];
    if (!firstPoint) {
      return { slope: 0, intercept: 0, r2: 0 };
    }
    const baseTime = firstPoint.timestamp;
    const x = data.map((d) => (d.timestamp - baseTime) / 1000); // Convert to seconds
    const y = data.map((d) => d.value);

    // Calculate sums
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * (y[i] ?? 0), 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    // Calculate slope and intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R² (coefficient of determination)
    const yMean = sumY / n;
    const ssTotal = sumY2 - n * yMean * yMean;
    const ssResidual = y.reduce((sum, yi, i) => {
      const xi = x[i] ?? 0;
      const predicted = slope * xi + intercept;
      return sum + (yi - predicted) ** 2;
    }, 0);
    const r2 = ssTotal !== 0 ? 1 - ssResidual / ssTotal : 0;

    return { slope, intercept, r2 };
  }

  /**
   * Predict value at a future timestamp.
   *
   * @param futureTimestamp - Future timestamp in milliseconds
   * @param baseTimestamp - Base timestamp used in regression
   * @param slope - Regression slope (per second)
   * @param intercept - Regression intercept
   * @returns Predicted value
   */
  private predictValue(
    futureTimestamp: number,
    baseTimestamp: number,
    slope: number,
    intercept: number
  ): number {
    const x = (futureTimestamp - baseTimestamp) / 1000; // Convert to seconds
    return slope * x + intercept;
  }

  /**
   * Classify trend based on normalized slope.
   *
   * @param normalizedSlope - Slope normalized by current value
   * @returns Trend classification
   */
  private classifyTrend(
    normalizedSlope: number
  ): 'increasing' | 'decreasing' | 'stable' {
    if (normalizedSlope > this.config.slopeThreshold) {
      return 'increasing';
    } else if (normalizedSlope < -this.config.slopeThreshold) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * Calculate confidence based on R² and data availability.
   *
   * @param r2 - R² value from regression
   * @param dataPoints - Number of data points used
   * @returns Confidence score (0-1)
   */
  private calculateConfidence(r2: number, dataPoints: number): number {
    // R² component: How well the linear model fits the data
    const r2Component = Math.max(0, r2);

    // Data availability component: More data = higher confidence
    const minPoints = 2;
    const maxPoints = this.config.regressionWindow;
    const dataComponent =
      dataPoints < minPoints
        ? 0
        : dataPoints >= maxPoints
          ? 1
          : (dataPoints - minPoints) / (maxPoints - minPoints);

    // Combined confidence (weighted average)
    return r2Component * 0.7 + dataComponent * 0.3;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a singleton instance of TrendPredictor.
 */
let instance: TrendPredictor | null = null;

export function getTrendPredictor(
  config?: Partial<TrendPredictionConfig>
): TrendPredictor {
  if (!instance) {
    instance = new TrendPredictor(config);
  }
  return instance;
}
