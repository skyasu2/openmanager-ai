/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColdStartErrorBanner } from './ColdStartErrorBanner';

describe('ColdStartErrorBanner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows rate-limit source and disables retry until countdown ends', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();

    render(
      <ColdStartErrorBanner
        error="요청이 너무 많습니다. 5초 후 다시 시도해주세요."
        errorDetails={{
          kind: 'rate-limit',
          message: '요청이 너무 많습니다. 5초 후 다시 시도해주세요.',
          source: 'frontend-gateway',
          scope: 'minute',
          retryAfterSeconds: 5,
          remaining: 0,
        }}
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('요청이 잠시 몰렸습니다')).toBeInTheDocument();
    expect(screen.getByText(/차단 위치: frontend gateway/)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: '재시도' });
    expect(retryButton).toBeDisabled();

    for (let i = 0; i < 5; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(retryButton).not.toBeDisabled();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('hides retry button for daily limit errors', () => {
    render(
      <ColdStartErrorBanner
        error="오늘 AI 요청 한도가 소진되었습니다. 내일 다시 시도해주세요."
        errorDetails={{
          kind: 'rate-limit',
          message:
            '오늘 AI 요청 한도가 소진되었습니다. 내일 다시 시도해주세요.',
          source: 'frontend-gateway',
          scope: 'daily',
          dailyLimitExceeded: true,
        }}
      />
    );

    expect(
      screen.getByText('오늘 AI 요청 한도가 소진되었습니다')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '재시도' })
    ).not.toBeInTheDocument();
  });

  it('shows upstream provider title when provider-named rate limit is inferred from plain error', () => {
    vi.useFakeTimers();

    render(
      <ColdStartErrorBanner error="Groq 요청 제한으로 12초 후 다시 시도해주세요." />
    );

    expect(
      screen.getByText('AI 제공자 요청 제한이 발생했습니다')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/차단 위치: upstream provider/)
    ).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: '재시도' });
    expect(retryButton).toBeDisabled();
  });

  it('allows auth-related errors to be dismissed explicitly', () => {
    const onClearError = vi.fn();

    render(
      <ColdStartErrorBanner
        error="401 Unauthorized"
        onClearError={onClearError}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    expect(onClearError).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('dismisses cold start errors and stops pending auto-retry', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const onClearError = vi.fn();

    render(
      <ColdStartErrorBanner
        error="504 timeout while waking Cloud Run"
        onRetry={onRetry}
        onClearError={onClearError}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));

    act(() => {
      vi.advanceTimersByTime(16_000);
    });

    expect(onClearError).toHaveBeenCalledOnce();
    expect(onRetry).not.toHaveBeenCalled();
  });
});
