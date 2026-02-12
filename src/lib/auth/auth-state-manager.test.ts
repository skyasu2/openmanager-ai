/**
 * @vitest-environment jsdom
 */

/**
 * AuthStateManager Tests
 * 인증 상태 관리 싱글톤 테스트
 *
 * Note: vi.resetModules() 제거 → static import + singleton reset 방식으로 전환
 * (WSL 환경에서 매 테스트마다 모듈 재초기화가 worker timeout 유발)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock 설정 (static - 모듈 재로드 없음)
// ============================================================================

// localStorage Mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

// sessionStorage Mock
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

// Supabase Client Mock
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    signOut: vi.fn(),
  },
};

vi.mock('@/lib/supabase/client', () => ({
  getSupabase: () => mockSupabaseClient,
}));

// Static import (모듈 재로드 없음)
import { AuthStateManager } from './auth-state-manager';

// ============================================================================
// 테스트
// ============================================================================

describe('AuthStateManager', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();

    // Singleton reset (vi.resetModules() 대신)
    // biome-ignore lint/suspicious/noExplicitAny: test-only singleton reset
    (AuthStateManager as any).instance = undefined;

    // Setup global mocks
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: {
        cookie: '',
      },
      writable: true,
    });

    // Default Supabase mock - no session
    mockSupabaseClient.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
  });

  describe('Singleton Pattern', () => {
    it('getInstance()가 항상 동일한 인스턴스를 반환해야 함', () => {
      const instance1 = AuthStateManager.getInstance();
      const instance2 = AuthStateManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Cache Management', () => {
    it('invalidateCache()가 캐시를 무효화해야 함', async () => {
      const manager = AuthStateManager.getInstance();

      // 첫 번째 호출로 캐시 설정
      await manager.getAuthState();

      // 캐시 무효화
      manager.invalidateCache();

      // 다시 getAuthState를 호출하면 새로운 상태를 가져옴
      const state = await manager.getAuthState();
      expect(state).toBeDefined();
    });
  });

  describe('getAuthState()', () => {
    it('세션이 없을 때 unknown 상태를 반환해야 함', async () => {
      const manager = AuthStateManager.getInstance();

      const state = await manager.getAuthState();

      expect(state.isAuthenticated).toBe(false);
      expect(state.type).toBe('unknown');
      expect(state.user).toBeNull();
    });

    it('게스트 세션이 있을 때 guest 상태를 반환해야 함', async () => {
      // 게스트 데이터 설정
      const guestUser = {
        id: 'guest-123',
        name: 'Guest User',
        email: 'guest@example.com',
        provider: 'guest' as const,
      };

      localStorageMock.setItem('auth_type', 'guest');
      localStorageMock.setItem('auth_session_id', 'session-abc');
      localStorageMock.setItem('auth_user', JSON.stringify(guestUser));
      localStorageMock.setItem('auth_created_at', Date.now().toString());

      const manager = AuthStateManager.getInstance();

      const state = await manager.getAuthState();

      expect(state.isAuthenticated).toBe(true);
      expect(state.type).toBe('guest');
      expect(state.user?.id).toBe('guest-123');
    });

    it('GitHub 세션이 있을 때 github 상태를 반환해야 함', async () => {
      // GitHub 세션 Mock
      const mockUser = {
        id: 'github-user-123',
        email: 'user@github.com',
        user_metadata: {
          avatar_url: 'https://github.com/avatar.png',
          user_name: 'githubuser',
          full_name: 'GitHub User',
        },
        app_metadata: {
          provider: 'github',
        },
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'access-token-abc123',
          },
        },
        error: null,
      });

      const manager = AuthStateManager.getInstance();

      const state = await manager.getAuthState();

      expect(state.isAuthenticated).toBe(true);
      expect(state.type).toBe('github');
      expect(state.user?.provider).toBe('github');
    });

    it('GitHub 세션이 게스트 세션보다 우선해야 함', async () => {
      // 게스트 데이터 설정
      localStorageMock.setItem('auth_type', 'guest');
      localStorageMock.setItem('auth_session_id', 'guest-session');
      localStorageMock.setItem(
        'auth_user',
        JSON.stringify({ id: 'guest-123', provider: 'guest' })
      );

      // GitHub 세션도 설정
      const mockUser = {
        id: 'github-user-123',
        email: 'user@github.com',
        user_metadata: { user_name: 'githubuser' },
        app_metadata: { provider: 'github' },
      };
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: {
          session: {
            user: mockUser,
            access_token: 'access-token',
          },
        },
        error: null,
      });

      const manager = AuthStateManager.getInstance();

      const state = await manager.getAuthState();

      // GitHub이 우선되어야 함
      expect(state.type).toBe('github');
      expect(state.user?.provider).toBe('github');
    });
  });

  describe('clearAllAuthData()', () => {
    it('모든 인증 데이터를 정리해야 함', async () => {
      // 데이터 설정
      localStorageMock.setItem('auth_type', 'guest');
      localStorageMock.setItem('auth_session_id', 'session-123');

      const manager = AuthStateManager.getInstance();

      await manager.clearAllAuthData();

      // Supabase signOut 호출 확인
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });

    it('특정 타입만 정리할 수 있어야 함', async () => {
      const manager = AuthStateManager.getInstance();

      await manager.clearAllAuthData('guest');

      // guest 타입만 정리하면 Supabase signOut은 호출되지 않아야 함
      expect(mockSupabaseClient.auth.signOut).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('Supabase 에러 시에도 안전하게 처리해야 함', async () => {
      mockSupabaseClient.auth.getSession.mockRejectedValue(
        new Error('Network error')
      );

      const manager = AuthStateManager.getInstance();

      const state = await manager.getAuthState();

      // 에러 발생 시 unknown 상태 반환
      expect(state.isAuthenticated).toBe(false);
      expect(state.type).toBe('unknown');
    });
  });
});

// Note: generateClientSessionId는 내부 함수로 export되지 않음
// AuthStateManager의 공개 API를 통해 간접적으로 테스트됨
