import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type ResourceCatalog = {
  resources: Record<string, Record<string, string | number>>;
};

type HourlyFile = {
  slots: Array<{
    metrics: Array<{
      name: string;
      dataPoints: Array<{
        asDouble: number;
        attributes: Record<string, string>;
      }>;
    }>;
  }>;
};

const catalogPath = path.resolve('public/data/otel-data/resource-catalog.json');
const hour23Path = path.resolve('public/data/otel-data/hourly/hour-23.json');

function getBackupMetricSeries(metricName: string): number[] {
  const hourly: HourlyFile = JSON.parse(fs.readFileSync(hour23Path, 'utf8'));

  return hourly.slots
    .map((slot) => {
      const metric = slot.metrics.find((entry) => entry.name === metricName);
      const point = metric?.dataPoints.find((dp) =>
        String(dp.attributes['host.name'] ?? '').startsWith(
          'db-mysql-dc1-backup.'
        )
      );
      return point?.asDouble;
    })
    .filter((value): value is number => typeof value === 'number');
}

describe('OTel topology backup realism contract', () => {
  it('downsizes db-mysql-dc1-backup and annotates its purpose', () => {
    const catalog: ResourceCatalog = JSON.parse(
      fs.readFileSync(catalogPath, 'utf8')
    );
    const backup = catalog.resources['db-mysql-dc1-backup'];

    expect(backup?.['host.cpu.count']).toBe(8);
    expect(backup?.['host.memory.size']).toBe(34359738368);
    expect(backup?.['server.purpose']).toBe('cold-standby');
    expect(String(backup?.['server.notes'] ?? '')).toContain('daily snapshot');
  });

  it('keeps backup server on a disk-heavy, low-cpu profile during hour 23', () => {
    const cpuSeries = getBackupMetricSeries('system.cpu.utilization');
    const memorySeries = getBackupMetricSeries('system.memory.utilization');
    const diskSeries = getBackupMetricSeries('system.filesystem.utilization');

    expect(cpuSeries.length).toBe(6);
    expect(memorySeries.length).toBe(6);
    expect(diskSeries.length).toBe(6);

    expect(Math.max(...cpuSeries)).toBeLessThanOrEqual(0.35);
    expect(Math.max(...memorySeries)).toBeLessThanOrEqual(0.45);
    expect(Math.min(...diskSeries)).toBeGreaterThanOrEqual(0.68);
  });
});
