/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScrollSentinel } from './useScrollSentinel';

type ObserverCallback = IntersectionObserverCallback;

const observers: Array<{
  callback: ObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  options?: IntersectionObserverInit;
}> = [];

class MockIntersectionObserver {
  readonly callback: ObserverCallback;
  readonly options?: IntersectionObserverInit;
  readonly observe = vi.fn();
  readonly disconnect = vi.fn();

  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    observers.push(this);
  }
}

function ScrollSentinelProbe({
  enabled,
  onIntersect,
}: {
  enabled: boolean;
  onIntersect: () => void;
}) {
  const sentinelRef = useScrollSentinel(onIntersect, enabled);

  return <div ref={sentinelRef} data-testid="scroll-sentinel" />;
}

describe('useScrollSentinel', () => {
  const originalIntersectionObserver = globalThis.IntersectionObserver;

  beforeEach(() => {
    observers.length = 0;
    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver;
  });

  it('sentinel이 교차하면 콜백을 실행하고 observer를 해제한다', () => {
    const onIntersect = vi.fn();
    render(<ScrollSentinelProbe enabled onIntersect={onIntersect} />);

    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledWith(
      screen.getByTestId('scroll-sentinel')
    );

    observers[0].callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observers[0] as unknown as IntersectionObserver
    );

    expect(onIntersect).toHaveBeenCalledTimes(1);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('enabled=false이면 observer를 만들지 않는다', () => {
    const onIntersect = vi.fn();
    render(<ScrollSentinelProbe enabled={false} onIntersect={onIntersect} />);

    expect(observers).toHaveLength(0);
  });

  it('sentinel이 교차하지 않으면 콜백을 실행하지 않는다', () => {
    const onIntersect = vi.fn();
    render(<ScrollSentinelProbe enabled onIntersect={onIntersect} />);

    observers[0].callback(
      [{ isIntersecting: false } as IntersectionObserverEntry],
      observers[0] as unknown as IntersectionObserver
    );

    expect(onIntersect).not.toHaveBeenCalled();
    expect(observers[0].disconnect).not.toHaveBeenCalled();
  });

  it('unmount 시 observer를 disconnect한다', () => {
    const onIntersect = vi.fn();
    const { unmount } = render(
      <ScrollSentinelProbe enabled onIntersect={onIntersect} />
    );

    unmount();

    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
