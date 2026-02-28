import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn, mocked, sb, userEvent } from 'storybook/test';

import { useProfileAuth } from '../../components/unified-profile/hooks/useProfileAuth';
import { useProfileMenu } from '../../components/unified-profile/hooks/useProfileMenu';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { authStateManager } from '../../lib/auth/auth-state-manager';
import {
  signInWithEmailMagicLink,
  signInWithOAuthProvider,
} from '../../lib/auth/supabase-auth-oauth';
import { useUnifiedAdminStore } from '../../stores/useUnifiedAdminStore';

sb.mock(import('../../lib/auth/auth-state-manager.ts'));
sb.mock(import('../../lib/auth/supabase-auth-oauth.ts'));
sb.mock(import('../../components/unified-profile/hooks/useProfileAuth.ts'));
sb.mock(import('../../components/unified-profile/hooks/useProfileMenu.ts'));
sb.mock(import('../../hooks/useSystemStatus.ts'));
sb.mock(import('../../stores/useUnifiedAdminStore.ts'));

import LoginClient from './LoginClient';

// ─── Mock Helpers ───────────────────────────────────────────

function setupTransitiveMocks() {
  // OpenManagerLogo: useUnifiedAdminStore → aiAgent.isEnabled
  mocked(useUnifiedAdminStore).mockImplementation(
    (selector?: (s: Record<string, unknown>) => unknown) => {
      const state = {
        isSystemStarted: false,
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
    userInfo: null,
    userType: 'guest',
    isLoading: false,
    status: 'unauthenticated',
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

// ─── Meta ───────────────────────────────────────────────────

const meta = {
  title: 'Pages/Login',
  component: LoginClient,
  parameters: {
    layout: 'fullscreen',
    nextjs: { navigation: { pathname: '/login' } },
  },
  beforeEach() {
    setupTransitiveMocks();

    mocked(signInWithOAuthProvider).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    mocked(signInWithEmailMagicLink).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    Object.assign(authStateManager, {
      setGuestAuth: fn().mockResolvedValue(undefined),
    });
  },
} satisfies Meta<typeof LoginClient>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Stories ────────────────────────────────────────────────

/** 기본 로그인 화면 */
export const Default: Story = {};

/** GitHub 로그인 실패 시 에러 메시지 표시 */
export const WithError: Story = {
  beforeEach() {
    mocked(signInWithOAuthProvider).mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    } as never);
  },
  play: async ({ canvas }) => {
    const btn = canvas.getByLabelText('GitHub 계정으로 로그인');
    await userEvent.click(btn);
  },
};

/** GitHub OAuth 리다이렉트 대기 중 로딩 상태 */
export const GitHubLoading: Story = {
  beforeEach() {
    mocked(signInWithOAuthProvider).mockReturnValue(new Promise(() => {}));
  },
  play: async ({ canvas }) => {
    const btn = canvas.getByLabelText('GitHub 계정으로 로그인');
    await userEvent.click(btn);
  },
};

/** 게스트 세션 생성 중 로딩 상태 */
export const GuestLoading: Story = {
  beforeEach() {
    Object.assign(authStateManager, {
      setGuestAuth: fn().mockReturnValue(new Promise(() => {})),
    });
  },
  play: async ({ canvas }) => {
    const btn = canvas.getByLabelText('게스트 모드로 체험하기');
    await userEvent.click(btn);
  },
};

/** 이메일 Magic Link 전송 성공 */
export const EmailSuccess: Story = {
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText('이메일 주소');
    await userEvent.type(input, 'user@example.com');
    const btn = canvas.getByText('이메일로 계속하기');
    await userEvent.click(btn);
  },
};

/** 이메일 Magic Link 전송 실패 */
export const EmailError: Story = {
  beforeEach() {
    mocked(signInWithEmailMagicLink).mockResolvedValue({
      data: null,
      error: { message: 'Error sending magic link email' },
    } as never);
  },
  play: async ({ canvas }) => {
    const input = canvas.getByPlaceholderText('이메일 주소');
    await userEvent.type(input, 'invalid@test.com');
    const btn = canvas.getByText('이메일로 계속하기');
    await userEvent.click(btn);
  },
};

/** 계정 전환 시 현재 GitHub 로그인 버튼 숨김 */
export const AccountSwitch: Story = {
  beforeEach() {
    const url = new URL(window.location.href);
    url.searchParams.set('current', 'github');
    window.history.replaceState({}, '', url.toString());
    return () => {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('current');
      window.history.replaceState({}, '', cleanUrl.toString());
    };
  },
};
