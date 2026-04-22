/**
 * @vitest-environment jsdom
 */

import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startSystem = vi.fn();
const triggerAIWarmup = vi.fn().mockResolvedValue(undefined);
const ensureDataLoaded = vi.fn().mockResolvedValue(undefined);
const debugLog = vi.fn();
const debugError = vi.fn();

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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/hooks/ai/useAIEntryController', () => ({
  useAIEntryController: () => ({
    isOpen: false,
    toggleSidebar: vi.fn(),
    closeSidebar: vi.fn(),
    openWithPrefill: vi.fn(),
  }),
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
});
