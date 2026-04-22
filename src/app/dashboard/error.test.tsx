/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('@/utils/security/csrf-client', () => ({
  createCSRFHeaders: vi.fn(async (headers: Record<string, string>) => headers),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('DashboardError', () => {
  beforeEach(() => {
    vi.resetModules();
    replaceMock.mockReset();
  });

  it('navigates home with client-side routing', async () => {
    const { default: DashboardError } = await import('./error');
    render(
      React.createElement(DashboardError, {
        error: new Error('network timeout'),
        reset: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '홈으로 돌아가기' }));

    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('navigates to safe mode with client-side routing', async () => {
    const { default: DashboardError } = await import('./error');
    render(
      React.createElement(DashboardError, {
        error: new Error('permission denied'),
        reset: vi.fn(),
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '안전 모드로 접속' }));

    expect(replaceMock).toHaveBeenCalledWith(
      '/dashboard?instant=true&safe=true'
    );
  });

  it('keeps the retry action wired to reset', async () => {
    const { default: DashboardError } = await import('./error');
    const resetMock = vi.fn();

    render(
      React.createElement(DashboardError, {
        error: new Error('fetch failed'),
        reset: resetMock,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(resetMock).toHaveBeenCalledTimes(1);
  });
});
