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
      severityText: string;
    }>;
  }>;
};

const HOURLY_DIR = path.resolve('public/data/otel-data/hourly');

function loadHour(hour: number): HourlyFile {
  return JSON.parse(
    fs.readFileSync(
      path.join(HOURLY_DIR, `hour-${String(hour).padStart(2, '0')}.json`),
      'utf8'
    )
  );
}

describe('OTel topology baseline debt contract', () => {
  it('keeps all storage network datapoints inside the verify baseline range', () => {
    const outOfRange: Array<{ hour: number; serverId: string; value: number }> =
      [];

    for (let hour = 0; hour < 24; hour++) {
      const data = loadHour(hour);
      for (const slot of data.slots) {
        const metric = slot.metrics.find(
          (entry) => entry.name === 'system.network.io'
        );
        if (!metric) continue;

        for (const point of metric.dataPoints) {
          const serverId = String(point.attributes['host.name'] ?? '').split(
            '.'
          )[0];
          if (!serverId.startsWith('storage-')) continue;
          if (point.asDouble < 17_500_000 || point.asDouble > 45_000_000) {
            outOfRange.push({ hour, serverId, value: point.asDouble });
          }
        }
      }
    }

    expect(outOfRange).toEqual([]);
  });

  it('preserves an error ratio above 3 percent across generated hourly logs', () => {
    let totalLogs = 0;
    let errorLogs = 0;

    for (let hour = 0; hour < 24; hour++) {
      const data = loadHour(hour);
      for (const slot of data.slots) {
        for (const log of slot.logs) {
          totalLogs++;
          if (log.severityText === 'ERROR') {
            errorLogs++;
          }
        }
      }
    }

    expect(totalLogs).toBeGreaterThan(0);
    expect((errorLogs / totalLogs) * 100).toBeGreaterThan(3);
  });
});
