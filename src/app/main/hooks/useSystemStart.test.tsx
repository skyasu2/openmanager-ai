/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  useSystemStatus: vi.fn(),
  startLocalSystem: vi.fn(),
  markSystemBootIntent: vi.fn(),
  triggerAIWarmup: vi.fn().mockResolvedValue(undefined),
  debugLog: vi.fn(),
  debugError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: mocks.routerPush,
  }),
}));

vi.mock('@/hooks/useSystemStatus', () => ({
  useSystemStatus: (...args: unknown[]) => mocks.useSystemStatus(...args),
}));

vi.mock('@/stores/useUnifiedAdminStore', () => ({
  useUnifiedAdminStore: (selector: (state: unknown) => unknown) =>
    selector({
      isSystemStarted: false,
      startSystem: mocks.startLocalSystem,
    }),
}));

vi.mock('@/lib/system/system-boot-intent', () => ({
  markSystemBootIntent: mocks.markSystemBootIntent,
}));

vi.mock('@/utils/ai-warmup', () => ({
  triggerAIWarmup: mocks.triggerAIWarmup,
}));

vi.mock('@/utils/debug', () => ({
  default: {
    log: mocks.debugLog,
    error: mocks.debugError,
  },
}));

vi.mock('@/utils/vercel-env-utils', () => ({
  debugWithEnv: (message: string) => message,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { useSystemStart } from './useSystemStart';

describe('useSystemStart', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('비로그인 사용자가 시스템 시작을 누르면 로그인 페이지로 이동한다', () => {
    const startRemoteSystem = vi.fn().mockResolvedValue({
      success: true,
      action: 'start',
    });

    mocks.useSystemStatus.mockReturnValue({
      status: null,
      isLoading: false,
      startSystem: startRemoteSystem,
    });

    const { result } = renderHook(() =>
      useSystemStart({
        isAuthenticated: false,
        isGitHubUser: false,
        isGuestUser: false,
        authLoading: false,
        isMounted: true,
      })
    );

    act(() => {
      result.current.handleSystemToggle();
    });

    expect(mocks.routerPush).toHaveBeenCalledWith('/login');
    expect(result.current.showGuestRestriction).toBe(false);
    expect(startRemoteSystem).not.toHaveBeenCalled();
    expect(mocks.startLocalSystem).not.toHaveBeenCalled();
  });

  it('시스템 시작 성공 시 부팅 의도를 기록한 뒤 system-boot로 이동한다', async () => {
    const startRemoteSystem = vi.fn().mockResolvedValue({
      success: true,
      action: 'start',
    });

    mocks.useSystemStatus.mockReturnValue({
      status: { isRunning: false, isStarting: false },
      isLoading: false,
      startSystem: startRemoteSystem,
    });

    const { result } = renderHook(() =>
      useSystemStart({
        isAuthenticated: true,
        isGitHubUser: true,
        isGuestUser: false,
        authLoading: false,
        isMounted: true,
      })
    );

    act(() => {
      result.current.handleSystemToggle();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
    });

    expect(startRemoteSystem).toHaveBeenCalledTimes(1);
    expect(mocks.startLocalSystem).toHaveBeenCalledTimes(1);
    expect(mocks.markSystemBootIntent).toHaveBeenCalledTimes(1);
    expect(mocks.startLocalSystem.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.markSystemBootIntent.mock.invocationCallOrder[0]
    );
    expect(mocks.routerPush).toHaveBeenCalledWith('/system-boot');
  });

  it('원격 시스템 시작이 실패하면 로컬 시작과 system-boot 이동을 실행하지 않는다', async () => {
    const startRemoteSystem = vi
      .fn()
      .mockRejectedValue(new Error('순차 서버 생성 엔진 시작 실패'));

    mocks.useSystemStatus.mockReturnValue({
      status: { isRunning: false, isStarting: false },
      isLoading: false,
      startSystem: startRemoteSystem,
    });

    const { result } = renderHook(() =>
      useSystemStart({
        isAuthenticated: true,
        isGitHubUser: false,
        isGuestUser: true,
        authLoading: false,
        isMounted: true,
        isGuestSystemStartEnabled: true,
      })
    );

    act(() => {
      result.current.handleSystemToggle();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
    });

    expect(mocks.debugError).toHaveBeenCalledWith(
      '❌ 시스템 시작 실패:',
      expect.any(Error)
    );

    expect(startRemoteSystem).toHaveBeenCalledTimes(1);
    expect(mocks.startLocalSystem).not.toHaveBeenCalled();
    expect(mocks.routerPush).not.toHaveBeenCalledWith('/system-boot');
    expect(result.current.isSystemStarting).toBe(false);
  });

  it('원격 시스템 시작이 스킵되면 로컬 시작과 system-boot 이동을 실행하지 않는다', async () => {
    const startRemoteSystem = vi.fn().mockResolvedValue(null);

    mocks.useSystemStatus.mockReturnValue({
      status: { isRunning: false, isStarting: false },
      isLoading: false,
      startSystem: startRemoteSystem,
    });

    const { result } = renderHook(() =>
      useSystemStart({
        isAuthenticated: true,
        isGitHubUser: false,
        isGuestUser: true,
        authLoading: false,
        isMounted: true,
        isGuestSystemStartEnabled: true,
      })
    );

    act(() => {
      result.current.handleSystemToggle();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
    });

    expect(startRemoteSystem).toHaveBeenCalledTimes(1);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      '시스템 시작 요청이 실행되지 않아 로컬 시작을 중단합니다'
    );
    expect(mocks.startLocalSystem).not.toHaveBeenCalled();
    expect(mocks.routerPush).not.toHaveBeenCalledWith('/system-boot');
    expect(result.current.isSystemStarting).toBe(false);
  });
});
