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

function loadHour(hour: number): HourlyFile {
  return JSON.parse(
    fs.readFileSync(
      path.join(HOURLY_DIR, `hour-${String(hour).padStart(2, '0')}.json`),
      'utf8'
    )
  );
}

describe('OTel topology redis cross-AZ latency contract', () => {
  it('adds api-was-dc1-03 latency spikes during hours 13-15', () => {
    for (const hour of [13, 14, 15]) {
      const data = loadHour(hour);
      const series = data.slots
        .map((slot) => {
          const metric = slot.metrics.find(
            (entry) => entry.name === 'http.server.request.duration'
          );
          const point = metric?.dataPoints.find((dp) =>
            String(dp.attributes['host.name'] ?? '').startsWith(
              'api-was-dc1-03.'
            )
          );
          return point?.asDouble;
        })
        .filter((value): value is number => typeof value === 'number');

      expect(series.length).toBe(6);
      expect(Math.max(...series)).toBeGreaterThanOrEqual(0.35);
    }
  });

  it('records remote AZ cache cause logs and syncs response times to timeseries', () => {
    const matchingLogs: string[] = [];

    for (const hour of [13, 14, 15]) {
      const data = loadHour(hour);
      for (const slot of data.slots) {
        for (const log of slot.logs) {
          if (
            (log.resource === 'api-was-dc1-03' ||
              log.resource === 'cache-redis-dc1-01') &&
            /remote az cache/i.test(log.body)
          ) {
            matchingLogs.push(`${hour}:${log.resource}:${log.body}`);
          }
        }
      }
    }

    expect(matchingLogs.length).toBeGreaterThanOrEqual(6);

    const ts: TimeSeries = JSON.parse(fs.readFileSync(TIMESERIES_PATH, 'utf8'));
    const serverIndex = ts.serverIds.indexOf('api-was-dc1-03');
    const responseSeries =
      ts.metrics['http.server.request.duration']?.[serverIndex] ?? [];

    expect(
      Math.max(...responseSeries.slice(13 * 6, 16 * 6))
    ).toBeGreaterThanOrEqual(0.35);
  });
});
