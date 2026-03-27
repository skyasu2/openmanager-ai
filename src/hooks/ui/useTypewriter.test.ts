// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTypewriter } from './useTypewriter';

describe('useTypewriter', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders the full text immediately when animation is disabled', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useTypewriter('OpenManager', {
        enabled: false,
        onComplete,
      })
    );

    expect(result.current.displayedText).toBe('OpenManager');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.progress).toBe(100);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('animates text over time and calls onComplete once finished', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onComplete = vi.fn();

    const { result } = renderHook(() =>
      useTypewriter('abc', {
        speed: 10,
        initialDelay: 5,
        onComplete,
      })
    );

    expect(result.current.displayedText).toBe('');
    expect(result.current.isComplete).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5);
    });
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(result.current.displayedText).toBe('a');
    expect(result.current.progress).toBe(33);
    expect(result.current.isComplete).toBe(false);

    act(() => {
      vi.advanceTimersByTime(30);
    });

    expect(result.current.displayedText).toBe('abc');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.progress).toBe(100);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('completes immediately when complete is called', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const { result } = renderHook(() =>
      useTypewriter('typewriter', {
        speed: 10,
      })
    );

    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(result.current.displayedText).toBe('t');
    expect(result.current.isComplete).toBe(false);

    act(() => {
      result.current.complete();
    });

    expect(result.current.displayedText).toBe('typewriter');
    expect(result.current.isComplete).toBe(true);
    expect(result.current.progress).toBe(100);
  });
});
