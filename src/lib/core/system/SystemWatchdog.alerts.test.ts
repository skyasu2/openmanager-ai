import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  detectMemoryLeak: vi.fn(() => false),
}));

vi.mock('../interfaces/SystemEventBus', () => ({
  SystemEventType: { WATCHDOG_ALERT: 'WATCHDOG_ALERT' },
}));

vi.mock('./SystemWatchdog.helpers', () => ({
  detectMemoryLeak: mocks.detectMemoryLeak,
}));

import {
  buildWatchdogAlertPlans,
  getCurrentWatchdogAlerts,
} from './SystemWatchdog.alerts';

type SystemMetrics = {
  cpu: Array<{ timestamp: number; value: number }>;
  memory: Array<{ timestamp: number; value: number }>;
  errorRate: number;
  restartCount: number;
  performanceScore: number;
  stabilityScore: number;
};

function makeHealthyMetrics(
  overrides: Partial<SystemMetrics> = {}
): SystemMetrics {
  return {
    cpu: [{ timestamp: Date.now(), value: 30 }],
    memory: [{ timestamp: Date.now(), value: 50 }],
    errorRate: 5,
    restartCount: 0,
    performanceScore: 90,
    stabilityScore: 95,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.detectMemoryLeak.mockReturnValue(false);
});

describe('getCurrentWatchdogAlerts', () => {
  it('should return all false for healthy metrics', () => {
    const alerts = getCurrentWatchdogAlerts(makeHealthyMetrics());

    expect(alerts.memoryLeak).toBe(false);
    expect(alerts.highErrorRate).toBe(false);
    expect(alerts.performanceDegradation).toBe(false);
    expect(alerts.frequentRestarts).toBe(false);
  });

  it('should detect high error rate when errorRate > 25', () => {
    const alerts = getCurrentWatchdogAlerts(
      makeHealthyMetrics({ errorRate: 30 })
    );

    expect(alerts.highErrorRate).toBe(true);
  });

  it('should detect performance degradation when performanceScore < 60', () => {
    const alerts = getCurrentWatchdogAlerts(
      makeHealthyMetrics({ performanceScore: 45 })
    );

    expect(alerts.performanceDegradation).toBe(true);
  });

  it('should detect frequent restarts when restartCount > 5', () => {
    const alerts = getCurrentWatchdogAlerts(
      makeHealthyMetrics({ restartCount: 8 })
    );

    expect(alerts.frequentRestarts).toBe(true);
  });

  it('should detect memory leak when detectMemoryLeak returns true', () => {
    mocks.detectMemoryLeak.mockReturnValue(true);

    const alerts = getCurrentWatchdogAlerts(makeHealthyMetrics());

    expect(alerts.memoryLeak).toBe(true);
    expect(mocks.detectMemoryLeak).toHaveBeenCalled();
  });
});

describe('buildWatchdogAlertPlans', () => {
  it('should return empty array when no alerts are triggered', () => {
    const metrics = makeHealthyMetrics();
    const plans = buildWatchdogAlertPlans(metrics, 50);

    expect(plans).toEqual([]);
  });

  it('should include memory-leak plan with critical severity', () => {
    mocks.detectMemoryLeak.mockReturnValue(true);
    const metrics = makeHealthyMetrics();
    const plans = buildWatchdogAlertPlans(metrics, 85);

    const memoryPlan = plans.find((p) => p.alertType === 'memory-leak');
    expect(memoryPlan).toBeDefined();
    expect(memoryPlan?.eventPayload.payload.severity).toBe('critical');
    expect(memoryPlan?.eventPayload.payload.metrics.memoryUsage).toBe(85);
    expect(memoryPlan?.eventPayload.source).toBe('SystemWatchdog');
  });

  it('should include high-error-rate plan with error rate in message', () => {
    const metrics = makeHealthyMetrics({ errorRate: 30.5 });
    const plans = buildWatchdogAlertPlans(metrics, 50);

    const errorPlan = plans.find((p) => p.alertType === 'high-error-rate');
    expect(errorPlan).toBeDefined();
    expect(errorPlan?.message).toContain('30.5%');
    expect(errorPlan?.eventPayload.payload.severity).toBe('warning');
    expect(errorPlan?.eventPayload.payload.metrics.errorRate).toBe(30.5);
  });

  it('should include performance-degradation plan', () => {
    const metrics = makeHealthyMetrics({ performanceScore: 40 });
    const plans = buildWatchdogAlertPlans(metrics, 50);

    const perfPlan = plans.find(
      (p) => p.alertType === 'performance-degradation'
    );
    expect(perfPlan).toBeDefined();
    expect(perfPlan?.eventPayload.payload.severity).toBe('warning');
    expect(perfPlan?.eventPayload.payload.metrics.performanceScore).toBe(40);
  });

  it('should include stability plan when stabilityScore < 70', () => {
    const metrics = makeHealthyMetrics({ stabilityScore: 55.3 });
    const plans = buildWatchdogAlertPlans(metrics, 50);

    const stabilityPlan = plans.find((p) => p.alertType === 'stability');
    expect(stabilityPlan).toBeDefined();
    expect(stabilityPlan?.message).toContain('55.3%');
    expect(stabilityPlan?.eventPayload.payload.severity).toBe('warning');
    expect(stabilityPlan?.eventPayload.payload.metrics.stabilityScore).toBe(
      55.3
    );
  });

  it('should include frequent-restarts plan with restart count in message', () => {
    const metrics = makeHealthyMetrics({ restartCount: 10 });
    const plans = buildWatchdogAlertPlans(metrics, 50);

    const restartPlan = plans.find((p) => p.alertType === 'frequent-restarts');
    expect(restartPlan).toBeDefined();
    expect(restartPlan?.message).toContain('10');
    expect(restartPlan?.eventPayload.payload.severity).toBe('warning');
    expect(restartPlan?.eventPayload.payload.metrics.restartCount).toBe(10);
  });

  it('should return multiple plans when multiple alerts are triggered', () => {
    mocks.detectMemoryLeak.mockReturnValue(true);
    const metrics = makeHealthyMetrics({
      errorRate: 50,
      performanceScore: 30,
      stabilityScore: 40,
      restartCount: 10,
    });

    const plans = buildWatchdogAlertPlans(metrics, 90);

    expect(plans.length).toBe(5);
    const alertTypes = plans.map((p) => p.alertType);
    expect(alertTypes).toContain('memory-leak');
    expect(alertTypes).toContain('high-error-rate');
    expect(alertTypes).toContain('performance-degradation');
    expect(alertTypes).toContain('stability');
    expect(alertTypes).toContain('frequent-restarts');
  });
});
