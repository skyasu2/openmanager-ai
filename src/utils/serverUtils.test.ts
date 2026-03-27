import { describe, expect, it } from 'vitest';
import type { Server } from '@/types/server';
import {
  formatUptime,
  normalizeServerData,
  serverTypeGuards,
  sortServersByStatus,
} from './serverUtils';

describe('formatUptime', () => {
  // 기본 동작 (옵션 없음)
  it('returns string input as-is', () => {
    expect(formatUptime('5d 3h')).toBe('5d 3h');
  });

  it('returns "0m" for undefined', () => {
    expect(formatUptime()).toBe('0m');
  });

  it('returns "0m" for 0', () => {
    expect(formatUptime(0)).toBe('0m');
  });

  it('returns "0m" for negative', () => {
    expect(formatUptime(-100)).toBe('0m');
  });

  it('formats minutes only', () => {
    expect(formatUptime(300)).toBe('5m');
  });

  it('formats hours and minutes', () => {
    expect(formatUptime(7500)).toBe('2h 5m');
  });

  it('formats days and hours', () => {
    expect(formatUptime(90000)).toBe('1d 1h');
  });

  // locale: 'ko'
  it('formats ko locale — minutes only', () => {
    expect(formatUptime(300, { locale: 'ko' })).toBe('5분');
  });

  it('formats ko locale — hours and minutes', () => {
    expect(formatUptime(7500, { locale: 'ko' })).toBe('2시간 5분');
  });

  it('formats ko locale — days and hours', () => {
    expect(formatUptime(90000, { locale: 'ko' })).toBe('1일 1시간');
  });

  it('formats ko locale — days without remaining hours', () => {
    expect(formatUptime(86400, { locale: 'ko' })).toBe('1일');
  });

  it('formats ko locale — hours without remaining minutes', () => {
    expect(formatUptime(7200, { locale: 'ko' })).toBe('2시간');
  });

  // includeMinutes
  it('formats with includeMinutes', () => {
    expect(formatUptime(90060, { includeMinutes: true })).toBe('1d 1h 1m');
  });

  it('formats with includeMinutes — zero values', () => {
    expect(formatUptime(3600, { includeMinutes: true })).toBe('0d 1h 0m');
  });
});

describe('serverTypeGuards', () => {
  const makeServer = (overrides: Partial<Server> = {}) =>
    ({
      id: 'test-1',
      name: 'Test',
      hostname: 'test',
      status: 'online',
      cpu: 50,
      memory: 60,
      disk: 70,
      network: 30,
      ...overrides,
    }) as Server;

  it('getCpu returns number or 0', () => {
    expect(serverTypeGuards.getCpu(makeServer({ cpu: 85 }))).toBe(85);
    expect(
      serverTypeGuards.getCpu(
        makeServer({ cpu: undefined as unknown as number })
      )
    ).toBe(0);
  });

  it('getMemory returns number or 0', () => {
    expect(serverTypeGuards.getMemory(makeServer({ memory: 70 }))).toBe(70);
  });

  it('getDisk returns number or 0', () => {
    expect(serverTypeGuards.getDisk(makeServer({ disk: 90 }))).toBe(90);
  });

  it('getNetwork returns number or 25 default', () => {
    expect(serverTypeGuards.getNetwork(makeServer({ network: 40 }))).toBe(40);
    expect(
      serverTypeGuards.getNetwork(
        makeServer({ network: undefined as unknown as number })
      )
    ).toBe(25);
  });

  it('getAlerts handles number, array, and undefined', () => {
    expect(serverTypeGuards.getAlerts(3)).toBe(3);
    expect(serverTypeGuards.getAlerts([{} as never, {} as never])).toBe(2);
    expect(serverTypeGuards.getAlerts(undefined)).toBe(0);
  });
});

describe('sortServersByStatus', () => {
  it('sorts critical before warning before online', () => {
    const servers = [
      { status: 'online', alerts: 0 },
      { status: 'critical', alerts: 1 },
      { status: 'warning', alerts: 2 },
    ] as Server[];

    const sorted = sortServersByStatus(servers);
    expect(sorted.map((s) => s.status)).toEqual([
      'critical',
      'warning',
      'online',
    ]);
  });

  it('sorts by alerts count within same status', () => {
    const servers = [
      { status: 'warning', alerts: 1 },
      { status: 'warning', alerts: 5 },
    ] as Server[];

    const sorted = sortServersByStatus(servers);
    expect(sorted.map((s) => s.alerts)).toEqual([5, 1]);
  });
});

describe('normalizeServerData', () => {
  it('normalizes minimal object to Server', () => {
    const result = normalizeServerData({
      id: 'srv-1',
      status: 'online',
      cpu: 50,
    });
    expect(result.id).toBe('srv-1');
    expect(result.status).toBe('online');
    expect(result.cpu).toBe(50);
  });

  it('converts "healthy" status to "online"', () => {
    const result = normalizeServerData({ status: 'healthy' });
    expect(result.status).toBe('online');
  });

  it('throws for null input', () => {
    expect(() => normalizeServerData(null)).toThrow('Invalid server data');
  });

  it('throws for non-object input', () => {
    expect(() => normalizeServerData('not an object')).toThrow(
      'Invalid server data'
    );
  });

  it('uses default values for missing fields', () => {
    const result = normalizeServerData({});
    expect(result.cpu).toBe(0);
    expect(result.memory).toBe(0);
    expect(result.disk).toBe(0);
    expect(result.network).toBe(25);
  });
});
