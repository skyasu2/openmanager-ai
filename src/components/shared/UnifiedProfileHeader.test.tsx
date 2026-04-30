/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UnifiedProfileHeader from './UnifiedProfileHeader';

const mocks = vi.hoisted(() => ({
  useProfileAuth: vi.fn(),
  useProfileMenu: vi.fn(),
  useSystemStatus: vi.fn(),
  startSystem: vi.fn(),
  stopSystem: vi.fn(),
  toggleMenu: vi.fn(),
  closeMenu: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/components/unified-profile/components/ProfileAvatar', () => ({
  ProfileAvatar: () => <div data-testid="profile-avatar" />,
  UserTypeIcon: () => <div data-testid="user-type-icon" />,
}));

vi.mock('@/components/unified-profile/components/ProfileDropdownMenu', () => ({
  ProfileDropdownMenu: () => <div data-testid="profile-dropdown-menu" />,
}));

vi.mock('@/components/unified-profile/hooks/useProfileAuth', () => ({
  useProfileAuth: () => mocks.useProfileAuth(),
}));

vi.mock('@/components/unified-profile/hooks/useProfileMenu', () => ({
  useProfileMenu: () => mocks.useProfileMenu(),
}));

vi.mock('@/hooks/useSystemStatus', () => ({
  useSystemStatus: (...args: unknown[]) => mocks.useSystemStatus(...args),
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: (selector: (state: unknown) => unknown) =>
    selector({
      isSystemStarted: false,
      startSystem: mocks.startSystem,
      stopSystem: mocks.stopSystem,
    }),
}));

vi.mock('@/lib/logging', () => ({
  logger: mocks.logger,
}));

describe('UnifiedProfileHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useProfileMenu.mockReturnValue({
      menuState: { showProfileMenu: false },
      dropdownRef: { current: null },
      toggleMenu: mocks.toggleMenu,
      closeMenu: mocks.closeMenu,
    });

    mocks.useSystemStatus.mockReturnValue({
      status: null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      startSystem: vi.fn(),
    });
  });

  it('비인증 상태에서는 /api/system 구독을 비활성화한다', () => {
    mocks.useProfileAuth.mockReturnValue({
      userInfo: null,
      userType: 'unknown',
      status: 'unauthenticated',
      isLoading: false,
      handleLogout: vi.fn(),
      navigateToLogin: vi.fn(),
      navigateToDashboard: vi.fn(),
    });

    render(<UnifiedProfileHeader />);

    expect(mocks.useSystemStatus).toHaveBeenCalledWith({ enabled: false });
  });

  it('비인증 모바일 헤더에서 로그인 버튼을 compact icon button으로 렌더링한다', () => {
    mocks.useProfileAuth.mockReturnValue({
      userInfo: null,
      userType: 'unknown',
      status: 'unauthenticated',
      isLoading: false,
      handleLogout: vi.fn(),
      navigateToLogin: vi.fn(),
      navigateToDashboard: vi.fn(),
    });

    render(<UnifiedProfileHeader />);

    const loginButton = screen.getByTestId('login-button');
    expect(loginButton).toHaveAttribute('aria-label', '로그인');
    expect(loginButton).toHaveClass('w-10');
    expect(loginButton).toHaveClass('sm:w-auto');
    expect(screen.getByText('로그인')).toHaveClass('hidden');
  });

  it('인증 상태에서는 /api/system 구독을 활성화한다', () => {
    mocks.useProfileAuth.mockReturnValue({
      userInfo: { id: 'u-1', name: 'Tester', email: 't@example.com' },
      userType: 'github',
      status: 'authenticated',
      isLoading: false,
      handleLogout: vi.fn(),
      navigateToLogin: vi.fn(),
      navigateToDashboard: vi.fn(),
    });

    render(<UnifiedProfileHeader />);

    expect(mocks.useSystemStatus).toHaveBeenCalledWith({ enabled: true });
  });

  it('프로필 메뉴 접근성 이름에 visible user state를 포함한다', async () => {
    mocks.useProfileAuth.mockReturnValue({
      userInfo: {
        id: 'guest-1',
        name: '게스트 사용자',
        email: 'guest@test.local',
      },
      userType: 'guest',
      status: 'authenticated',
      isLoading: false,
      handleLogout: vi.fn(),
      navigateToLogin: vi.fn(),
      navigateToDashboard: vi.fn(),
    });

    render(<UnifiedProfileHeader />);

    const trigger = await screen.findByTestId('profile-dropdown-trigger');

    expect(trigger.getAttribute('aria-label')).toBe(
      'GU 게스트 사용자 게스트 로그인'
    );
  });
});
