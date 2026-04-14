/**
 * @vitest-environment jsdom
 */

import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamingWarmupIndicator } from './StreamingWarmupIndicator';

describe('StreamingWarmupIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('resets elapsed time when estimated wait changes during reuse', () => {
    const { rerender } = render(
      <StreamingWarmupIndicator estimatedWaitSeconds={60} />
    );

    act(() => {
      vi.advanceTimersByTime(2200);
    });

    expect(screen.getByText('2초')).toBeInTheDocument();

    rerender(<StreamingWarmupIndicator estimatedWaitSeconds={10} />);

    expect(screen.getByText('0초')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('1초')).toBeInTheDocument();
  });
});
