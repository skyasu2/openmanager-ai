/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerErrorMock = vi.fn();

vi.mock('@/lib/logging', () => ({
  logger: { error: (...args: unknown[]) => loggerErrorMock(...args) },
}));

describe('AuthError', () => {
  beforeEach(() => {
    vi.resetModules();
    loggerErrorMock.mockClear();
  });

  it('인증 에러를 로깅하고 복구 액션을 제공한다', async () => {
    const { default: AuthError } = await import('./error');
    const reset = vi.fn();

    await act(async () => {
      render(
        React.createElement(AuthError, {
          error: Object.assign(new Error('auth crash'), {
            digest: 'auth-123',
          }),
          reset,
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'auth crash' })
    );
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: '로그인으로' })).toHaveAttribute(
      'href',
      '/login'
    );
  });

  it('Tailwind 클래스 기반 에러 화면을 렌더링한다', async () => {
    const { default: AuthError } = await import('./error');

    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(
        React.createElement(AuthError, {
          error: Object.assign(new Error('styled auth crash'), {
            digest: 'auth-style-123',
          }),
          reset: vi.fn(),
        })
      );
    });

    const boundary = screen.getByTestId('auth-error-boundary');
    expect(boundary).toHaveClass('min-h-screen');
    expect(boundary).toHaveClass('bg-slate-950');
    expect(rendered.container.querySelector('[style]')).toBeNull();
  });
});
