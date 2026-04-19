import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyScenarioJitter,
  gaussianJitter,
} from '../../scripts/data/otel-fix.helpers';

type LogEntry = {
  severityText: string;
  body: string;
  resource: string;
};

type DataPoint = {
  asDouble: number;
  attributes: Record<string, string>;
};

type Metric = {
  name: string;
  dataPoints: DataPoint[];
};

type Slot = {
  metrics: Metric[];
  logs: LogEntry[];
};

type HourlyFile = {
  slots: Slot[];
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

function getInfoLogs(slot: Slot, resource: string): string[] {
  return slot.logs
    .filter((log) => log.severityText === 'INFO' && log.resource === resource)
    .map((log) => log.body);
}

function getMetricValue(
  slot: Slot,
  metricName: string,
  resource: string
): number | undefined {
  const metric = slot.metrics.find((entry) => entry.name === metricName);
  const point = metric?.dataPoints.find((dp) =>
    String(dp.attributes['host.name'] ?? '').startsWith(`${resource}.`)
  );
  return point?.asDouble;
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state + 1) / 4294967297;
  };
}

describe('OTel simulation v2 Phase B contract', () => {
  it('adds db-specific INFO templates such as slow query or replication lag logs', () => {
    const hour10 = loadHour(10);
    const dbInfoMessages = hour10.slots.flatMap((slot) =>
      getInfoLogs(slot, 'db-mysql-dc1-primary')
    );

    expect(
      dbInfoMessages.some((body) =>
        /slow query detected: \d+ms|replication lag: \d+ms/i.test(body)
      )
    ).toBe(true);
  });

  it('keeps at least 3 INFO logs per server slot', () => {
    const violations: Array<{
      hour: number;
      slotIndex: number;
      resource: string;
      count: number;
    }> = [];

    for (let hour = 0; hour < 24; hour++) {
      const data = loadHour(hour);

      data.slots.forEach((slot, slotIndex) => {
        const counts = new Map<string, number>();

        for (const log of slot.logs) {
          if (log.severityText !== 'INFO') continue;
          counts.set(log.resource, (counts.get(log.resource) ?? 0) + 1);
        }

        for (const [resource, count] of counts.entries()) {
          if (count < 3) {
            violations.push({ hour, slotIndex, resource, count });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('avoids repeating the same INFO message across 3 consecutive slots for a resource', () => {
    const byResource = new Map<string, string[][]>();

    for (let hour = 0; hour < 24; hour++) {
      const data = loadHour(hour);
      for (const slot of data.slots) {
        const resourceBuckets = new Map<string, string[]>();
        for (const log of slot.logs) {
          if (log.severityText !== 'INFO') continue;
          const bucket = resourceBuckets.get(log.resource) ?? [];
          bucket.push(log.body);
          resourceBuckets.set(log.resource, bucket);
        }

        for (const [resource, messages] of resourceBuckets.entries()) {
          const slots = byResource.get(resource) ?? [];
          slots.push(messages);
          byResource.set(resource, slots);
        }
      }
    }

    const violations: Array<{
      resource: string;
      message: string;
      startSlot: number;
    }> = [];

    for (const [resource, slots] of byResource.entries()) {
      const firstMessages = slots.map((messages) => messages[0] ?? '');

      for (let i = 0; i < firstMessages.length - 2; i++) {
        const message = firstMessages[i];
        if (!message) continue;
        if (
          message === firstMessages[i + 1] &&
          message === firstMessages[i + 2]
        ) {
          violations.push({ resource, message, startSlot: i });
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('emits low cache hit ratio INFO logs when cache memory exceeds 80 percent', () => {
    const matchingLogs: Array<{
      hour: number;
      slotIndex: number;
      memory: number;
      ratio: number;
    }> = [];

    for (let hour = 0; hour < 24; hour++) {
      const data = loadHour(hour);

      data.slots.forEach((slot, slotIndex) => {
        const memory = getMetricValue(
          slot,
          'system.memory.utilization',
          'cache-redis-dc1-01'
        );
        if (typeof memory !== 'number' || memory <= 0.8) return;

        const ratios = getInfoLogs(slot, 'cache-redis-dc1-01')
          .map((body) => body.match(/cache hit ratio: (\d+)%/i))
          .filter((match): match is RegExpMatchArray => Boolean(match))
          .map((match) => Number.parseInt(match[1] ?? '', 10))
          .filter((value) => Number.isFinite(value));

        for (const ratio of ratios) {
          if (ratio < 60) {
            matchingLogs.push({ hour, slotIndex, memory, ratio });
          }
        }
      });
    }

    expect(matchingLogs.length).toBeGreaterThan(0);
  });
});

describe('OTel simulation v2 Phase A contract', () => {
  it('gaussianJitter stays centered and keeps roughly 95 percent of samples within 2σ', () => {
    const rng = createSeededRng(20260419);
    const samples = Array.from({ length: 1000 }, () =>
      gaussianJitter(0, 0.015, rng)
    );
    const mean =
      samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const withinTwoSigma = samples.filter(
      (value) => Math.abs(value) <= 0.03
    ).length;

    expect(Math.abs(mean)).toBeLessThan(0.002);
    expect(withinTwoSigma / samples.length).toBeGreaterThanOrEqual(0.94);
  });

  it('applyScenarioJitter keeps scenario values within [0.01, 0.99]', () => {
    const rng = createSeededRng(20260420);
    const samples = Array.from({ length: 600 }, (_, index) =>
      applyScenarioJitter(
        index % 2 === 0 ? 0.92 : 0.14,
        (((index % 6) - 2.5) / 6) * 0.04,
        'cpu',
        rng
      )
    );

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.01);
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.99);
  });
});
