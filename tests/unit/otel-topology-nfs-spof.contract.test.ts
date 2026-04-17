import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type HourlyFile = {
  slots: Array<{
    metrics: Array<{
      name: string;
      dataPoints: Array<{
        asDouble: number;
        attributes: Record<string, string>;
      }>;
    }>;
    logs: Array<{
      resource: string;
      severityText: string;
      body: string;
    }>;
  }>;
};

type TimeSeries = {
  serverIds: string[];
  metrics: Record<string, number[][]>;
};

const HOURLY_DIR = path.resolve('public/data/otel-data/hourly');
const TIMESERIES_PATH = path.resolve('public/data/otel-data/timeseries.json');
const WAS_IDS = ['api-was-dc1-01', 'api-was-dc1-02', 'api-was-dc1-03'];

function loadHour(hour: number): HourlyFile {
  return JSON.parse(
    fs.readFileSync(
      path.join(HOURLY_DIR, `hour-${String(hour).padStart(2, '0')}.json`),
      'utf8'
    )
  );
}

describe('OTel topology NFS SPOF contract', () => {
  it('adds storage-nfs-dc1-01 saturation during hours 02-04', () => {
    for (const hour of [2, 3, 4]) {
      const data = loadHour(hour);
      const diskSeries = data.slots
        .map((slot) => {
          const metric = slot.metrics.find(
            (entry) => entry.name === 'system.filesystem.utilization'
          );
          const point = metric?.dataPoints.find((dp) =>
            String(dp.attributes['host.name'] ?? '').startsWith(
              'storage-nfs-dc1-01.'
            )
          );
          return point?.asDouble;
        })
        .filter((value): value is number => typeof value === 'number');

      const cpuSeries = data.slots
        .map((slot) => {
          const metric = slot.metrics.find(
            (entry) => entry.name === 'system.cpu.utilization'
          );
          const point = metric?.dataPoints.find((dp) =>
            String(dp.attributes['host.name'] ?? '').startsWith(
              'storage-nfs-dc1-01.'
            )
          );
          return point?.asDouble;
        })
        .filter((value): value is number => typeof value === 'number');

      expect(diskSeries.length).toBe(6);
      expect(cpuSeries.length).toBe(6);
      expect(Math.max(...diskSeries)).toBeGreaterThanOrEqual(0.82);
      expect(Math.max(...cpuSeries)).toBeGreaterThanOrEqual(0.45);
    }
  });

  it('records NFS bottleneck cause logs and syncs WAS latency to timeseries', () => {
    const matchingLogs: string[] = [];

    for (const hour of [2, 3, 4]) {
      const data = loadHour(hour);
      for (const slot of data.slots) {
        for (const log of slot.logs) {
          if (
            (log.resource === 'storage-nfs-dc1-01' ||
              WAS_IDS.includes(log.resource)) &&
            /nfs/i.test(log.body)
          ) {
            matchingLogs.push(`${hour}:${log.resource}:${log.body}`);
          }
        }
      }
    }

    expect(matchingLogs.length).toBeGreaterThanOrEqual(9);

    const ts: TimeSeries = JSON.parse(fs.readFileSync(TIMESERIES_PATH, 'utf8'));
    const responseSeries = WAS_IDS.flatMap((serverId) => {
      const idx = ts.serverIds.indexOf(serverId);
      return ts.metrics['http.server.request.duration']?.[idx] ?? [];
    });

    expect(
      Math.max(...responseSeries.slice(2 * 6, 5 * 6))
    ).toBeGreaterThanOrEqual(0.5);
  });
});
