/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { HybridQueryState, QueryMode } from '../types/hybrid-query.types';
import type { QueryControlDeps } from './useQueryControls';
import { useQueryControls } from './useQueryControls';

function createTestContext() {
  let latestState: HybridQueryState = {
    mode: 'streaming',
    complexity: null,
    progress: {
      stage: 'processing',
      progress: 52,
      message: '진행 중',
    },
    jobId: 'job-123',
    isLoading: true,
    error: null,
    clarification: {
      originalQuery: '테스트 쿼리',
      options: [],
      reason: '테스트',
    },
    warning: null,
    processingTime: 0,
  };

  const asyncCancel = vi.fn().mockResolvedValue(undefined);
  const asyncReset = vi.fn();
  const stopChat = vi.fn();
  const onUserAbort = vi.fn();
  const setMessages = vi.fn();

  const setStateMock = vi.fn(
    (updater: React.SetStateAction<HybridQueryState>) => {
      latestState =
        typeof updater === 'function'
          ? (updater as (prev: HybridQueryState) => HybridQueryState)(
              latestState
            )
          : updater;
    }
  );

  const refs: QueryControlDeps['refs'] = {
    abortController: { current: null },
    retryTimeout: { current: null },
    retryCount: { current: 0 },
    traceId: { current: 'trace-1' },
    pendingQuery: { current: null },
    pendingAttachments: { current: null },
    currentQuery: { current: null },
  };

  const createDeps = (mode: QueryMode): QueryControlDeps => ({
    currentMode: mode,
    asyncQuery: {
      cancel: asyncCancel,
      reset: asyncReset,
    },
    stopChat,
    onUserAbort,
    setMessages,
    setState: setStateMock as unknown as React.Dispatch<
      React.SetStateAction<HybridQueryState>
    >,
    refs,
  });

  return {
    createDeps,
    asyncCancel,
    stopChat,
    onUserAbort,
    getState: () => latestState,
  };
}

describe('useQueryControls.stop', () => {
  it('streaming 모드에서는 스트림 중단만 수행한다', () => {
    const context = createTestContext();
    const { result } = renderHook(() =>
      useQueryControls(context.createDeps('streaming'))
    );

    act(() => {
      result.current.stop();
    });

    expect(context.asyncCancel).not.toHaveBeenCalled();
    expect(context.onUserAbort).toHaveBeenCalledTimes(1);
    expect(context.stopChat).toHaveBeenCalledTimes(1);
    expect(context.getState().isLoading).toBe(false);
    expect(context.getState().progress).toBeNull();
    expect(context.getState().jobId).toBeNull();
    expect(context.getState().clarification).toBeNull();
  });

  it('job-queue 모드에서는 async cancel을 실행한다', async () => {
    const context = createTestContext();
    const { result } = renderHook(() =>
      useQueryControls(context.createDeps('job-queue'))
    );

    act(() => {
      result.current.stop();
    });

    await Promise.resolve();

    expect(context.asyncCancel).toHaveBeenCalledTimes(1);
    expect(context.onUserAbort).not.toHaveBeenCalled();
    expect(context.stopChat).not.toHaveBeenCalled();
    expect(context.getState().isLoading).toBe(false);
    expect(context.getState().progress).toBeNull();
    expect(context.getState().jobId).toBeNull();
    expect(context.getState().clarification).toBeNull();
  });

  it('모드 변경 이후 기존 stop 참조도 최신 모드를 사용한다', async () => {
    const context = createTestContext();
    const { result, rerender } = renderHook(
      ({ mode }: { mode: QueryMode }) =>
        useQueryControls(context.createDeps(mode)),
      {
        initialProps: { mode: 'streaming' as QueryMode },
      }
    );

    const staleStopReference = result.current.stop;

    rerender({ mode: 'job-queue' as QueryMode });

    act(() => {
      staleStopReference();
    });

    await Promise.resolve();

    expect(context.asyncCancel).toHaveBeenCalledTimes(1);
    expect(context.stopChat).not.toHaveBeenCalled();
  });
});
