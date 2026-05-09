/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionCountdown } from './SessionCountdown';

const storeMock = vi.hoisted(() => ({
  isSystemStarted: true,
  remainingTime: 10 * 60 * 1000,
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: <T,>(selector: T) => selector,
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: <T,>(
    selector: (state: {
      isSystemStarted: boolean;
      getSystemRemainingTime: () => number;
    }) => T
  ) =>
    selector({
      isSystemStarted: storeMock.isSystemStarted,
      getSystemRemainingTime: () => storeMock.remainingTime,
    }),
}));

describe('SessionCountdown', () => {
  beforeEach(() => {
    storeMock.isSystemStarted = true;
    storeMock.remainingTime = 10 * 60 * 1000;
  });

  it('시스템이 시작되지 않았으면 타이머를 렌더링하지 않는다', () => {
    storeMock.isSystemStarted = false;

    render(<SessionCountdown />);

    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('일반 상태에서는 선명한 정상 톤과 남은 시간을 표시한다', async () => {
    render(<SessionCountdown />);

    const timer = await screen.findByRole('timer', {
      name: '세션 정상: 10:00',
    });

    expect(timer).toHaveClass('border-emerald-300');
    expect(timer).toHaveClass('bg-emerald-50');
    expect(timer).toHaveTextContent('10:00');
    expect(timer).toHaveTextContent('남음');
  });

  it('5분 이하에서는 경고 톤으로 전환한다', async () => {
    storeMock.remainingTime = 4 * 60 * 1000 + 59 * 1000;

    render(<SessionCountdown />);

    const timer = await screen.findByRole('timer', {
      name: '세션 만료 주의: 04:59',
    });

    expect(timer).toHaveClass('border-amber-300');
    expect(timer).toHaveClass('bg-amber-50');
    expect(timer).not.toHaveClass('animate-wiggle');
    expect(timer).toHaveAttribute('aria-live', 'off');
    expect(timer).toHaveTextContent('주의');
  });

  it('30초 이하에서는 만료 임박 상태를 시각적/접근성 라벨로 노출한다', async () => {
    storeMock.remainingTime = 29 * 1000;

    render(<SessionCountdown />);

    const timer = await screen.findByRole('timer', {
      name: '세션 만료 임박: 00:29',
    });

    expect(timer).toHaveClass('border-red-400');
    expect(timer).toHaveClass('bg-red-50');
    expect(timer).toHaveClass('ring-red-200');
    expect(timer).toHaveClass('animate-wiggle');
    expect(timer).toHaveAttribute('aria-live', 'off');
    expect(screen.getByText('세션 만료 임박')).toHaveAttribute(
      'aria-live',
      'polite'
    );
    expect(timer).toHaveTextContent('임박');
  });
});
