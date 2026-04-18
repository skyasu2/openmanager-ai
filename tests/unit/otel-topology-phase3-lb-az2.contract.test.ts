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

const LB_ID = 'lb-haproxy-dc1-03';
const LB_HOSTNAME = `${LB_ID}.openmanager.kr`;
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

describe('OTel topology Phase 3-A AZ2 LB contract', () => {
  it('registers lb-haproxy-dc1-03 in resource catalog and server registry', () => {
    const catalog: ResourceCatalog = JSON.parse(
      fs.readFileSync(RESOURCE_CATALOG_PATH, 'utf8')
    );
    const entry = catalog.resources[LB_ID];

    expect(entry).toBeDefined();
    expect(entry?.['host.name']).toBe(LB_HOSTNAME);
    expect(entry?.['cloud.availability_zone']).toBe('DC1-AZ2');
    expect(entry?.['host.cpu.count']).toBe(4);
    expect(entry?.['host.memory.size']).toBe(8_589_934_592);
    expect(entry?.['host.disk.size']).toBe(53_687_091_200);
    expect(getServerIP(LB_ID)).toBe('10.100.1.2');
  });

  it('adds AZ2 LB datapoints to every hourly file and timeseries metric set', () => {
    for (let hour = 0; hour < 24; hour++) {
      const data = loadHour(hour);

      for (const metricName of [
        'system.cpu.utilization',
        'system.network.io',
        'system.uptime',
        'http.server.request.duration',
      ]) {
        const metric = data.slots[0]?.metrics.find(
          (entry) => entry.name === metricName
        );
        const found = metric?.dataPoints.some(
          (point) => point.attributes['host.name'] === LB_HOSTNAME
        );
        expect(found, `${metricName} missing in hour ${hour}`).toBe(true);
      }
    }

    const ts: TimeSeries = JSON.parse(fs.readFileSync(TIMESERIES_PATH, 'utf8'));
    const serverIdx = ts.serverIds.indexOf(LB_ID);

    expect(serverIdx).toBeGreaterThanOrEqual(0);
    for (const metricName of [
      'system.cpu.utilization',
      'system.network.io',
      'system.uptime',
      'system.process.count',
      'http.server.request.duration',
    ]) {
      expect(ts.metrics[metricName]?.[serverIdx]?.length).toBe(
        ts.timestamps.length
      );
    }
  });
});
