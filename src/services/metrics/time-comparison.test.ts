import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCalculateRelativeDateTime, mockGetMetricsAtTime } = vi.hoisted(() => ({
  mockCalculateRelativeDateTime: vi.fn(),
  mockGetMetricsAtTime: vi.fn(),
}));

vi.mock('./kst-time', () => ({
  calculateRelativeDateTime: mockCalculateRelativeDateTime,
}));

vi.mock('./MetricsProvider', () => ({
  MetricsProvider: {
    getInstance: () => ({
      getMetricsAtTime: mockGetMetricsAtTime,
    }),
  },
}));

import { compareServerMetrics, getMetricsAtRelativeTime } from './time-comparison';

function createMockMetrics(overrides = {}) {
  return {
    serverId: 'server-1',
    serverType: 'web',
    location: 'seoul',
    timestamp: '2026-03-06T01:00:00+09:00',
    minuteOfDay: 60,
    cpu: 50,
    memory: 60,
    disk: 40,
    network: 10,
    logs: [],
    status: 'online' as const,
    ...overrides,
  };
}

function setupRelativeDateTime(minutesAgo: number, overrides = {}) {
  const defaults = {
    date: '2026-03-06',
    slotIndex: 6,
    timestamp: '2026-03-06T01:00:00+09:00',
    isYesterday: false,
  };
  mockCalculateRelativeDateTime.mockImplementation((mins: number) => {
    if (mins === minutesAgo) return { ...defaults, ...overrides };
    return defaults;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMetricsAtRelativeTime', () => {
  it('returns metrics with dateLabel and isYesterday=false', async () => {
    setupRelativeDateTime(0);
    mockGetMetricsAtTime.mockResolvedValue(createMockMetrics());

    const result = await getMetricsAtRelativeTime('server-1', 0);

    expect(result).not.toBeNull();
    expect(result!.dateLabel).toBe('2026-03-06');
    expect(result!.isYesterday).toBe(false);
  });

  it("appends ' (어제)' to dateLabel when isYesterday=true", async () => {
    setupRelativeDateTime(1440, {
      date: '2026-03-05',
      slotIndex: 6,
      timestamp: '2026-03-05T01:00:00+09:00',
      isYesterday: true,
    });
    mockGetMetricsAtTime.mockResolvedValue(createMockMetrics());

    const result = await getMetricsAtRelativeTime('server-1', 1440);

    expect(result).not.toBeNull();
    expect(result!.dateLabel).toBe('2026-03-05 (어제)');
    expect(result!.isYesterday).toBe(true);
  });

  it('returns null when provider returns null', async () => {
    setupRelativeDateTime(0);
    mockGetMetricsAtTime.mockResolvedValue(null);

    const result = await getMetricsAtRelativeTime('server-1', 0);

    expect(result).toBeNull();
  });

  it('passes correct minuteOfDay (slotIndex * 10)', async () => {
    setupRelativeDateTime(0, { slotIndex: 9 });
    mockGetMetricsAtTime.mockResolvedValue(createMockMetrics());

    await getMetricsAtRelativeTime('server-1', 0);

    expect(mockGetMetricsAtTime).toHaveBeenCalledWith('server-1', 90);
  });

  it('includes timestamp and minuteOfDay in result', async () => {
    setupRelativeDateTime(0, { slotIndex: 12 });
    mockGetMetricsAtTime.mockResolvedValue(createMockMetrics());

    const result = await getMetricsAtRelativeTime('server-1', 0);

    expect(result).not.toBeNull();
    expect(result!.timestamp).toBe('2026-03-06T01:00:00+09:00');
    expect(result!.minuteOfDay).toBe(120);
  });
});

describe('compareServerMetrics', () => {
  it('returns delta with correct rounding (1 decimal)', async () => {
    // current: mins=0, past: mins=60
    mockCalculateRelativeDateTime.mockImplementation((mins: number) => {
      if (mins === 0) {
        return {
          date: '2026-03-06',
          slotIndex: 6,
          timestamp: '2026-03-06T01:00:00+09:00',
          isYesterday: false,
        };
      }
      return {
        date: '2026-03-06',
        slotIndex: 0,
        timestamp: '2026-03-06T00:00:00+09:00',
        isYesterday: false,
      };
    });
    mockGetMetricsAtTime.mockImplementation((_id: string, minuteOfDay: number) => {
      if (minuteOfDay === 60) {
        return Promise.resolve(createMockMetrics({ cpu: 55.55, memory: 62.33, disk: 41.17, network: 12.89 }));
      }
      return Promise.resolve(createMockMetrics({ cpu: 50.11, memory: 60.11, disk: 40.11, network: 10.11 }));
    });

    const result = await compareServerMetrics('server-1', 60);

    expect(result).not.toBeNull();
    expect(result!.delta.cpu).toBe(5.4);
    expect(result!.delta.memory).toBe(2.2);
    expect(result!.delta.disk).toBe(1.1);
    expect(result!.delta.network).toBe(2.8);
  });

  it('returns null when current metrics are null', async () => {
    mockCalculateRelativeDateTime.mockReturnValue({
      date: '2026-03-06',
      slotIndex: 6,
      timestamp: '2026-03-06T01:00:00+09:00',
      isYesterday: false,
    });
    mockGetMetricsAtTime.mockResolvedValue(null);

    const result = await compareServerMetrics('server-1', 60);

    expect(result).toBeNull();
  });

  it('returns null when past metrics are null', async () => {
    mockCalculateRelativeDateTime.mockImplementation((mins: number) => ({
      date: '2026-03-06',
      slotIndex: mins === 0 ? 6 : 0,
      timestamp: '2026-03-06T01:00:00+09:00',
      isYesterday: false,
    }));
    mockGetMetricsAtTime.mockImplementation((_id: string, minuteOfDay: number) => {
      if (minuteOfDay === 60) return Promise.resolve(createMockMetrics());
      return Promise.resolve(null);
    });

    const result = await compareServerMetrics('server-1', 60);

    expect(result).toBeNull();
  });

  it('handles negative deltas correctly', async () => {
    mockCalculateRelativeDateTime.mockImplementation((mins: number) => ({
      date: '2026-03-06',
      slotIndex: mins === 0 ? 6 : 0,
      timestamp: '2026-03-06T01:00:00+09:00',
      isYesterday: false,
    }));
    mockGetMetricsAtTime.mockImplementation((_id: string, minuteOfDay: number) => {
      if (minuteOfDay === 60) {
        return Promise.resolve(createMockMetrics({ cpu: 30, memory: 40, disk: 20, network: 5 }));
      }
      return Promise.resolve(createMockMetrics({ cpu: 50, memory: 60, disk: 40, network: 10 }));
    });

    const result = await compareServerMetrics('server-1', 60);

    expect(result).not.toBeNull();
    expect(result!.delta.cpu).toBe(-20);
    expect(result!.delta.memory).toBe(-20);
    expect(result!.delta.disk).toBe(-20);
    expect(result!.delta.network).toBe(-5);
  });

  it('includes current and past with timestamps', async () => {
    mockCalculateRelativeDateTime.mockImplementation((mins: number) => {
      if (mins === 0) {
        return {
          date: '2026-03-06',
          slotIndex: 6,
          timestamp: '2026-03-06T01:00:00+09:00',
          isYesterday: false,
        };
      }
      return {
        date: '2026-03-05',
        slotIndex: 6,
        timestamp: '2026-03-05T01:00:00+09:00',
        isYesterday: true,
      };
    });
    mockGetMetricsAtTime.mockResolvedValue(createMockMetrics());

    const result = await compareServerMetrics('server-1', 1440);

    expect(result).not.toBeNull();
    expect(result!.current.timestamp).toBe('2026-03-06T01:00:00+09:00');
    expect(result!.current.date).toBe('2026-03-06');
    expect(result!.past.timestamp).toBe('2026-03-05T01:00:00+09:00');
    expect(result!.past.date).toBe('2026-03-05 (어제)');
    expect(result!.current.metrics).toBeDefined();
    expect(result!.past.metrics).toBeDefined();
  });
});
