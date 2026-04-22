/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types';
import { useWorkerStats } from './useWorkerStats';

const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock('@/lib/logging', () => ({
  logger: loggerMock,
}));

class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
}

describe('useWorkerStats', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restartWorker는 대기 중인 작업을 reject하고 정리한다', async () => {
    const { result } = renderHook(() => useWorkerStats());

    expect(result.current.isWorkerReady()).toBe(true);

    let pendingPromise!: Promise<unknown>;
    act(() => {
      pendingPromise = result.current.calculatePagination(10, 1, 5);
    });

    expect(result.current.pendingOperations).toBe(1);

    act(() => {
      result.current.restartWorker();
    });

    expect(result.current.pendingOperations).toBe(0);
    await expect(pendingPromise).rejects.toThrow('Worker restarted');
  });

  it('unmount 시 대기 중인 작업을 reject한다', async () => {
    const { result, unmount } = renderHook(() => useWorkerStats());

    let pendingPromise!: Promise<unknown>;
    act(() => {
      pendingPromise = result.current.calculatePagination(20, 2, 10);
    });

    unmount();

    await expect(pendingPromise).rejects.toThrow('Worker terminated');
  });

  it('unmount로 worker가 종료되면 stats 계산은 fallback으로 복구하고 error 로그를 남기지 않는다', async () => {
    const { result, unmount } = renderHook(() => useWorkerStats());
    const servers: EnhancedServerData[] = [
      {
        id: 'server-1',
        name: 'server-1',
        status: 'online',
        cpu: 20,
        memory: 40,
        uptime: 120,
        type: 'web',
      },
    ];

    let pendingPromise!: Promise<unknown>;
    act(() => {
      pendingPromise = result.current.calculateStats(servers);
    });

    unmount();

    await expect(pendingPromise).resolves.toMatchObject({
      total: 1,
      online: 1,
      averageCpu: 20,
      averageMemory: 40,
    });
    expect(loggerMock.error).not.toHaveBeenCalled();
    expect(loggerMock.debug).toHaveBeenCalledWith(
      'ℹ️ Worker lifecycle interruption during stats calculation, using sync fallback:',
      'Worker terminated'
    );
  });
});
