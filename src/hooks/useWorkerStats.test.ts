/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkerStats } from './useWorkerStats';

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
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
});
