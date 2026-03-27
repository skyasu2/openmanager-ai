import { describe, it, expect } from 'vitest';
import { SimpleAnomalyDetector, type MetricDataPoint } from './SimpleAnomalyDetector';

function makePoints(values: number[], startTime = 0): MetricDataPoint[] {
  return values.map((value, i) => ({
    timestamp: startTime + i * 600_000,
    value,
  }));
}

describe('SimpleAnomalyDetector.detectBaselineDrift', () => {
  const detector = new SimpleAnomalyDetector({
    movingAverageWindow: 36,
    stdDevMultiplier: 2,
    minDataPoints: 12,
  });

  it('should return stable when baseline is flat', () => {
    // 36 points all at 50%
    const data = makePoints(Array(36).fill(50));
    const result = detector.detectBaselineDrift(data);

    expect(result.hasDrift).toBe(false);
    expect(result.direction).toBe('stable');
    expect(result.magnitudeSigma).toBe(0);
  });

  it('should detect increasing drift when second half rises', () => {
    // First 18 points at ~40%, second 18 at ~60%
    const first = Array(18).fill(0).map(() => 40 + Math.random() * 2);
    const second = Array(18).fill(0).map(() => 60 + Math.random() * 2);
    const data = makePoints([...first, ...second]);
    const result = detector.detectBaselineDrift(data);

    expect(result.hasDrift).toBe(true);
    expect(result.direction).toBe('increasing');
    expect(result.magnitude).toBeGreaterThan(0);
    expect(result.magnitudeSigma).toBeGreaterThan(1);
  });

  it('should detect decreasing drift when second half drops', () => {
    // First 18 points at ~70%, second 18 at ~45%
    const first = Array(18).fill(0).map(() => 70 + Math.random() * 2);
    const second = Array(18).fill(0).map(() => 45 + Math.random() * 2);
    const data = makePoints([...first, ...second]);
    const result = detector.detectBaselineDrift(data);

    expect(result.hasDrift).toBe(true);
    expect(result.direction).toBe('decreasing');
    expect(result.magnitude).toBeLessThan(0);
    expect(result.magnitudeSigma).toBeGreaterThan(1);
  });

  it('should return confidence 0 when data is insufficient', () => {
    const data = makePoints([50, 60, 70]); // only 3 points, below minDataPoints
    const result = detector.detectBaselineDrift(data);

    expect(result.hasDrift).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('should use custom driftThresholdSigma', () => {
    // Moderate drift that exceeds 0.5σ but not 2σ
    const first = Array(18).fill(0).map(() => 50 + Math.random());
    const second = Array(18).fill(0).map(() => 55 + Math.random());
    const data = makePoints([...first, ...second]);

    const looseDrift = detector.detectBaselineDrift(data, 0.5);
    const strictDrift = detector.detectBaselineDrift(data, 5.0);

    expect(looseDrift.hasDrift).toBe(true);
    expect(strictDrift.hasDrift).toBe(false);
  });
});
