/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  useSystemStatus: vi.fn(),
  startLocalSystem: vi.fn(),
  triggerAIWarmup: vi.fn().mockResolvedValue(undefined),
  debugLog: vi.fn(),
  debugError: vi.fn(),
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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
});
