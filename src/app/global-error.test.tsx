/**
 * @vitest-environment jsdom
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loggerErrorMock = vi.fn();
const debugErrorMock = vi.fn();

vi.mock('@/lib/logging', () => ({
  logger: { error: (...args: unknown[]) => loggerErrorMock(...args) },
}));

vi.mock('@/utils/debug', () => ({
  default: { error: (...args: unknown[]) => debugErrorMock(...args) },
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => React.createElement('a', { href, className }, children),
}));

describe('GlobalError', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;

  beforeEach(() => {
    vi.resetModules();
    loggerErrorMock.mockClear();
    debugErrorMock.mockClear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.NEXT_PUBLIC_VERCEL_ENV = originalVercelEnv;
  });

  it('개발 환경에서는 외부 에러 리포팅을 보내지 않아야 한다', async () => {
    const { default: GlobalError } = await import('./global-error');
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'development';

    await act(async () => {
      render(
        React.createElement(GlobalError, {
          error: Object.assign(new Error('dev crash'), { digest: 'dev-123' }),
          reset: vi.fn(),
        })
      );
    });

    expect(loggerErrorMock).not.toHaveBeenCalled();
    expect(debugErrorMock).not.toHaveBeenCalled();
    expect(screen.getByText('개발 모드 에러 정보:')).toBeInTheDocument();
  });

  it('프로덕션 환경에서는 로컬 로깅과 reset 버튼이 동작해야 한다', async () => {
    const { default: GlobalError } = await import('./global-error');
    process.env.NODE_ENV = 'production';
    process.env.NEXT_PUBLIC_VERCEL_ENV = 'production';
    const reset = vi.fn();

    await act(async () => {
      render(
        React.createElement(GlobalError, {
          error: Object.assign(new Error('prod crash'), { digest: 'prod-123' }),
          reset,
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(loggerErrorMock).toHaveBeenCalled();
    expect(debugErrorMock).toHaveBeenCalled();
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
