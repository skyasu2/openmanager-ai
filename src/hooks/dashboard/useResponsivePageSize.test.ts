/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResponsivePageSize } from './useResponsivePageSize';

function setViewportWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe('useResponsivePageSize', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('현재 viewport 기준으로 초기 pageSize를 계산한다', () => {
    setViewportWidth(520);

    const { result } = renderHook(() => useResponsivePageSize(3));

    expect(result.current.pageSize).toBe(6);
  });

  it('resize 이후 debounce가 지난 뒤에만 pageSize를 갱신한다', () => {
    setViewportWidth(520);

    const { result } = renderHook(() => useResponsivePageSize(3, 150));

    expect(result.current.pageSize).toBe(6);

    act(() => {
      setViewportWidth(1440);
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current.pageSize).toBe(6);

    act(() => {
      vi.advanceTimersByTime(149);
    });

    expect(result.current.pageSize).toBe(6);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.pageSize).toBe(15);
  });

  it('unmount 시 pending resize timer를 정리한다', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    setViewportWidth(520);

    const { unmount } = renderHook(() => useResponsivePageSize(3, 150));

    act(() => {
      setViewportWidth(900);
      window.dispatchEvent(new Event('resize'));
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
