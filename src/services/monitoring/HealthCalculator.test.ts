/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import type { Alert } from './AlertManager';
import { HealthCalculator } from './HealthCalculator';
import type { AggregatedMetrics } from './MetricsAggregator';

function makeMetrics(
  overrides: Partial<AggregatedMetrics> = {}
): AggregatedMetrics {
  return {
    avgCpu: 30,
    avgMemory: 40,
    avgDisk: 50,
    avgNetwork: 20,
    maxCpu: 50,
    maxMemory: 60,
    maxDisk: 70,
    totalServers: 10,
    onlineCount: 8,
    warningCount: 1,
    criticalCount: 1,
    offlineCount: 0,
    ...overrides,
  } as AggregatedMetrics;
}

function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-1',
    serverId: 'srv-01',
    instance: 'srv-01:9100',
    labels: {},
    metric: 'cpu',
    value: 90,
    threshold: 85,
    severity: 'warning',
    state: 'firing',
    firedAt: new Date().toISOString(),
    duration: 60,
    ...overrides,
  } as Alert;
}

describe('HealthCalculator', () => {
  const calc = new HealthCalculator();

  it('returns 100/A for perfect health (no alerts, low metrics)', () => {
    const result = calc.calculate(makeMetrics(), []);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('deducts 15 per critical alert', () => {
    const alerts = [
      makeAlert({ severity: 'critical' }),
      makeAlert({ id: 'a2', severity: 'critical' }),
    ];
    const result = calc.calculate(makeMetrics(), alerts);
    expect(result.penalties.criticalAlerts).toBe(30);
    expect(result.score).toBe(70);
  });

  it('deducts 5 per warning alert', () => {
    const alerts = [makeAlert({ severity: 'warning' })];
    const result = calc.calculate(makeMetrics(), alerts);
    expect(result.penalties.warningAlerts).toBe(5);
    expect(result.score).toBe(95);
  });

  it('penalizes high average CPU (>= 70)', () => {
    const result = calc.calculate(makeMetrics({ avgCpu: 85 }), []);
    // (85-70)*0.5 = 7.5 → 8
    expect(result.penalties.highCpuAvg).toBe(8);
    expect(result.score).toBe(92);
  });

  it('penalizes high average Memory (>= 80)', () => {
    const result = calc.calculate(makeMetrics({ avgMemory: 95 }), []);
    // (95-80)*0.4 = 6
    expect(result.penalties.highMemoryAvg).toBe(6);
  });

  it('penalizes high average Disk (>= 85)', () => {
    const result = calc.calculate(makeMetrics({ avgDisk: 95 }), []);
    // (95-85)*0.3 = 3
    expect(result.penalties.highDiskAvg).toBe(3);
  });

  it('penalizes long-firing alerts (> 300s)', () => {
    const alerts = [makeAlert({ duration: 600 })];
    const result = calc.calculate(makeMetrics(), alerts);
    expect(result.penalties.longFiringAlerts).toBe(3);
  });

  it('never returns score below 0', () => {
    const alerts = Array.from({ length: 10 }, (_, i) =>
      makeAlert({ id: `a${i}`, severity: 'critical', duration: 600 })
    );
    const result = calc.calculate(
      makeMetrics({ avgCpu: 99, avgMemory: 99, avgDisk: 99 }),
      alerts
    );
    expect(result.score).toBe(0);
    expect(result.grade).toBe('F');
  });

  it('assigns correct grades at boundaries', () => {
    // Grade A: 90+
    expect(calc.calculate(makeMetrics(), []).grade).toBe('A');
    // Grade B: 75-89 → 2 warnings = -10 = 90
    const twoWarnings = [
      makeAlert({ severity: 'warning' }),
      makeAlert({ id: 'a2', severity: 'warning' }),
    ];
    expect(calc.calculate(makeMetrics(), twoWarnings).grade).toBe('A'); // 90
    // 3 warnings = -15 = 85
    const threeWarnings = [
      ...twoWarnings,
      makeAlert({ id: 'a3', severity: 'warning' }),
    ];
    expect(calc.calculate(makeMetrics(), threeWarnings).grade).toBe('B'); // 85
  });
});
