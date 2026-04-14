/**
 * @vitest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SupabaseAuthProvider from './SupabaseAuthProvider';

const mocks = vi.hoisted(() => ({
  invalidateCache: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  getSupabase: vi.fn(),
}));

vi.mock('@/lib/auth/auth-state-manager', () => ({
  authStateManager: {
    invalidateCache: mocks.invalidateCache,
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mocks.info,
    warn: mocks.warn,
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => mocks.getSupabase(),
}));

describe('SupabaseAuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invalidates auth cache on auth state changes and unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    let authChangeHandler:
      | ((_event: string, session: { user?: object } | null) => void)
      | undefined;

    mocks.getSupabase.mockReturnValue({
      auth: {
        onAuthStateChange: vi.fn((handler) => {
          authChangeHandler = handler;
          return {
            data: {
              subscription: {
                unsubscribe,
              },
            },
          };
        }),
      },
    });

    const { unmount } = render(
      <SupabaseAuthProvider>
        <div>provider child</div>
      </SupabaseAuthProvider>
    );

    expect(screen.getByText('provider child')).toBeInTheDocument();

    authChangeHandler?.('SIGNED_IN', { user: { id: 'u1' } });
    authChangeHandler?.('SIGNED_OUT', null);

    expect(mocks.invalidateCache).toHaveBeenCalledTimes(2);
    expect(mocks.info).toHaveBeenCalledWith(
      '🔐 Auth state changed:',
      'Authenticated'
    );
    expect(mocks.info).toHaveBeenCalledWith(
      '🔐 Auth state changed:',
      'Not authenticated'
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('keeps rendering children when auth listener initialization throws', () => {
    mocks.getSupabase.mockImplementation(() => {
      throw new Error('Missing Supabase environment variables');
    });

    render(
      <SupabaseAuthProvider>
        <div>provider child</div>
      </SupabaseAuthProvider>
    );

    expect(screen.getByText('provider child')).toBeInTheDocument();
    expect(mocks.warn).toHaveBeenCalledWith(
      '⚠️ Supabase auth listener 초기화 실패:',
      expect.any(Error)
    );
  });
});
