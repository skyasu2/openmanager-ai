import { describe, it, expect } from 'vitest';
import { STATUS_THRESHOLDS, buildTrendThresholds } from './status-thresholds';

/**
 * system-rules.json의 SSOT 값과 STATUS_THRESHOLDS 일치 검증.
 * system-rules.json 로드 실패 시 폴백 값이 적용되므로, 폴백 자체가 SSOT와 동일한지 확인.
 */
describe('STATUS_THRESHOLDS SSOT alignment', () => {
  const SSOT_VALUES = {
    cpu: { warning: 80, critical: 90, recovery: 65 },
    memory: { warning: 80, critical: 90, recovery: 75 },
    disk: { warning: 80, critical: 90, recovery: 75 },
    network: { warning: 70, critical: 85, recovery: 60 },
    responseTime: { warning: 2000, critical: 5000, recovery: 1500 },
  };

  for (const [metric, expected] of Object.entries(SSOT_VALUES)) {
    it(`${metric}: warning/critical should match system-rules.json`, () => {
      const actual = STATUS_THRESHOLDS[metric as keyof typeof STATUS_THRESHOLDS];
      expect(actual.warning).toBe(expected.warning);
      expect(actual.critical).toBe(expected.critical);
    });
  }

  it('recovery < warning invariant for all metrics', () => {
    for (const metric of ['cpu', 'memory', 'disk', 'network'] as const) {
      const t = STATUS_THRESHOLDS[metric];
      if (t.recovery !== undefined) {
        expect(t.recovery).toBeLessThan(t.warning);
      }
    }
  });
});

describe('buildTrendThresholds', () => {
  it('should return all 4 metrics with recovery', () => {
    const thresholds = buildTrendThresholds();

    expect(Object.keys(thresholds)).toEqual(
      expect.arrayContaining(['cpu', 'memory', 'disk', 'network'])
    );

    for (const t of Object.values(thresholds)) {
      expect(t.recovery).toBeDefined();
      expect(t.recovery).toBeLessThan(t.warning);
    }
  });

  it('should use recovery from SSOT or fallback to warning × 0.8', () => {
    const thresholds = buildTrendThresholds();
    // If system-rules.json is loaded, recovery=65 (SSOT).
    // If fallback, recovery = Math.round(80 * 0.8) = 64.
    // Both are valid — the key invariant is recovery < warning.
    expect(thresholds['cpu'].recovery).toBeLessThan(thresholds['cpu'].warning);
    expect(thresholds['cpu'].recovery).toBeGreaterThanOrEqual(60);
    expect(thresholds['cpu'].recovery).toBeLessThanOrEqual(65);
  });
});
