/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types';
import { useServerStats } from './useServerStats';

const {
  calculateStatsWorkerMock,
  isWorkerReadyMock,
  adaptWorkerStatsToLegacyMock,
  calculateServerStatsMock,
} = vi.hoisted(() => ({
  calculateStatsWorkerMock: vi.fn(),
  isWorkerReadyMock: vi.fn(() => true),
  adaptWorkerStatsToLegacyMock: vi.fn((workerStats: { total?: number }) => ({
    total: workerStats.total ?? 0,
    online: workerStats.total ?? 0,
    unknown: 0,
    warning: 0,
    critical: 0,
    avgCpu: 0,
    avgMemory: 0,
    avgDisk: 0,
  })),
  calculateServerStatsMock: vi.fn((servers: EnhancedServerData[]) => ({
    total: servers.length,
    online: servers.length,
    unknown: 0,
    warning: 0,
    critical: 0,
    avgCpu: 0,
    avgMemory: 0,
    avgDisk: 0,
  })),
}));

vi.mock('../useWorkerStats', () => ({
  useWorkerStats: () => ({
    calculateStats: calculateStatsWorkerMock,
    isWorkerReady: isWorkerReadyMock,
  }),
}));

vi.mock('@/utils/dashboard/server-utils', () => ({
  adaptWorkerStatsToLegacy: adaptWorkerStatsToLegacyMock,
  calculateServerStats: calculateServerStatsMock,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
  },
}));

function createServers(count: number): EnhancedServerData[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `server-${index}`,
    name: `server-${index}`,
    status: 'online',
    cpu: 10,
    memory: 20,
    disk: 30,
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('useServerStats', () => {
  beforeEach(() => {
    calculateStatsWorkerMock.mockReset();
    calculateServerStatsMock.mockClear();
    adaptWorkerStatsToLegacyMock.mockClear();
    isWorkerReadyMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('늦게 도착한 이전 worker 결과가 최신 서버 통계를 덮어쓰지 않는다', async () => {
    const firstRequest = deferred<{ total: number }>();
    const secondRequest = deferred<{ total: number }>();

    calculateStatsWorkerMock
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const firstServers = createServers(10);
    const secondServers = createServers(12);

    const { result, rerender } = renderHook(
      ({ servers }) => useServerStats(servers),
      {
        initialProps: { servers: firstServers },
      }
    );

    expect(result.current.isCalculatingStats).toBe(true);

    rerender({ servers: secondServers });

    await act(async () => {
      firstRequest.resolve({ total: 10 });
      await Promise.resolve();
    });

    expect(result.current.stats.total).toBe(12);

    await act(async () => {
      secondRequest.resolve({ total: 120 });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.stats.total).toBe(120);
      expect(result.current.isCalculatingStats).toBe(false);
    });
  });

  it('서버가 없으면 즉시 빈 통계를 반환한다', () => {
    const { result } = renderHook(() => useServerStats([]));

    expect(result.current.stats).toEqual({
      total: 0,
      online: 0,
      unknown: 0,
      warning: 0,
      critical: 0,
      avgCpu: 0,
      avgMemory: 0,
      avgDisk: 0,
    });
    expect(result.current.isCalculatingStats).toBe(false);
  });
});
