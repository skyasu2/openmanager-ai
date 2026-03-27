import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrackedTimeoutScheduler } from './timeout-scheduler';

describe('createTrackedTimeoutScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('clearAll이 중첩 타이머까지 모두 정리한다', () => {
    const scheduler = createTrackedTimeoutScheduler();
    const nestedCallback = vi.fn();

    scheduler.schedule(() => {
      scheduler.schedule(nestedCallback, 200);
    }, 100);

    vi.advanceTimersByTime(100);
    expect(scheduler.getPendingCount()).toBe(1);

    scheduler.clearAll();
    vi.advanceTimersByTime(200);

    expect(nestedCallback).not.toHaveBeenCalled();
    expect(scheduler.getPendingCount()).toBe(0);
  });

  it('실행이 끝난 타이머는 추적 목록에서 제거한다', () => {
    const scheduler = createTrackedTimeoutScheduler();
    const callback = vi.fn();

    scheduler.schedule(callback, 100);

    expect(scheduler.getPendingCount()).toBe(1);

    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(scheduler.getPendingCount()).toBe(0);
  });
});
