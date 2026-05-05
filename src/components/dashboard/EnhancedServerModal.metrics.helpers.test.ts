import { describe, expect, it } from 'vitest';
import { buildMetricsChartConfigs } from './EnhancedServerModal.metrics.helpers';
import type { RealtimeData, ServerData } from './EnhancedServerModal.types';

const server: ServerData = {
  id: 'api-was-dc1-01',
  hostname: 'api-was-dc1-01',
  name: 'api-was-dc1-01',
  type: 'application',
  environment: 'production',
  location: 'DC1-AZ1',
  provider: 'synthetic-otel',
  status: 'warning',
  cpu: 84,
  memory: 71,
  disk: 31,
  network: 20,
  uptime: '24h',
  lastUpdate: new Date('2026-05-05T00:00:00Z'),
  alerts: 1,
  services: [],
};

const staleRealtimeData: RealtimeData = {
  cpu: [30, 43],
  memory: [50, 57],
  disk: [40, 35],
  network: [10, 25],
  logs: [],
};

describe('buildMetricsChartConfigs', () => {
  it('uses the server current slot as the latest chart point', () => {
    const charts = buildMetricsChartConfigs(server, staleRealtimeData);

    expect(charts.find((chart) => chart.label === 'CPU 사용률')?.data).toEqual([
      30, 84,
    ]);
    expect(
      charts.find((chart) => chart.label === '메모리 사용률')?.data
    ).toEqual([50, 71]);
    expect(
      charts.find((chart) => chart.label === '디스크 사용률')?.data
    ).toEqual([40, 31]);
    expect(
      charts.find((chart) => chart.label === '네트워크 사용률')?.data
    ).toEqual([10, 20]);
  });

  it('creates a single current point when history is empty', () => {
    const charts = buildMetricsChartConfigs(server, {
      cpu: [],
      memory: [],
      disk: [],
      network: [],
      logs: [],
    });

    expect(charts.find((chart) => chart.label === 'CPU 사용률')?.data).toEqual([
      84,
    ]);
  });
});
