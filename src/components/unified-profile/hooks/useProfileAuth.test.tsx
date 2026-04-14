/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileAuth } from './useProfileAuth';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  useSession: vi.fn(),
  signOut: vi.fn(),
  getAuthState: vi.fn(),
  clearAuthData: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mocks.replace,
  }),
}));

vi.mock('@/hooks/useSupabaseSession', () => ({
  useSession: () => mocks.useSession(),
  signOut: (...args: unknown[]) => mocks.signOut(...args),
}));

vi.mock('@/lib/auth/auth-state-manager', () => ({
  authStateManager: {
    getAuthState: () => mocks.getAuthState(),
  },
  clearAuthData: (...args: unknown[]) => mocks.clearAuthData(...args),
}));

vi.mock('@/lib/logging', () => ({
  logger: mocks.logger,
}));

describe('useProfileAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );

    mocks.useSession.mockReturnValue({ status: 'authenticated' });
    mocks.getAuthState.mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Dev User',
        email: 'dev@example.com',
      },
      type: 'github',
      isAuthenticated: true,
    });
  });

  it('uses client-side routing for login and dashboard navigation helpers', async () => {
    const { result } = renderHook(() => useProfileAuth());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.navigateToLogin();
      result.current.navigateToDashboard();
    });

    expect(mocks.replace).toHaveBeenNthCalledWith(1, '/login');
    expect(mocks.replace).toHaveBeenNthCalledWith(2, '/dashboard');
  });

  it('routes to login after successful unified logout', async () => {
    mocks.clearAuthData.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProfileAuth());

    await waitFor(() => expect(result.current.userType).toBe('github'));

    let didLogout: boolean | undefined;
    await act(async () => {
      didLogout = await result.current.handleLogout();
    });

    expect(didLogout).toBe(true);
    expect(mocks.clearAuthData).toHaveBeenCalledWith('github');
    expect(mocks.replace).toHaveBeenCalledWith('/login');
  });

  it('still routes to login when logout falls back after an error', async () => {
    mocks.clearAuthData.mockRejectedValue(new Error('clear failed'));
    mocks.signOut.mockResolvedValue(undefined);

    const { result } = renderHook(() => useProfileAuth());

    await waitFor(() => expect(result.current.userType).toBe('github'));

    let didLogout: boolean | undefined;
    await act(async () => {
      didLogout = await result.current.handleLogout();
    });

    expect(didLogout).toBe(false);
    expect(mocks.signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
    expect(mocks.replace).toHaveBeenCalledWith('/login');
  });
});
