import { describe, expect, it } from 'vitest';
import { getMonitoringPeakMetric, getPeakMetricSlot } from './peak-metric';

describe('getPeakMetricSlot', () => {
  it('returns the highest load slot in the recent 24h OTel window', () => {
    const peak = getPeakMetricSlot({ metric: 'load', hours: 24 });

    expect(peak).not.toBeNull();
    expect(peak?.windowHours).toBe(24);
    expect(peak?.slotIndex).toBeGreaterThanOrEqual(0);
    expect(peak?.slotIndex).toBeLessThan(144);
    expect(peak?.timeLabel).toMatch(/^\d{2}:\d{2}$/);
    expect(peak?.requestedMetric).toBe('load');
    expect(peak?.sourceKey).toMatch(/^load[15]$/);
    expect(peak?.value).toBeGreaterThan(0);
    expect(peak?.topServers.length).toBeGreaterThan(0);
    expect(peak?.topServers[0]?.value).toBe(peak?.value);
  });

  it('uses the same helper for non-load metrics', () => {
    const peak = getPeakMetricSlot({ metric: 'cpu', hours: 24 });

    expect(peak).not.toBeNull();
    expect(peak?.requestedMetric).toBe('cpu');
    expect(peak?.sourceKey).toBe('cpu');
    expect(peak?.unit).toBe('%');
    expect(peak?.value).toBeGreaterThan(0);
  });

  it('adapts monitoring peak data for the domain evidence provider', () => {
    const peak = getMonitoringPeakMetric({ metric: 'load', windowHours: 24 });

    expect(peak).not.toBeNull();
    expect(peak?.requestedMetric).toBe('load');
    expect(peak?.sourceLabel).toContain('로드');
    expect(peak?.topServers.length).toBeGreaterThan(0);
  });
});
