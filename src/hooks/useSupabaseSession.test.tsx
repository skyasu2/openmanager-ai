/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from './useSupabaseSession';

const mocks = vi.hoisted(() => ({
  getSupabase: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => mocks.getSupabase(),
}));

vi.mock('@/lib/logging', () => ({
  logger: mocks.logger,
}));

vi.mock('@/lib/auth/auth-state-manager', () => ({
  clearAuthData: vi.fn(),
}));

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('update returns the fresh authenticated session payload', async () => {
    const user = {
      id: 'user-1',
      email: 'dev@example.com',
      app_metadata: { provider: 'github' },
      user_metadata: { name: 'Dev User', avatar_url: 'https://example.com/a' },
    };
    const unsubscribe = vi.fn();

    mocks.getSupabase.mockReturnValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValueOnce({
            data: { user: null },
            error: { message: 'Auth session missing!' },
          })
          .mockResolvedValueOnce({
            data: { user },
            error: null,
          }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe } },
        })),
      },
    });

    const { result, unmount } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));

    let updated: Awaited<ReturnType<typeof result.current.update>> | undefined;
    await act(async () => {
      updated = await result.current.update();
    });

    expect(updated).toEqual({
      user: {
        id: 'user-1',
        email: 'dev@example.com',
        name: 'Dev User',
        image: 'https://example.com/a',
        provider: 'github',
      },
      expires: expect.any(String),
    });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('falls back to unauthenticated when listener initialization throws', async () => {
    mocks.getSupabase.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Auth session missing!' },
        }),
        onAuthStateChange: vi.fn(() => {
          throw new Error('listener init failed');
        }),
      },
    });

    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(mocks.logger.error).toHaveBeenCalledWith(
      '세션 확인 오류:',
      expect.any(Error)
    );
  });
});
