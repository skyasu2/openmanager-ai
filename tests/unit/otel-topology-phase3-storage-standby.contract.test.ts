import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getServerIP } from '../../src/config/server-registry';

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

type TimeSeries = {
  serverIds: string[];
  timestamps: number[];
  metrics: Record<string, number[][]>;
};

type ResourceCatalog = {
  resources: Record<string, Record<string, string | number>>;
};

const STORAGE_ID = 'storage-nfs-dc1-02';
const STORAGE_HOSTNAME = `${STORAGE_ID}.openmanager.kr`;
const HOURLY_DIR = path.resolve('public/data/otel-data/hourly');
const TIMESERIES_PATH = path.resolve('public/data/otel-data/timeseries.json');
const RESOURCE_CATALOG_PATH = path.resolve(
  'public/data/otel-data/resource-catalog.json'
);

function loadHour(hour: number): HourlyFile {
  return JSON.parse(
    fs.readFileSync(
      path.join(HOURLY_DIR, `hour-${String(hour).padStart(2, '0')}.json`),
      'utf8'
    )
  );
}

describe('OTel topology Phase 3-C AZ2 NFS standby contract', () => {
  it('registers storage-nfs-dc1-02 in resource catalog and server registry', () => {
    const catalog: ResourceCatalog = JSON.parse(
      fs.readFileSync(RESOURCE_CATALOG_PATH, 'utf8')
    );
    const entry = catalog.resources[STORAGE_ID];

    expect(entry).toBeDefined();
    expect(entry?.['host.name']).toBe(STORAGE_HOSTNAME);
    expect(entry?.['cloud.availability_zone']).toBe('DC1-AZ2');
    expect(entry?.['host.cpu.count']).toBe(4);
    expect(entry?.['host.memory.size']).toBe(17_179_869_184);
    expect(entry?.['host.disk.size']).toBe(5_368_709_120_000);
    expect(entry?.['server.purpose']).toBe('hot-standby');
    expect(entry?.['server.notes']).toBe('nfs failover target');
    expect(getServerIP(STORAGE_ID)).toBe('10.100.1.52');
  });

  it('adds AZ2 NFS standby datapoints to every hourly file and timeseries metric set', () => {
    for (let hour = 0; hour < 24; hour++) {
      const data = loadHour(hour);

      for (const metricName of [
        'system.cpu.utilization',
        'system.memory.utilization',
        'system.filesystem.utilization',
        'system.network.io',
        'system.uptime',
        'system.process.count',
      ]) {
        const metric = data.slots[0]?.metrics.find(
          (entry) => entry.name === metricName
        );
        const found = metric?.dataPoints.some(
          (point) => point.attributes['host.name'] === STORAGE_HOSTNAME
        );
        expect(found, `${metricName} missing in hour ${hour}`).toBe(true);
      }
    }

    const ts: TimeSeries = JSON.parse(fs.readFileSync(TIMESERIES_PATH, 'utf8'));
    const serverIdx = ts.serverIds.indexOf(STORAGE_ID);

    expect(serverIdx).toBeGreaterThanOrEqual(0);
    for (const metricName of [
      'system.cpu.utilization',
      'system.memory.utilization',
      'system.filesystem.utilization',
      'system.network.io',
      'system.uptime',
      'system.process.count',
    ]) {
      expect(ts.metrics[metricName]?.[serverIdx]?.length).toBe(
        ts.timestamps.length
      );
    }
  });
});
