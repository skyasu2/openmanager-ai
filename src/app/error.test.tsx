/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerErrorMock = vi.fn();

vi.mock('@/lib/logging', () => ({
  logger: { error: (...args: unknown[]) => loggerErrorMock(...args) },
}));

describe('AppErrorPage', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    loggerErrorMock.mockClear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('개발 환경에서는 외부 에러 리포팅을 보내지 않아야 한다', async () => {
    const { default: ErrorPage } = await import('./error');
    process.env.NODE_ENV = 'development';

    await act(async () => {
      render(
        React.createElement(ErrorPage, {
          error: Object.assign(new Error('dev root crash'), {
            digest: 'root-dev-123',
          }),
          reset: vi.fn(),
        })
      );
    });

    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('프로덕션 환경에서는 로컬 로깅과 reset 버튼이 동작해야 한다', async () => {
    const { default: ErrorPage } = await import('./error');
    process.env.NODE_ENV = 'production';
    const reset = vi.fn();

    await act(async () => {
      render(
        React.createElement(ErrorPage, {
          error: Object.assign(new Error('prod root crash'), {
            digest: 'root-prod-123',
          }),
          reset,
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'prod root crash' })
    );
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('Tailwind 클래스 기반 에러 화면을 렌더링한다', async () => {
    const { default: ErrorPage } = await import('./error');
    process.env.NODE_ENV = 'development';

    let rendered!: ReturnType<typeof render>;
    await act(async () => {
      rendered = render(
        React.createElement(ErrorPage, {
          error: Object.assign(new Error('styled root crash'), {
            digest: 'root-style-123',
          }),
          reset: vi.fn(),
        })
      );
    });

    const boundary = screen.getByTestId('app-error-boundary');
    expect(boundary).toHaveClass('min-h-screen');
    expect(boundary).toHaveClass('bg-slate-950');
    expect(rendered.container.querySelector('[style]')).toBeNull();
  });
});
