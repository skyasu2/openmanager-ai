/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startSystem = vi.fn();
const triggerAIWarmup = vi.fn().mockResolvedValue(undefined);
const ensureDataLoaded = vi.fn().mockResolvedValue(undefined);
const debugLog = vi.fn();
const debugError = vi.fn();
const mockAIEntryController = vi.hoisted(() => ({
  isOpen: false,
  toggleSidebar: vi.fn(),
  closeSidebar: vi.fn(),
  openWithPrefill: vi.fn(),
}));

vi.mock('next/dynamic', () => ({
  default: (
    _loader: unknown,
    options?: { loading?: () => React.ReactNode }
  ) => {
    function MockDynamicComponent() {
      return React.createElement(
        React.Fragment,
        null,
        options?.loading ? options.loading() : null
      );
    }

    return MockDynamicComponent;
  },
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) =>
    React.createElement(
      'a',
      {
        href,
        ...props,
      },
      children
    ),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/hooks/ai/useAIEntryController', () => ({
  useAIEntryController: () => mockAIEntryController,
}));

vi.mock('@/hooks/useAutoLogout', () => ({
  useAutoLogout: () => ({
    remainingTime: 600,
    isWarning: false,
    resetTimer: vi.fn(),
    forceLogout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useServerDashboard', () => ({
  useServerDashboard: () => ({
    paginatedServers: [],
    servers: [],
    filteredTotal: 0,
    currentPage: 1,
    totalPages: 1,
    pageSize: 9,
    setCurrentPage: vi.fn(),
    changePageSize: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSystemAutoShutdown', () => ({
  useSystemAutoShutdown: vi.fn(),
}));

vi.mock('@/services/metrics/MetricsProvider', () => ({
  metricsProvider: {
    ensureDataLoaded,
  },
}));

vi.mock('@/services/system/SystemInactivityService', () => ({
  systemInactivityService: {
    pauseSystem: vi.fn(),
    resumeSystem: vi.fn(),
  },
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: (selector: (state: unknown) => unknown) =>
    selector({
      isSystemStarted: false,
      startSystem,
    }),
}));

vi.mock('@/utils/ai-warmup', () => ({
  triggerAIWarmup,
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: debugLog,
    error: debugError,
  },
}));

describe('DashboardInteractiveShell', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    startSystem.mockClear();
    triggerAIWarmup.mockClear();
    ensureDataLoaded.mockClear();
    debugLog.mockClear();
    debugError.mockClear();
    mockAIEntryController.isOpen = false;
    mockAIEntryController.toggleSidebar.mockClear();
    mockAIEntryController.closeSidebar.mockClear();
    mockAIEntryController.openWithPrefill.mockClear();
    delete (
      window as typeof window & {
        __openmanagerDashboardInteractiveShellDevEffects__?: unknown;
      }
    ).__openmanagerDashboardInteractiveShellDevEffects__;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('guards mount side effects across development remounts', async () => {
    const { default: DashboardInteractiveShell } = await import(
      './DashboardInteractiveShell'
    );

    const props = {
      initialServers: [],
      initialTimeInfo: undefined,
      initialDataSourceInfo: null,
      initialFocusServerId: null,
      isMounted: true,
      canToggleAI: true,
      userType: 'github',
      isGuestFullAccess: false,
    } as const;

    const firstRender = render(
      React.createElement(DashboardInteractiveShell, props)
    );
    firstRender.unmount();

    render(React.createElement(DashboardInteractiveShell, props));

    await waitFor(
      () => {
        expect(ensureDataLoaded).toHaveBeenCalledTimes(1);
      },
      { timeout: 3_000 }
    );

    expect(triggerAIWarmup).toHaveBeenCalledTimes(1);
    expect(triggerAIWarmup).toHaveBeenCalledWith('dashboard-mount');
    expect(startSystem).toHaveBeenCalledTimes(1);

    const dashboardInitLogs = debugLog.mock.calls.filter(([message]) =>
      String(message).includes('대시보드 초기화')
    );
    expect(dashboardInitLogs).toHaveLength(1);
  });

  it('renders dashboard app navigation links inside the interactive shell', async () => {
    const { default: DashboardInteractiveShell } = await import(
      './DashboardInteractiveShell'
    );

    render(
      React.createElement(DashboardInteractiveShell, {
        initialServers: [],
        initialTimeInfo: undefined,
        initialDataSourceInfo: null,
        initialFocusServerId: null,
        isMounted: true,
        canToggleAI: true,
        userType: 'github',
        isGuestFullAccess: false,
      })
    );

    expect(
      screen.getByRole('navigation', { name: '대시보드 내비게이션' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '개요' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('link', { name: '서버' })).toHaveAttribute(
      'href',
      '/dashboard/servers'
    );
    expect(screen.getByRole('link', { name: '알림' })).toHaveAttribute(
      'href',
      '/dashboard/alerts'
    );
    expect(screen.getByRole('link', { name: '로그' })).toHaveAttribute(
      'href',
      '/dashboard/logs'
    );
    expect(screen.getByRole('link', { name: '토폴로지' })).toHaveAttribute(
      'href',
      '/dashboard/topology'
    );
    expect(
      screen.queryByRole('link', { name: 'AI 어시스턴트' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'AI 어시스턴트' })
    ).not.toBeInTheDocument();
  });

  it('closes the AI sidebar once when entering the dashboard AI page', async () => {
    mockAIEntryController.isOpen = true;
    const { default: DashboardInteractiveShell } = await import(
      './DashboardInteractiveShell'
    );

    const { rerender } = render(
      React.createElement(DashboardInteractiveShell, {
        dashboardView: 'ai-assistant',
        initialServers: [],
        initialTimeInfo: undefined,
        initialDataSourceInfo: null,
        initialFocusServerId: null,
        isMounted: true,
        canToggleAI: true,
        userType: 'github',
        isGuestFullAccess: false,
      })
    );

    await waitFor(() => {
      expect(mockAIEntryController.closeSidebar).toHaveBeenCalledTimes(1);
    });

    rerender(
      React.createElement(DashboardInteractiveShell, {
        dashboardView: 'ai-assistant',
        initialServers: [],
        initialTimeInfo: undefined,
        initialDataSourceInfo: null,
        initialFocusServerId: null,
        isMounted: true,
        canToggleAI: true,
        userType: 'github',
        isGuestFullAccess: false,
      })
    );

    expect(mockAIEntryController.closeSidebar).toHaveBeenCalledTimes(1);
  });

  it('opens and closes the mobile dashboard navigation drawer', async () => {
    const { default: DashboardInteractiveShell } = await import(
      './DashboardInteractiveShell'
    );

    render(
      React.createElement(DashboardInteractiveShell, {
        initialServers: [],
        initialTimeInfo: undefined,
        initialDataSourceInfo: null,
        initialFocusServerId: null,
        isMounted: true,
        canToggleAI: true,
        userType: 'github',
        isGuestFullAccess: false,
      })
    );

    fireEvent.click(screen.getByRole('button', { name: '대시보드 메뉴 열기' }));
    expect(screen.getByText('OpenManager')).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: '대시보드 메뉴 닫기' })[0]
    );
    expect(screen.queryByText('OpenManager')).not.toBeInTheDocument();
  });
});
