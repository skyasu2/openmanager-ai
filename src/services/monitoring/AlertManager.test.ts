import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetAllThresholds = vi.hoisted(() =>
  vi.fn(() => ({
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 80, critical: 95 },
    disk: { warning: 85, critical: 95 },
    network: { warning: 70, critical: 90 },
  }))
);

vi.mock('@/config/rules/loader', () => ({
  getAllThresholds: mockGetAllThresholds,
}));

import { AlertManager } from '@/services/monitoring/AlertManager';

type MinimalServerMetrics = {
  serverId: string;
  serverType: string;
  location: string;
  status: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
};

function makeServer(
  overrides: Partial<MinimalServerMetrics> = {}
): MinimalServerMetrics {
  return {
    serverId: 'srv-01',
    serverType: 'web',
    location: 'us-east-1',
    status: 'running',
    cpu: 30,
    memory: 40,
    disk: 50,
    network: 20,
    ...overrides,
  };
}

describe('AlertManager', () => {
  let manager: AlertManager;
  const ts = '2026-03-06T00:00:00Z';

  beforeEach(() => {
    manager = new AlertManager();
  });

  // 1. Empty metrics returns no alerts
  it('should return no alerts for empty metrics', () => {
    const result = manager.evaluate([], ts);
    expect(result).toEqual([]);
    expect(manager.getFiringAlerts()).toEqual([]);
  });

  // 2. Metric above warning threshold creates warning alert
  it('should create a warning alert when metric exceeds warning threshold', () => {
    const server = makeServer({ cpu: 75 }); // warning=70
    const alerts = manager.evaluate([server], ts);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].metric).toBe('cpu');
    expect(alerts[0].state).toBe('firing');
    expect(alerts[0].serverId).toBe('srv-01');
    expect(alerts[0].threshold).toBe(70);
    expect(alerts[0].value).toBe(75);
  });

  // 3. Metric above critical threshold creates critical alert
  it('should create a critical alert when metric exceeds critical threshold', () => {
    const server = makeServer({ cpu: 95 }); // critical=90
    const alerts = manager.evaluate([server], ts);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].metric).toBe('cpu');
    expect(alerts[0].threshold).toBe(90);
    expect(alerts[0].value).toBe(95);
  });

  // 4. Metric below all thresholds creates no alert
  it('should create no alerts when all metrics are below thresholds', () => {
    const server = makeServer({
      cpu: 30,
      memory: 40,
      disk: 50,
      network: 20,
    });
    const alerts = manager.evaluate([server], ts);
    expect(alerts).toEqual([]);
  });

  // 5. Alert resolved when metric drops below threshold
  it('should resolve alert when metric drops below threshold', () => {
    const highCpu = makeServer({ cpu: 75 });
    manager.evaluate([highCpu], ts);
    expect(manager.getFiringAlerts()).toHaveLength(1);

    // Drop CPU below warning threshold
    const normalCpu = makeServer({ cpu: 50 });
    manager.evaluate([normalCpu], '2026-03-06T00:05:00Z');
    expect(manager.getFiringAlerts()).toHaveLength(0);
  });

  // 6. Resolved alerts move to history
  it('should move resolved alerts to history', () => {
    const highCpu = makeServer({ cpu: 75 });
    manager.evaluate([highCpu], ts);

    const normalCpu = makeServer({ cpu: 50 });
    manager.evaluate([normalCpu], '2026-03-06T00:05:00Z');

    const history = manager.getRecentHistory();
    expect(history).toHaveLength(1);
    expect(history[0].state).toBe('resolved');
    expect(history[0].resolvedAt).toBe('2026-03-06T00:05:00Z');
  });

  // 7. getCriticalAlerts returns only critical severity
  it('should return only critical alerts from getCriticalAlerts', () => {
    const server = makeServer({
      cpu: 95, // critical
      memory: 85, // warning
    });
    manager.evaluate([server], ts);

    const critical = manager.getCriticalAlerts();
    const warning = manager.getWarningAlerts();

    expect(critical).toHaveLength(1);
    expect(critical[0].metric).toBe('cpu');
    expect(critical[0].severity).toBe('critical');
    expect(warning).toHaveLength(1);
    expect(warning[0].metric).toBe('memory');
  });

  // 8. getWarningAlerts returns only warning severity
  it('should return only warning alerts from getWarningAlerts', () => {
    const server = makeServer({
      cpu: 75, // warning
      memory: 85, // warning
      disk: 50, // normal
    });
    manager.evaluate([server], ts);

    const warnings = manager.getWarningAlerts();
    expect(warnings).toHaveLength(2);
    expect(warnings.every((a) => a.severity === 'warning')).toBe(true);
  });

  // 9. getAllAlerts returns both firing and resolved
  it('should return both firing and resolved alerts from getAllAlerts', () => {
    // Create alert, then resolve it, then create a new one
    const highCpu = makeServer({ cpu: 75 });
    manager.evaluate([highCpu], ts);

    // Resolve cpu, fire memory
    const highMemory = makeServer({ cpu: 50, memory: 85 });
    manager.evaluate([highMemory], '2026-03-06T00:05:00Z');

    const all = manager.getAllAlerts();
    expect(all.firing).toHaveLength(1);
    expect(all.firing[0].metric).toBe('memory');
    expect(all.resolved).toHaveLength(1);
    expect(all.resolved[0].metric).toBe('cpu');
    expect(all.resolved[0].state).toBe('resolved');
  });

  // 10. Alert duration updates on re-evaluation
  it('should update alert duration on re-evaluation', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    const server = makeServer({ cpu: 75 });
    manager.evaluate([server], new Date(now).toISOString());
    expect(manager.getFiringAlerts()[0].duration).toBe(0);

    // Advance time by 60 seconds
    vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    manager.evaluate([server], new Date(now + 60_000).toISOString());

    const alerts = manager.getFiringAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].duration).toBe(60);

    vi.restoreAllMocks();
  });

  // 11. History limited to 200 entries (MAX_HISTORY)
  it('should limit history to 200 entries', () => {
    for (let i = 0; i < 210; i++) {
      const server = makeServer({
        serverId: `srv-${i}`,
        cpu: 75,
      });
      manager.evaluate([server], ts);

      // Resolve by evaluating with normal metrics
      const normalServer = makeServer({
        serverId: `srv-${i}`,
        cpu: 30,
      });
      manager.evaluate([normalServer], ts);
    }

    const history = manager.getRecentHistory();
    expect(history).toHaveLength(200);
    // Oldest entries should have been shifted out (srv-0 through srv-9)
    expect(history[0].serverId).toBe('srv-10');
    expect(history[199].serverId).toBe('srv-209');
  });
});
