/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const routerPush = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

describe('DashboardClientRuntime auth boundary', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('redirects anonymous users without leaving the dashboard in auth loading', async () => {
    vi.doMock('next/dynamic', () => ({
      default: () =>
        function MockDashboardInteractiveShell() {
          return React.createElement('div', {
            'data-testid': 'dashboard-interactive-shell',
          });
        },
    }));

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({
        push: routerPush,
        replace: vi.fn(),
      }),
      useSearchParams: () => new URLSearchParams(),
    }));

    vi.doMock('react-hot-toast', () => ({
      default: Object.assign(vi.fn(), {
        error: toastError,
        success: vi.fn(),
      }),
    }));

    vi.doMock('@/hooks/useUserPermissions', () => ({
      useUserPermissions: () => ({
        canAccessDashboard: false,
        canToggleAI: true,
        isPinAuthenticated: false,
        userType: 'anonymous',
      }),
    }));

    vi.doMock('@/config/guestMode', () => ({
      isGuestFullAccessEnabled: () => false,
    }));

    const { default: DashboardClientRuntime } = await import(
      './DashboardClientRuntime'
    );

    render(React.createElement(DashboardClientRuntime));

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith('/');
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole('status', { name: /권한을 확인하고 있습니다/ })
    ).not.toBeInTheDocument();
    expect(screen.getByText('접근 권한 필요')).toBeInTheDocument();
  });
});
