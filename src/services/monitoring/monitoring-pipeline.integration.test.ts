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
