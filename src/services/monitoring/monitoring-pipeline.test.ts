/**
 * 모니터링 파이프라인 통합 테스트
 *
 * AlertManager → MetricsAggregator → HealthCalculator 흐름 검증
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import type { ServerMetrics } from '@/services/metrics/MetricsProvider';
import { AlertManager } from './AlertManager';
import { HealthCalculator } from './HealthCalculator';
import { MetricsAggregator } from './MetricsAggregator';

// ============================================================================
// Test Fixtures
// ============================================================================

function makeServerMetrics(
  overrides: Partial<ServerMetrics> & { serverId: string }
): ServerMetrics {
  return {
    serverId: overrides.serverId,
    serverType: overrides.serverType ?? 'web',
    location: overrides.location ?? 'dc1-az1',
    cpu: overrides.cpu ?? 50,
    memory: overrides.memory ?? 60,
    disk: overrides.disk ?? 40,
    network: overrides.network ?? 30,
    status: overrides.status ?? 'online',
    uptime: overrides.uptime ?? '30d',
    os: overrides.os ?? 'linux',
    responseTime: overrides.responseTime ?? 120,
  } as ServerMetrics;
}

const NORMAL_SERVERS: ServerMetrics[] = [
  makeServerMetrics({
    serverId: 'web-01',
    cpu: 45,
    memory: 55,
    disk: 30,
    network: 25,
  }),
  makeServerMetrics({
    serverId: 'web-02',
    cpu: 50,
    memory: 60,
    disk: 35,
    network: 30,
  }),
  makeServerMetrics({
    serverId: 'db-01',
    serverType: 'database',
    cpu: 40,
    memory: 70,
    disk: 50,
    network: 20,
  }),
];

const WARNING_SERVERS: ServerMetrics[] = [
  makeServerMetrics({
    serverId: 'web-01',
    cpu: 82,
    memory: 55,
    disk: 30,
    network: 25,
    status: 'warning',
  }),
  makeServerMetrics({
    serverId: 'web-02',
    cpu: 50,
    memory: 83,
    disk: 35,
    network: 30,
    status: 'warning',
  }),
  makeServerMetrics({
    serverId: 'db-01',
    serverType: 'database',
    cpu: 40,
    memory: 70,
    disk: 50,
    network: 20,
  }),
];

const CRITICAL_SERVERS: ServerMetrics[] = [
  makeServerMetrics({
    serverId: 'web-01',
    cpu: 95,
    memory: 92,
    disk: 30,
    network: 25,
    status: 'critical',
  }),
  makeServerMetrics({
    serverId: 'web-02',
    cpu: 91,
    memory: 88,
    disk: 85,
    network: 30,
    status: 'critical',
  }),
  makeServerMetrics({
    serverId: 'db-01',
    serverType: 'database',
    cpu: 88,
    memory: 93,
    disk: 92,
    network: 86,
    status: 'critical',
  }),
];

const TIMESTAMP = '2026-02-04T10:00:00+09:00';

// ============================================================================
// Tests: AlertManager
// ============================================================================

describe('AlertManager', () => {
  it('정상 서버에서는 alert이 발생하지 않음', () => {
    const alertManager = new AlertManager();
    const alerts = alertManager.evaluate(NORMAL_SERVERS, TIMESTAMP);
    expect(alerts).toHaveLength(0);
  });

  it('warning 임계값 초과 시 warning alert 생성', () => {
    const alertManager = new AlertManager();
    const alerts = alertManager.evaluate(WARNING_SERVERS, TIMESTAMP);

    expect(alerts.length).toBeGreaterThan(0);
    const warningAlerts = alerts.filter((a) => a.severity === 'warning');
    expect(warningAlerts.length).toBeGreaterThan(0);
  });

  it('critical 임계값 초과 시 critical alert 생성', () => {
    const alertManager = new AlertManager();
    const alerts = alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);

    const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
    expect(criticalAlerts.length).toBeGreaterThan(0);
  });

  it('CPU 90% 이상이면 critical alert', () => {
    const alertManager = new AlertManager();
    const alerts = alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);

    const cpuCriticals = alerts.filter(
      (a) => a.metric === 'cpu' && a.severity === 'critical'
    );
    // web-01 (95%), web-02 (91%)
    expect(cpuCriticals).toHaveLength(2);
    expect(cpuCriticals[0]!.threshold).toBe(90);
  });

  it('Memory 80% 이상 90% 미만이면 warning alert', () => {
    const alertManager = new AlertManager();
    const alerts = alertManager.evaluate(WARNING_SERVERS, TIMESTAMP);

    const memoryWarnings = alerts.filter(
      (a) => a.metric === 'memory' && a.severity === 'warning'
    );
    // web-02 (83%)
    expect(memoryWarnings).toHaveLength(1);
    expect(memoryWarnings[0]!.threshold).toBe(80);
  });

  it('Network 70% 이상이면 warning, 85% 이상이면 critical', () => {
    const alertManager = new AlertManager();
    const alerts = alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);

    const networkAlerts = alerts.filter((a) => a.metric === 'network');
    const networkCritical = networkAlerts.filter(
      (a) => a.severity === 'critical'
    );
    // db-01 network=86
    expect(networkCritical).toHaveLength(1);
  });

  it('alert에 serverId, instance, labels 포함', () => {
    const alertManager = new AlertManager();
    const alerts = alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);

    const alert = alerts[0]!;
    expect(alert.serverId).toBeDefined();
    expect(alert.instance).toContain(':9100');
    expect(alert.labels).toHaveProperty('server_type');
    expect(alert.state).toBe('firing');
  });

  it('alert이 해소되면 resolved 상태로 전환', () => {
    const alertManager = new AlertManager();

    // 1차: critical alert 발생
    alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);
    expect(alertManager.getFiringAlerts().length).toBeGreaterThan(0);

    // 2차: 정상 서버로 전환 → alert 해소
    alertManager.evaluate(NORMAL_SERVERS, '2026-02-04T10:10:00+09:00');
    expect(alertManager.getFiringAlerts()).toHaveLength(0);
    expect(alertManager.getRecentHistory().length).toBeGreaterThan(0);
    expect(alertManager.getRecentHistory()[0]!.state).toBe('resolved');
  });

  it('getCriticalAlerts()는 critical만 반환', () => {
    const alertManager = new AlertManager();
    alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);

    const criticals = alertManager.getCriticalAlerts();
    expect(criticals.every((a) => a.severity === 'critical')).toBe(true);
  });

  it('getWarningAlerts()는 warning만 반환', () => {
    const alertManager = new AlertManager();
    alertManager.evaluate(
      [
        ...WARNING_SERVERS,
        makeServerMetrics({
          serverId: 'critical-01',
          cpu: 95,
          status: 'critical',
        }),
      ],
      TIMESTAMP
    );

    const warnings = alertManager.getWarningAlerts();
    expect(warnings.every((a) => a.severity === 'warning')).toBe(true);
  });

  it('history는 최대 200개', () => {
    const alertManager = new AlertManager();

    // 210번 반복하여 alert 생성 → 해소 → history 누적
    for (let i = 0; i < 210; i++) {
      const server = makeServerMetrics({
        serverId: `server-${i}`,
        cpu: 95,
        status: 'critical',
      });
      alertManager.evaluate(
        [server],
        `2026-02-04T10:${i.toString().padStart(2, '0')}:00+09:00`
      );
      alertManager.evaluate(
        NORMAL_SERVERS,
        `2026-02-04T10:${i.toString().padStart(2, '0')}:30+09:00`
      );
    }

    expect(alertManager.getRecentHistory().length).toBeLessThanOrEqual(200);
  });
});

// ============================================================================
// Tests: MetricsAggregator
// ============================================================================

describe('MetricsAggregator', () => {
  const aggregator = new MetricsAggregator();

  it('statusCounts 정확히 집계', () => {
    const metrics = [
      makeServerMetrics({ serverId: 's1', status: 'online' }),
      makeServerMetrics({ serverId: 's2', status: 'online' }),
      makeServerMetrics({ serverId: 's3', status: 'warning' }),
      makeServerMetrics({ serverId: 's4', status: 'critical' }),
      makeServerMetrics({ serverId: 's5', status: 'offline' }),
    ];

    const result = aggregator.aggregate(metrics);
    expect(result.statusCounts).toEqual({
      total: 5,
      online: 2,
      warning: 1,
      critical: 1,
      offline: 1,
    });
  });

  it('전체 평균 계산', () => {
    const metrics = [
      makeServerMetrics({
        serverId: 's1',
        cpu: 40,
        memory: 50,
        disk: 30,
        network: 20,
      }),
      makeServerMetrics({
        serverId: 's2',
        cpu: 60,
        memory: 70,
        disk: 50,
        network: 40,
      }),
    ];

    const result = aggregator.aggregate(metrics);
    expect(result.avgCpu).toBe(50);
    expect(result.avgMemory).toBe(60);
    expect(result.avgDisk).toBe(40);
    expect(result.avgNetwork).toBe(30);
  });

  it('server_type별 그룹 집계', () => {
    const metrics = [
      makeServerMetrics({ serverId: 'w1', serverType: 'web', cpu: 60 }),
      makeServerMetrics({ serverId: 'w2', serverType: 'web', cpu: 80 }),
      makeServerMetrics({ serverId: 'd1', serverType: 'database', cpu: 50 }),
    ];

    const result = aggregator.aggregate(metrics);
    expect(result.byServerType).toHaveLength(2);

    const webStats = result.byServerType.find((t) => t.serverType === 'web');
    expect(webStats?.count).toBe(2);
    expect(webStats?.avgCpu).toBe(70); // (60 + 80) / 2
    expect(webStats?.maxCpu).toBe(80);

    const dbStats = result.byServerType.find(
      (t) => t.serverType === 'database'
    );
    expect(dbStats?.count).toBe(1);
    expect(dbStats?.avgCpu).toBe(50);
  });

  it('Top-5 CPU 서버', () => {
    const metrics = Array.from({ length: 10 }, (_, i) =>
      makeServerMetrics({ serverId: `s${i}`, cpu: (i + 1) * 10 })
    );

    const result = aggregator.aggregate(metrics);
    expect(result.topCpu).toHaveLength(5);
    expect(result.topCpu[0]!.value).toBe(100); // 가장 높은 CPU
    expect(result.topCpu[4]!.value).toBe(60);
  });

  it('Top-5 Memory 서버', () => {
    const metrics = Array.from({ length: 10 }, (_, i) =>
      makeServerMetrics({ serverId: `s${i}`, memory: (i + 1) * 10 })
    );

    const result = aggregator.aggregate(metrics);
    expect(result.topMemory).toHaveLength(5);
    expect(result.topMemory[0]!.value).toBe(100);
  });

  it('빈 서버 목록 처리', () => {
    const result = aggregator.aggregate([]);
    expect(result.statusCounts.total).toBe(0);
    expect(result.avgCpu).toBe(0);
    expect(result.topCpu).toHaveLength(0);
  });

  it('서버 1개일 때 정상 처리', () => {
    const result = aggregator.aggregate([
      makeServerMetrics({ serverId: 's1', cpu: 75, memory: 60 }),
    ]);
    expect(result.statusCounts.total).toBe(1);
    expect(result.avgCpu).toBe(75);
    expect(result.topCpu).toHaveLength(1);
  });
});

// ============================================================================
// Tests: HealthCalculator
// ============================================================================

describe('HealthCalculator', () => {
  const calculator = new HealthCalculator();
  const aggregator = new MetricsAggregator();

  it('alert 없는 정상 상태 → score 100, grade A', () => {
    const aggregated = aggregator.aggregate(NORMAL_SERVERS);
    const report = calculator.calculate(aggregated, []);

    expect(report.score).toBe(100);
    expect(report.grade).toBe('A');
    expect(report.penalties.criticalAlerts).toBe(0);
    expect(report.penalties.warningAlerts).toBe(0);
  });

  it('critical alert → -15점/개', () => {
    const aggregated = aggregator.aggregate(NORMAL_SERVERS);
    const mockAlerts = [
      { severity: 'critical' as const, duration: 0 },
      { severity: 'critical' as const, duration: 0 },
    ] as Parameters<typeof calculator.calculate>[1];

    const report = calculator.calculate(aggregated, mockAlerts);
    expect(report.penalties.criticalAlerts).toBe(30);
    expect(report.score).toBe(70);
    expect(report.grade).toBe('C');
  });

  it('warning alert → -5점/개', () => {
    const aggregated = aggregator.aggregate(NORMAL_SERVERS);
    const mockAlerts = [
      { severity: 'warning' as const, duration: 0 },
      { severity: 'warning' as const, duration: 0 },
      { severity: 'warning' as const, duration: 0 },
    ] as Parameters<typeof calculator.calculate>[1];

    const report = calculator.calculate(aggregated, mockAlerts);
    expect(report.penalties.warningAlerts).toBe(15);
    expect(report.score).toBe(85);
    expect(report.grade).toBe('B');
  });

  it('높은 평균 CPU → 추가 감점', () => {
    const highCpuServers = [
      makeServerMetrics({ serverId: 's1', cpu: 80 }),
      makeServerMetrics({ serverId: 's2', cpu: 80 }),
    ];
    const aggregated = aggregator.aggregate(highCpuServers);
    // avgCpu = 80, penalty = (80 - 70) * 0.5 = 5
    const report = calculator.calculate(aggregated, []);
    expect(report.penalties.highCpuAvg).toBe(5);
    expect(report.score).toBe(95);
    expect(report.grade).toBe('A');
  });

  it('5분 이상 firing alert → 추가 감점', () => {
    const aggregated = aggregator.aggregate(NORMAL_SERVERS);
    const longFiringAlerts = [
      { severity: 'warning' as const, duration: 600 }, // 10분
      { severity: 'warning' as const, duration: 400 }, // 6.6분
    ] as Parameters<typeof calculator.calculate>[1];

    const report = calculator.calculate(aggregated, longFiringAlerts);
    // warning penalty: 2 * 5 = 10
    // longFiring penalty: 2 * 3 = 6
    expect(report.penalties.longFiringAlerts).toBe(6);
    expect(report.score).toBe(100 - 10 - 6);
  });

  it('score는 0 미만이 될 수 없음', () => {
    const aggregated = aggregator.aggregate(NORMAL_SERVERS);
    const manyAlerts = Array.from({ length: 20 }, () => ({
      severity: 'critical' as const,
      duration: 600,
    })) as Parameters<typeof calculator.calculate>[1];

    const report = calculator.calculate(aggregated, manyAlerts);
    expect(report.score).toBe(0);
    expect(report.grade).toBe('F');
  });

  it('grade 경계값 테스트', () => {
    const aggregated = aggregator.aggregate(NORMAL_SERVERS);

    // Score 90 → A
    const alertsFor90 = [
      { severity: 'warning' as const, duration: 0 },
      { severity: 'warning' as const, duration: 0 },
    ] as Parameters<typeof calculator.calculate>[1];
    expect(calculator.calculate(aggregated, alertsFor90).grade).toBe('A');

    // Score 75 → B
    const alertsFor75 = [
      { severity: 'critical' as const, duration: 0 },
      { severity: 'warning' as const, duration: 0 },
    ] as Parameters<typeof calculator.calculate>[1];
    // 100 - 15 - 5 = 80 → B
    expect(calculator.calculate(aggregated, alertsFor75).grade).toBe('B');
  });
});

// ============================================================================
// Tests: Pipeline Integration (AlertManager → Aggregator → Health)
// ============================================================================

describe('Monitoring Pipeline Integration', () => {
  it('정상 서버 → alert 없음 → health A', () => {
    const alertManager = new AlertManager();
    const aggregator = new MetricsAggregator();
    const healthCalc = new HealthCalculator();

    const alerts = alertManager.evaluate(NORMAL_SERVERS, TIMESTAMP);
    const aggregated = aggregator.aggregate(NORMAL_SERVERS);
    const health = healthCalc.calculate(aggregated, alerts);

    expect(alerts).toHaveLength(0);
    expect(health.grade).toBe('A');
    expect(health.score).toBe(100);
  });

  it('warning 서버 → warning alerts → health B 이상', () => {
    const alertManager = new AlertManager();
    const aggregator = new MetricsAggregator();
    const healthCalc = new HealthCalculator();

    const alerts = alertManager.evaluate(WARNING_SERVERS, TIMESTAMP);
    const aggregated = aggregator.aggregate(WARNING_SERVERS);
    const health = healthCalc.calculate(aggregated, alerts);

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.state === 'firing')).toBe(true);
    expect(health.score).toBeLessThan(100);
    expect(health.score).toBeGreaterThanOrEqual(60); // warning 수준
  });

  it('critical 서버 → critical alerts → health 급락', () => {
    const alertManager = new AlertManager();
    const aggregator = new MetricsAggregator();
    const healthCalc = new HealthCalculator();

    const alerts = alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);
    const aggregated = aggregator.aggregate(CRITICAL_SERVERS);
    const health = healthCalc.calculate(aggregated, alerts);

    const criticalCount = alerts.filter(
      (a) => a.severity === 'critical'
    ).length;
    expect(criticalCount).toBeGreaterThan(0);
    expect(health.score).toBeLessThan(60);
  });

  it('aggregated 데이터와 alert 데이터의 서버 수 일치', () => {
    const alertManager = new AlertManager();
    const aggregator = new MetricsAggregator();

    alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);
    const aggregated = aggregator.aggregate(CRITICAL_SERVERS);

    expect(aggregated.statusCounts.total).toBe(CRITICAL_SERVERS.length);
  });

  it('alert 해소 → health 회복 흐름', () => {
    const alertManager = new AlertManager();
    const aggregator = new MetricsAggregator();
    const healthCalc = new HealthCalculator();

    // Phase 1: Critical 상태
    const alerts1 = alertManager.evaluate(CRITICAL_SERVERS, TIMESTAMP);
    const agg1 = aggregator.aggregate(CRITICAL_SERVERS);
    const health1 = healthCalc.calculate(agg1, alerts1);

    // Phase 2: 정상 복구
    const alerts2 = alertManager.evaluate(
      NORMAL_SERVERS,
      '2026-02-04T10:10:00+09:00'
    );
    const agg2 = aggregator.aggregate(NORMAL_SERVERS);
    const health2 = healthCalc.calculate(agg2, alerts2);

    expect(health2.score).toBeGreaterThan(health1.score);
    expect(health2.grade).toBe('A');
  });

  it('Top CPU 서버가 실제 높은 CPU를 가진 서버', () => {
    const aggregator = new MetricsAggregator();
    const mixed = [
      makeServerMetrics({ serverId: 'low', cpu: 20 }),
      makeServerMetrics({ serverId: 'high', cpu: 95 }),
      makeServerMetrics({ serverId: 'mid', cpu: 60 }),
    ];

    const result = aggregator.aggregate(mixed);
    expect(result.topCpu[0]!.serverId).toBe('high');
    expect(result.topCpu[0]!.value).toBe(95);
  });
});
