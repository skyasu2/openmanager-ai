import { describe, expect, it } from 'vitest';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { OTelHourlySlot } from '@/types/otel-metrics';
import {
  buildIncidentLogPatternsFromSlots,
  buildIncidentUptimeImpactFromSlots,
} from './enrichment';

function makeSlot({
  cpu,
  memory,
  logs = [],
}: {
  cpu: number;
  memory: number;
  logs?: OTelHourlySlot['logs'];
}): OTelHourlySlot {
  return {
    startTimeUnixNano: 1770994800000000000,
    endTimeUnixNano: 1770995400000000000,
    metrics: [
      {
        name: 'system.cpu.utilization',
        unit: '1',
        type: 'gauge',
        dataPoints: [
          {
            asDouble: cpu,
            attributes: {
              'host.name': 'cache-redis-dc1-01.openmanager.kr',
            },
          },
        ],
      },
      {
        name: 'system.memory.utilization',
        unit: '1',
        type: 'gauge',
        dataPoints: [
          {
            asDouble: memory,
            attributes: {
              'host.name': 'cache-redis-dc1-01.openmanager.kr',
            },
          },
        ],
      },
    ],
    logs,
  };
}

describe('incident report enrichment', () => {
  it('groups repeated WARN/ERROR log patterns by normalized message and server', () => {
    const patterns = buildIncidentLogPatternsFromSlots(
      [
        makeSlot({
          cpu: 0.2,
          memory: 0.3,
          logs: [
            {
              timeUnixNano: 1770994800000000000,
              severityNumber: 13,
              severityText: 'WARN',
              body: 'redis-server[6161]: memory usage 83% of maxmemory limit',
              attributes: { 'log.source': 'redis' },
              resource: 'cache-redis-dc1-01',
            },
            {
              timeUnixNano: 1770995400000000000,
              severityNumber: 13,
              severityText: 'WARN',
              body: 'redis-server[6167]: memory usage 84% of maxmemory limit',
              attributes: { 'log.source': 'redis' },
              resource: 'cache-redis-dc1-01',
            },
            {
              timeUnixNano: 1770996000000000000,
              severityNumber: 9,
              severityText: 'INFO',
              body: 'redis info log',
              attributes: { 'log.source': 'redis' },
              resource: 'cache-redis-dc1-01',
            },
          ],
        }),
      ],
      ['cache-redis-dc1-01']
    );

    expect(patterns).toEqual([
      expect.objectContaining({
        severity: 'WARNING',
        count: 2,
        serverId: 'cache-redis-dc1-01',
        message: 'redis-server[pid]: memory usage <pct>% of maxmemory limit',
      }),
    ]);
  });

  it('derives uptime impact from warning-or-critical metric slots', () => {
    const dataSlot: JobDataSlot = {
      slotIndex: 42,
      minuteOfDay: 420,
      timeLabel: '07:00 KST',
    };

    expect(
      buildIncidentUptimeImpactFromSlots({
        slots: [
          makeSlot({ cpu: 0.4, memory: 0.5 }),
          makeSlot({ cpu: 0.4, memory: 0.82 }),
          makeSlot({ cpu: 0.4, memory: 0.92 }),
        ],
        affectedServers: ['cache-redis-dc1-01'],
        dataSlot,
      })
    ).toEqual({
      uptimePercent: 33.3,
      affectedDurationMinutes: 20,
      dataSlotLabel: '07:00 KST',
    });
  });
});
