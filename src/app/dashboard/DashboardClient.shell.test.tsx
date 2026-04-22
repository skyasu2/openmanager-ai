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

  it('loads the interactive dashboard shell as a client-only dynamic component', async () => {
    vi.resetModules();

    const dynamicMock = vi.fn(
      () =>
        function MockDashboardInteractiveShell(props: {
          initialFocusServerId?: string | null;
        }) {
          return React.createElement(
            'div',
            { 'data-testid': 'dashboard-interactive-shell' },
            props.initialFocusServerId
          );
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

    document.cookie = 'test_mode=enabled; path=/';

    const { default: DashboardClient } = await import('./DashboardClient');

    render(React.createElement(DashboardClient));

    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-interactive-shell')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('web-nginx-dc1-01')).toBeInTheDocument();
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
