/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorPage from './error';

const captureExceptionMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

vi.mock('@/lib/logging', () => ({
  logger: { error: (...args: unknown[]) => loggerErrorMock(...args) },
}));

describe('AppErrorPage', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    captureExceptionMock.mockClear();
    loggerErrorMock.mockClear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('개발 환경에서는 외부 에러 리포팅을 보내지 않아야 한다', async () => {
    process.env.NODE_ENV = 'development';

    await act(async () => {
      render(
        <ErrorPage
          error={Object.assign(new Error('dev root crash'), {
            digest: 'root-dev-123',
          })}
          reset={vi.fn()}
        />
      );
    });

    expect(captureExceptionMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('프로덕션 환경에서는 외부 에러 리포팅과 reset 버튼이 동작해야 한다', async () => {
    process.env.NODE_ENV = 'production';
    const reset = vi.fn();

    await act(async () => {
      render(
        <ErrorPage
          error={Object.assign(new Error('prod root crash'), {
            digest: 'root-prod-123',
          })}
          reset={reset}
        />
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(captureExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'prod root crash' }),
      expect.objectContaining({
        tags: { boundary: 'root', digest: 'root-prod-123' },
      })
    );
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'prod root crash' })
    );
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
