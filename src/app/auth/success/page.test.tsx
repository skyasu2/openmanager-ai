/**
 * @vitest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replaceMock = vi.fn();
const getUserMock = vi.fn();
const debugWarnMock = vi.fn();
const debugErrorMock = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    replace: replaceMock,
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => currentSearchParams),
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
}));

vi.mock('@/utils/debug', () => ({
  default: {
    warn: (...args: unknown[]) => debugWarnMock(...args),
    error: (...args: unknown[]) => debugErrorMock(...args),
  },
}));

describe('AuthSuccessPage', () => {
  beforeEach(() => {
    vi.resetModules();
    currentSearchParams = new URLSearchParams();
    replaceMock.mockReset();
    getUserMock.mockReset();
    debugWarnMock.mockReset();
    debugErrorMock.mockReset();
    sessionStorage.clear();
  });

  it('레거시 code 콜백 위임 시 저장된 redirect 경로를 next로 승계해야 한다', async () => {
    const { default: AuthSuccessPage } = await import('./page');
    currentSearchParams = new URLSearchParams('code=test-code');
    sessionStorage.setItem('auth_redirect_to', '/dashboard?tab=ai#section-1');

    render(React.createElement(AuthSuccessPage));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith(
        '/auth/callback?code=test-code&next=%2Fdashboard%3Ftab%3Dai%23section-1'
      );
    });

    expect(sessionStorage.getItem('auth_redirect_to')).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it('허용되지 않는 redirect는 레거시 code 콜백 위임 시 next로 넘기지 않아야 한다', async () => {
    const { default: AuthSuccessPage } = await import('./page');
    currentSearchParams = new URLSearchParams('code=test-code');
    sessionStorage.setItem('auth_redirect_to', 'https://evil.example/phish');

    render(React.createElement(AuthSuccessPage));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/auth/callback?code=test-code');
    });

    expect(sessionStorage.getItem('auth_redirect_to')).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });
});
