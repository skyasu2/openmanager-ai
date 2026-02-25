import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, mocked } from 'storybook/test';

import { useProfileAuth } from '../../components/unified-profile/hooks/useProfileAuth';
import { useProfileMenu } from '../../components/unified-profile/hooks/useProfileMenu';
import { isGuestFullAccessEnabled } from '../../config/guestMode';
import { useMonitoringReport } from '../../hooks/dashboard/useMonitoringReport';
import { useHealthCheck } from '../../hooks/system/useHealthCheck';
import { useToast } from '../../hooks/use-toast';
import { useAutoLogout } from '../../hooks/useAutoLogout';
import { useServerDashboard } from '../../hooks/useServerDashboard';
import { useServerMetrics } from '../../hooks/useServerMetrics';
import { useSystemAutoShutdown } from '../../hooks/useSystemAutoShutdown';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { systemInactivityService } from '../../services/system/SystemInactivityService';
import { useAISidebarStore } from '../../stores/useAISidebarStore';
import { useUnifiedAdminStore } from '../../stores/useUnifiedAdminStore';
import type { Server } from '../../types/server';

import DashboardClient from './DashboardClient';

// ─── Mock Data ──────────────────────────────────────────────

const mockServers: Server[] = [
  {
    id: 'srv-1',
    name: 'web-prod-01',
    status: 'online',
    cpu: 45,
    memory: 62,
    disk: 55,
    uptime: '15d 3h',
    location: 'Seoul',
  },
  {
    id: 'srv-2',
    name: 'api-prod-01',
    status: 'warning',
    cpu: 85,
    memory: 78,
    disk: 60,
    uptime: '7d 12h',
    location: 'Tokyo',
  },
  {
    id: 'srv-3',
    name: 'db-prod-01',
    status: 'critical',
    cpu: 95,
    memory: 92,
    disk: 88,
    uptime: '30d',
    location: 'Seoul',
  },
  {
    id: 'srv-4',
    name: 'worker-01',
    status: 'offline',
    cpu: 0,
    memory: 0,
    disk: 45,
    uptime: '0',
    location: 'US-East',
  },
];

// ─── Mock Helpers ───────────────────────────────────────────

function setupStoreMocks(sidebarOpen = false) {
  mocked(useUnifiedAdminStore).mockImplementation(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isSystemStarted: true,
        aiAgent: { isEnabled: false, state: 'disabled' },
        startSystem: fn(),
        stopSystem: fn(),
        getSystemRemainingTime: fn(() => 0),
      };
      return selector ? selector(state) : state;
    }
  );

  const sidebarState = {
    isOpen: sidebarOpen,
    setOpen: fn(),
    clearMessages: fn(),
  };
  mocked(useAISidebarStore).mockImplementation(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      return selector ? selector(sidebarState) : sidebarState;
    }
  );
  Object.assign(mocked(useAISidebarStore), {
    getState: fn(() => sidebarState),
  });
}

function setupHookMocks() {
  mocked(useUserPermissions).mockReturnValue({
    canAccessDashboard: true,
    canToggleAI: true,
    isPinAuthenticated: false,
    userType: 'github',
  } as never);

  mocked(useServerDashboard).mockReturnValue({
    paginatedServers: mockServers,
    servers: mockServers,
    filteredTotal: mockServers.length,
    currentPage: 1,
    totalPages: 1,
    pageSize: 20,
    setCurrentPage: fn(),
    changePageSize: fn(),
  } as never);

  mocked(useAutoLogout).mockReturnValue({
    remainingTime: 600,
    isWarning: false,
    resetTimer: fn(),
    forceLogout: fn().mockResolvedValue(undefined),
  } as never);

  mocked(useSystemAutoShutdown).mockReturnValue(undefined as never);
  mocked(useToast).mockReturnValue({ toast: fn() } as never);
  mocked(isGuestFullAccessEnabled).mockReturnValue(true);

  // UnifiedProfileHeader transitive deps (via DashboardHeader)
  mocked(useProfileAuth).mockReturnValue({
    userInfo: { name: 'Test User', email: 'test@example.com' },
    userType: 'github',
    isLoading: false,
    status: 'authenticated',
    handleLogout: fn().mockResolvedValue(true),
    navigateToLogin: fn(),
    navigateToDashboard: fn(),
  } as never);

  mocked(useProfileMenu).mockReturnValue({
    menuState: { showProfileMenu: false },
    dropdownRef: { current: null },
    toggleMenu: fn(),
    openMenu: fn(),
    closeMenu: fn(),
  } as never);

  mocked(useSystemStatus).mockReturnValue({
    status: {
      isRunning: true,
      isStarting: false,
      lastUpdate: '',
      userCount: 1,
      version: '8.1.0',
      environment: 'development',
      uptime: 3600,
    },
    isLoading: false,
    error: null,
    refresh: fn().mockResolvedValue(undefined),
    startSystem: fn().mockResolvedValue(undefined),
  } as never);

  // DashboardContent: useMonitoringReport
  mocked(useMonitoringReport).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
  } as never);

  // ImprovedServerCard: useServerMetrics
  mocked(useServerMetrics).mockReturnValue({
    metricsHistory: [],
    isLoadingHistory: false,
    loadMetricsHistory: fn().mockResolvedValue(undefined),
  } as never);

  // CloudRunStatusIndicator (via AISidebarHeader): useHealthCheck
  mocked(useHealthCheck).mockReturnValue({
    status: 'healthy',
    providers: [
      { name: 'Cerebras', status: 'active', role: 'primary' },
      { name: 'Groq', status: 'active', role: 'fallback' },
    ],
    latency: 120,
    lastChecked: new Date(),
    isSystemOnline: true,
    error: null,
    isChecking: false,
    check: fn().mockResolvedValue(undefined),
    isHealthy: true,
    isDegraded: false,
    isError: false,
  } as never);

  Object.assign(systemInactivityService, {
    pauseSystem: fn(),
    resumeSystem: fn(),
  });
}

// ─── Meta ───────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const meta = {
  title: 'Pages/Dashboard',
  component: DashboardClient,
  parameters: {
    layout: 'fullscreen',
    nextjs: { navigation: { pathname: '/dashboard' } },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  beforeEach() {
    queryClient.clear();
    setupStoreMocks();
    setupHookMocks();
  },
} satisfies Meta<typeof DashboardClient>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ────────────────────────────────────────────────

/** 인증 상태 확인 중 로딩 화면 */
export const AuthLoading: Story = {
  beforeEach() {
    mocked(useUserPermissions).mockReturnValue({
      canAccessDashboard: false,
      canToggleAI: false,
      isPinAuthenticated: false,
      userType: 'loading',
    } as never);
  },
};

/** 접근 권한 없음 화면 */
export const Unauthorized: Story = {
  beforeEach() {
    mocked(useUserPermissions).mockReturnValue({
      canAccessDashboard: false,
      canToggleAI: false,
      isPinAuthenticated: false,
      userType: 'guest',
    } as never);
    mocked(isGuestFullAccessEnabled).mockReturnValue(false);
  },
};

/** 메인 대시보드 (서버 4대: online, warning, critical, offline) */
export const MainView: Story = {};

/** AI 사이드바가 열린 대시보드 */
export const WithAISidebar: Story = {
  beforeEach() {
    setupStoreMocks(true);
  },
};
