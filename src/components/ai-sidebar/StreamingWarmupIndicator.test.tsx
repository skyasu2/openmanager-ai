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

    expect(screen.getByText('약 60초 남음')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2200);
    });

    expect(screen.getByText('약 58초 남음')).toBeInTheDocument();

    act(() => {
      rerender(<StreamingWarmupIndicator estimatedWaitSeconds={10} />);
    });

    expect(screen.getByText('약 10초 남음')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('약 9초 남음')).toBeInTheDocument();
  });

  it('switches to an almost-ready status when the countdown reaches zero', () => {
    render(<StreamingWarmupIndicator estimatedWaitSeconds={3} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuemax',
      '3'
    );
    expect(screen.getByText('약 3초 남음')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3200);
    });

    expect(screen.getByText('거의 다 됐습니다')).toBeInTheDocument();
  });
});
