/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('DashboardClient interactive shell loading', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('next/dynamic');
    vi.unstubAllEnvs();
    document.cookie =
      'test_mode=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('loads the dashboard runtime as a client-only dynamic component', async () => {
    vi.resetModules();
    const runtimeRenderSpy = vi.fn();

    const dynamicMock = vi.fn(
      () =>
        function MockDashboardInteractiveShell(props: {
          initialFocusServerId?: string | null;
        }) {
          runtimeRenderSpy(props);
          return React.createElement('div', {
            'data-testid': 'dashboard-interactive-shell',
            'data-initial-focus-server-id': props.initialFocusServerId ?? '',
          });
        }
    );

    vi.doMock('next/dynamic', () => ({
      default: dynamicMock,
    }));

    vi.doMock('next/navigation', () => ({
      useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
      }),
      useSearchParams: () => new URLSearchParams('serverId=web-nginx-dc1-01'),
    }));

    vi.doMock('@/hooks/use-toast', () => ({
      useToast: () => ({ toast: vi.fn() }),
    }));

    vi.doMock('@/hooks/useUserPermissions', () => ({
      useUserPermissions: () => ({
        canAccessDashboard: true,
        canToggleAI: true,
        isPinAuthenticated: false,
        userType: 'github',
      }),
    }));

    vi.doMock('@/config/guestMode', () => ({
      isGuestFullAccessEnabled: () => true,
    }));

    const { default: DashboardClient } = await import('./DashboardClient');

    render(
      React.createElement(DashboardClient, {
        initialFocusServerId: 'seed-server-01',
      })
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-interactive-shell')
      ).toBeInTheDocument();
    });

    expect(runtimeRenderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialFocusServerId: 'seed-server-01',
      })
    );
    expect(screen.getByTestId('dashboard-interactive-shell')).toHaveAttribute(
      'data-initial-focus-server-id',
      'seed-server-01'
    );
    expect(dynamicMock).toHaveBeenCalled();
    expect(
      dynamicMock.mock.calls.some(([, options]) => options?.ssr === false)
    ).toBe(true);
    expect(
      dynamicMock.mock.calls.some(
        ([, options]) => typeof options?.loading === 'function'
      )
    ).toBe(true);
  });
});
