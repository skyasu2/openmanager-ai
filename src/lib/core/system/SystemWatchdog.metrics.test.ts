import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  calculateErrorRate: vi.fn(() => 0),
}));

vi.mock('./SystemWatchdog.helpers', () => ({
  calculateErrorRate: mocks.calculateErrorRate,
}));

vi.mock('./SystemWatchdog.types', () => ({}));

import { trimMetricsHistory, syncMetricsFromSystemStatus } from './SystemWatchdog.metrics';

type SystemMetrics = {
  cpu: Array<{ timestamp: number; value: number }>;
  memory: Array<{ timestamp: number; value: number }>;
  errorRate: number;
  restartCount: number;
  performanceScore: number;
  stabilityScore: number;
};

function makeMetrics(overrides?: Partial<SystemMetrics>): SystemMetrics {
  return {
    cpu: [],
    memory: [],
    errorRate: 0,
    restartCount: 0,
    performanceScore: 100,
    stabilityScore: 100,
    ...overrides,
  };
}

describe('trimMetricsHistory', () => {
  it('removes entries at or before the cutoff timestamp', () => {
    const metrics = makeMetrics({
      cpu: [
        { timestamp: 100, value: 10 },
        { timestamp: 200, value: 20 },
        { timestamp: 300, value: 30 },
      ],
      memory: [
        { timestamp: 100, value: 40 },
        { timestamp: 200, value: 50 },
        { timestamp: 300, value: 60 },
      ],
    });

    trimMetricsHistory(metrics, 200);

    expect(metrics.cpu).toEqual([{ timestamp: 300, value: 30 }]);
    expect(metrics.memory).toEqual([{ timestamp: 300, value: 60 }]);
  });

  it('keeps all entries when they are after the cutoff', () => {
    const metrics = makeMetrics({
      cpu: [
        { timestamp: 500, value: 1 },
        { timestamp: 600, value: 2 },
      ],
      memory: [{ timestamp: 500, value: 3 }],
    });

    trimMetricsHistory(metrics, 100);

    expect(metrics.cpu).toHaveLength(2);
    expect(metrics.memory).toHaveLength(1);
  });

  it('handles empty arrays without errors', () => {
    const metrics = makeMetrics();

    trimMetricsHistory(metrics, 999);

    expect(metrics.cpu).toEqual([]);
    expect(metrics.memory).toEqual([]);
  });

  it('trims cpu and memory independently', () => {
    const metrics = makeMetrics({
      cpu: [
        { timestamp: 100, value: 1 },
        { timestamp: 400, value: 2 },
      ],
      memory: [
        { timestamp: 300, value: 3 },
        { timestamp: 400, value: 4 },
      ],
    });

    trimMetricsHistory(metrics, 250);

    expect(metrics.cpu).toEqual([{ timestamp: 400, value: 2 }]);
    expect(metrics.memory).toEqual([
      { timestamp: 300, value: 3 },
      { timestamp: 400, value: 4 },
    ]);
  });
});

describe('syncMetricsFromSystemStatus', () => {
  beforeEach(() => {
    mocks.calculateErrorRate.mockReset();
    mocks.calculateErrorRate.mockReturnValue(0);
  });

  it('does not modify metrics when systemStatus is undefined', () => {
    const metrics = makeMetrics({ restartCount: 5, errorRate: 0.5 });

    syncMetricsFromSystemStatus(metrics, undefined);

    expect(metrics.restartCount).toBe(5);
    expect(metrics.errorRate).toBe(0.5);
    expect(mocks.calculateErrorRate).not.toHaveBeenCalled();
  });

  it('sets restartCount from totalRestarts', () => {
    const metrics = makeMetrics();
    const status = {
      metrics: { uptime: 1000, totalProcesses: 2, activeConnections: 5, totalRestarts: 7 },
    };

    syncMetricsFromSystemStatus(metrics, status);

    expect(metrics.restartCount).toBe(7);
  });

  it('sets restartCount to 0 when totalRestarts is missing', () => {
    const metrics = makeMetrics({ restartCount: 99 });
    const status = {
      metrics: { uptime: 1000, totalProcesses: 2, activeConnections: 5 },
    };

    syncMetricsFromSystemStatus(metrics, status);

    expect(metrics.restartCount).toBe(0);
  });

  it('calls calculateErrorRate and sets the returned value as errorRate', () => {
    mocks.calculateErrorRate.mockReturnValue(0.42);
    const metrics = makeMetrics();
    const status = {
      metrics: { uptime: 500, totalProcesses: 1, activeConnections: 0 },
    };

    syncMetricsFromSystemStatus(metrics, status);

    expect(mocks.calculateErrorRate).toHaveBeenCalledOnce();
    expect(mocks.calculateErrorRate).toHaveBeenCalledWith(status);
    expect(metrics.errorRate).toBe(0.42);
  });
});
