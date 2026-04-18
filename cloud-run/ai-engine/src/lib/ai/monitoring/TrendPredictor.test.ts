import { describe, expect, it } from 'vitest';

import { TrendPredictor } from './TrendPredictor';
import type { TrendDataPoint } from './TrendPredictor.types';

function buildSeries(values: number[]): TrendDataPoint[] {
  const base = Date.UTC(2026, 3, 18, 0, 0, 0);
  return values.map((value, index) => ({
    timestamp: base + index * 10 * 60 * 1000,
    value,
  }));
}

describe('TrendPredictor.predictEnhanced', () => {
  it('should change projected value when prediction horizon changes', () => {
    const predictor = new TrendPredictor();
    const historicalData = buildSeries([40, 44, 48, 52, 56, 60]);

    const oneHour = predictor.predictEnhanced(
      historicalData,
      'cpu',
      1 * 60 * 60 * 1000
    );
    const threeHours = predictor.predictEnhanced(
      historicalData,
      'cpu',
      3 * 60 * 60 * 1000
    );

    expect(threeHours.prediction).toBeGreaterThan(oneHour.prediction);
  });

  it('should limit threshold breach evaluation to the requested horizon', () => {
    const predictor = new TrendPredictor();
    const historicalData = buildSeries([58, 60, 62, 64, 66, 68]);

    const oneHour = predictor.predictEnhanced(
      historicalData,
      'cpu',
      1 * 60 * 60 * 1000
    );
    const threeHours = predictor.predictEnhanced(
      historicalData,
      'cpu',
      3 * 60 * 60 * 1000
    );

    expect(oneHour.thresholdBreach.willBreachCritical).toBe(false);
    expect(threeHours.thresholdBreach.willBreachCritical).toBe(true);
  });
});
