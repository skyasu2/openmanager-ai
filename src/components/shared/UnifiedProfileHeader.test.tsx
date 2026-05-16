/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UnifiedProfileHeader from './UnifiedProfileHeader';

const mocks = vi.hoisted(() => ({
  useProfileAuth: vi.fn(),
  useProfileMenu: vi.fn(),
  useSystemStatus: vi.fn(),
  remoteStartSystem: vi.fn(),
  remoteStopSystem: vi.fn(),
  startSystem: vi.fn(),
  stopSystem: vi.fn(),
  isSystemStarted: false,
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
  ProfileDropdownMenu: ({
    isOpen,
    isSystemStarted,
    onSystemStart,
    onSystemStop,
  }: {
    isOpen: boolean;
    isSystemStarted: boolean;
    onSystemStart: () => void;
    onSystemStop: () => void;
  }) => (
    <div data-testid="profile-dropdown-menu">
      {isOpen &&
        (isSystemStarted ? (
          <button
            type="button"
            data-testid="mock-system-stop"
            onClick={onSystemStop}
          >
            시스템 종료
          </button>
        ) : (
          <button
            type="button"
            data-testid="mock-system-start"
            onClick={onSystemStart}
          >
            시스템 시작
          </button>
        ))}
    </div>
  ),
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
      isSystemStarted: mocks.isSystemStarted,
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
      startSystem: mocks.remoteStartSystem,
      stopSystem: mocks.remoteStopSystem,
    });
    mocks.remoteStartSystem.mockResolvedValue({
      success: true,
      action: 'start',
    });
    mocks.remoteStopSystem.mockResolvedValue({
      success: true,
      action: 'stop',
    });
    mocks.isSystemStarted = false;
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('게스트 세션은 로그인 상태와 별개로 /api/system 구독을 활성화한다', () => {
    mocks.useProfileAuth.mockReturnValue({
      userInfo: {
        id: 'guest-1',
        name: '게스트 사용자',
        email: 'guest@test.local',
      },
      userType: 'guest',
      status: 'unauthenticated',
      isLoading: false,
      handleLogout: vi.fn(),
      navigateToLogin: vi.fn(),
      navigateToDashboard: vi.fn(),
    });

    render(<UnifiedProfileHeader />);

    expect(mocks.useSystemStatus).toHaveBeenCalledWith({ enabled: true });
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

  it('비인증 로그인 버튼 클릭 시 로그인 페이지 이동 핸들러를 호출한다', () => {
    const navigateToLogin = vi.fn();

    mocks.useProfileAuth.mockReturnValue({
      userInfo: null,
      userType: 'unknown',
      status: 'unauthenticated',
      isLoading: false,
      handleLogout: vi.fn(),
      navigateToLogin,
      navigateToDashboard: vi.fn(),
    });

    render(<UnifiedProfileHeader />);

    fireEvent.click(screen.getByTestId('login-button'));

    expect(navigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('인증 상태 확인 중에는 프로필 메뉴 토글을 막는다', async () => {
    mocks.useProfileAuth.mockReturnValue({
      userInfo: null,
      userType: 'unknown',
      status: 'loading',
      isLoading: true,
      handleLogout: vi.fn(),
      navigateToLogin: vi.fn(),
      navigateToDashboard: vi.fn(),
    });

    render(<UnifiedProfileHeader />);

    const trigger = await screen.findByTestId('profile-dropdown-trigger');
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-busy', 'true');

    fireEvent.click(trigger);

    expect(mocks.toggleMenu).not.toHaveBeenCalled();
    expect(mocks.useSystemStatus).toHaveBeenCalledWith({ enabled: false });
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

  it('인증 모바일 헤더에서 프로필 버튼을 compact avatar button으로 렌더링한다', async () => {
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
    expect(trigger).toHaveClass('w-10');
    expect(trigger).toHaveClass('p-0');
    expect(trigger).toHaveClass('sm:w-auto');
    expect(trigger).toHaveClass('sm:p-3');
  });

  it('원격 /api/system 상태가 있으면 로컬 시스템 상태보다 우선한다', () => {
    mocks.isSystemStarted = true;
    mocks.useProfileMenu.mockReturnValue({
      menuState: { showProfileMenu: true },
      dropdownRef: { current: null },
      toggleMenu: mocks.toggleMenu,
      closeMenu: mocks.closeMenu,
    });
    mocks.useSystemStatus.mockReturnValue({
      status: {
        isRunning: false,
        isStarting: false,
        lastUpdate: '2026-05-17T00:00:00Z',
        userCount: 1,
        version: '8.11.161',
        environment: 'production',
        uptime: 0,
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      startSystem: mocks.remoteStartSystem,
      stopSystem: mocks.remoteStopSystem,
    });
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

    expect(screen.getByTestId('mock-system-start')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-system-stop')).not.toBeInTheDocument();
  });

  it('프로필 시스템 종료는 원격 stop 성공 후 로컬 상태를 종료한다', async () => {
    mocks.isSystemStarted = true;
    mocks.useProfileMenu.mockReturnValue({
      menuState: { showProfileMenu: true },
      dropdownRef: { current: null },
      toggleMenu: mocks.toggleMenu,
      closeMenu: mocks.closeMenu,
    });
    mocks.useSystemStatus.mockReturnValue({
      status: {
        isRunning: true,
        isStarting: false,
        lastUpdate: '2026-05-17T00:00:00Z',
        userCount: 1,
        version: '8.11.161',
        environment: 'production',
        uptime: 3600,
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
      startSystem: mocks.remoteStartSystem,
      stopSystem: mocks.remoteStopSystem,
    });
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
    fireEvent.click(screen.getByTestId('mock-system-stop'));

    expect(mocks.remoteStopSystem).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.stopSystem).toHaveBeenCalledTimes(1));
  });

  it('프로필 시스템 종료 원격 요청이 실행되지 않으면 로컬 상태를 변경하지 않는다', async () => {
    mocks.isSystemStarted = true;
    mocks.remoteStopSystem.mockResolvedValueOnce(null);
    mocks.useProfileMenu.mockReturnValue({
      menuState: { showProfileMenu: true },
      dropdownRef: { current: null },
      toggleMenu: mocks.toggleMenu,
      closeMenu: mocks.closeMenu,
    });
    mocks.useSystemStatus.mockReturnValue({
      status: {
        isRunning: true,
        isStarting: false,
        lastUpdate: '2026-05-17T00:00:00Z',
        userCount: 1,
        version: '8.11.164',
        environment: 'production',
        uptime: 3600,
      },
      isLoading: true,
      error: null,
      refresh: vi.fn(),
      startSystem: mocks.remoteStartSystem,
      stopSystem: mocks.remoteStopSystem,
    });
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
    fireEvent.click(screen.getByTestId('mock-system-stop'));

    expect(mocks.remoteStopSystem).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        '시스템 종료 요청이 실행되지 않아 로컬 상태를 유지합니다.'
      )
    );
    expect(mocks.stopSystem).not.toHaveBeenCalled();
  });

  it('프로필 시스템 시작 원격 요청이 실행되지 않으면 로컬 상태를 변경하지 않는다', async () => {
    mocks.remoteStartSystem.mockResolvedValueOnce(null);
    mocks.useProfileMenu.mockReturnValue({
      menuState: { showProfileMenu: true },
      dropdownRef: { current: null },
      toggleMenu: mocks.toggleMenu,
      closeMenu: mocks.closeMenu,
    });
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
    fireEvent.click(screen.getByTestId('mock-system-start'));

    expect(mocks.remoteStartSystem).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        '시스템 시작 요청이 실행되지 않아 로컬 상태를 유지합니다.'
      )
    );
    expect(mocks.startSystem).not.toHaveBeenCalled();
  });
});
