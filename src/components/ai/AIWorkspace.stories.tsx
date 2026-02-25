import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn, mocked } from 'storybook/test';

import { useProfileAuth } from '../../components/unified-profile/hooks/useProfileAuth';
import { useProfileMenu } from '../../components/unified-profile/hooks/useProfileMenu';
import { useAIChatCore } from '../../hooks/ai/useAIChatCore';
import { useHealthCheck } from '../../hooks/system/useHealthCheck';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { useAISidebarStore } from '../../stores/useAISidebarStore';
import { useUnifiedAdminStore } from '../../stores/useUnifiedAdminStore';

import AIWorkspace from './AIWorkspace';

// ─── Mock Helpers ───────────────────────────────────────────

type MockMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function setupChatMock(messages: MockMessage[] = []) {
  mocked(useAIChatCore).mockReturnValue({
    input: '',
    setInput: fn(),
    messages,
    isLoading: false,
    hybridState: { progress: null, jobId: null },
    currentMode: 'stream',
    error: null,
    clearError: fn(),
    sessionState: {
      isLimitReached: false,
      currentCount: messages.filter((m) => m.role === 'user').length,
      maxCount: 20,
      isNewSession: messages.length === 0,
      remaining: 20,
      sessionId: 'mock-session',
    },
    handleNewSession: fn(),
    handleFeedback: fn(),
    regenerateLastResponse: fn(),
    retryLastQuery: fn(),
    stop: fn(),
    cancel: fn(),
    handleSendInput: fn(),
  } as never);
}

function setupSidebarMock() {
  const sidebarState = {
    isOpen: false,
    setOpen: fn(),
    webSearchEnabled: false,
    setWebSearchEnabled: fn(),
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

function setupTransitiveMocks() {
  // SystemContextPanel: useHealthCheck
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

  // OpenManagerLogo: useUnifiedAdminStore → aiAgent.isEnabled
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

  // UnifiedProfileHeader: useProfileAuth
  mocked(useProfileAuth).mockReturnValue({
    userInfo: { name: 'Test User', email: 'test@example.com' },
    userType: 'github',
    isLoading: false,
    status: 'authenticated',
    handleLogout: fn().mockResolvedValue(true),
    navigateToLogin: fn(),
    navigateToDashboard: fn(),
  } as never);

  // UnifiedProfileHeader: useProfileMenu
  mocked(useProfileMenu).mockReturnValue({
    menuState: { showProfileMenu: false },
    dropdownRef: { current: null },
    toggleMenu: fn(),
    openMenu: fn(),
    closeMenu: fn(),
  } as never);

  // UnifiedProfileHeader: useSystemStatus
  mocked(useSystemStatus).mockReturnValue({
    status: null,
    isLoading: false,
    error: null,
    refresh: fn().mockResolvedValue(undefined),
    startSystem: fn().mockResolvedValue(undefined),
  } as never);
}

// ─── Mock Messages ──────────────────────────────────────────

const mockMessages: MockMessage[] = [
  { id: '1', role: 'user', content: '현재 서버 상태를 분석해줘' },
  {
    id: '2',
    role: 'assistant',
    content:
      '현재 4대의 서버 중 1대가 critical 상태입니다.\n\n**db-prod-01** 서버의 CPU 사용률이 95%로 매우 높으며, 메모리 사용률도 92%에 달합니다. 즉시 조치가 필요합니다.\n\n- web-prod-01: 정상 (CPU 45%)\n- api-prod-01: 경고 (CPU 85%)\n- worker-01: 오프라인',
  },
];

// ─── Meta ───────────────────────────────────────────────────

const meta = {
  title: 'Pages/AIAssistant',
  component: AIWorkspace,
  parameters: {
    layout: 'fullscreen',
    nextjs: { navigation: { pathname: '/dashboard/ai-assistant' } },
  },
  beforeEach() {
    setupTransitiveMocks();
    setupChatMock();
    setupSidebarMock();
  },
} satisfies Meta<typeof AIWorkspace>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ────────────────────────────────────────────────

/** 전체화면 모드 - 빈 대화 */
export const FullscreenEmpty: Story = {
  args: { mode: 'fullscreen' },
};

/** 전체화면 모드 - 대화 진행 중 */
export const FullscreenWithMessages: Story = {
  args: { mode: 'fullscreen' },
  beforeEach() {
    setupChatMock(mockMessages);
  },
};

/** 사이드바 모드 */
export const SidebarMode: Story = {
  args: { mode: 'sidebar', onClose: fn() },
};
