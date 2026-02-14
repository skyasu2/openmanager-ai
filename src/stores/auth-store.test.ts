/**
 * auth-store Unit Tests
 *
 * @description Zustand 기반 인증 상태 관리 스토어 테스트
 * @created 2026-01-22
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from './auth-store';

// CustomEvent 스파이 - beforeEach에서 설정됨
let dispatchEventSpy: ReturnType<typeof vi.spyOn>;

describe('useAuthStore', () => {
  beforeEach(() => {
    // 스토어 초기화
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.clearAuth();
    });

    // vi.spyOn을 사용하여 안전하게 스파이 설정 (jsdom 환경 필수)
    dispatchEventSpy = vi
      .spyOn(window, 'dispatchEvent')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    // 스파이 복원
    dispatchEventSpy.mockRestore();
  });

  describe('초기 상태', () => {
    it('authType이 null이어야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());

      // Then
      expect(result.current.authType).toBe(null);
    });

    it('sessionId가 null이어야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());

      // Then
      expect(result.current.sessionId).toBe(null);
    });

    it('user가 null이어야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());

      // Then
      expect(result.current.user).toBe(null);
    });
  });

  describe('setAuth', () => {
    it('guest 인증을 설정할 수 있어야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());

      // When
      act(() => {
        result.current.setAuth({
          authType: 'guest',
          sessionId: 'guest-session-123',
        });
      });

      // Then
      expect(result.current.authType).toBe('guest');
      expect(result.current.sessionId).toBe('guest-session-123');
    });

    it('github 인증을 설정할 수 있어야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());
      const mockUser = {
        id: 'github-user-1',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.png',
      };

      // When
      act(() => {
        result.current.setAuth({
          authType: 'github',
          sessionId: 'github-session-456',
          user: mockUser,
        });
      });

      // Then
      expect(result.current.authType).toBe('github');
      expect(result.current.sessionId).toBe('github-session-456');
      expect(result.current.user).toEqual(mockUser);
    });

    it('sessionId만 변경할 수 있어야 함 (기존 값 유지)', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());
      const mockUser = {
        id: 'user-1',
        name: 'User',
        email: 'user@test.com',
      };

      act(() => {
        result.current.setAuth({
          authType: 'github',
          sessionId: 'old-session',
          user: mockUser,
        });
      });

      // When - authType만 변경, user와 sessionId는 기존 값 유지
      act(() => {
        result.current.setAuth({
          authType: 'guest',
        });
      });

      // Then
      expect(result.current.authType).toBe('guest');
      expect(result.current.sessionId).toBe('old-session'); // 유지
      expect(result.current.user).toEqual(mockUser); // 유지
    });

    it('CustomEvent를 발생시켜야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());

      // When
      act(() => {
        result.current.setAuth({
          authType: 'guest',
        });
      });

      // Then
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('auth-state-changed');
      expect(event.detail.authType).toBe('guest');
    });
  });

  describe('setGitHubAuth', () => {
    it('GitHub 사용자 정보를 설정할 수 있어야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());
      const mockUser = {
        id: 'github-123',
        name: 'GitHub User',
        email: 'github@example.com',
        avatar: 'https://github.com/avatar.png',
      };

      // When
      act(() => {
        result.current.setGitHubAuth(mockUser);
      });

      // Then
      expect(result.current.authType).toBe('github');
      expect(result.current.sessionId).toBe('github-123');
      expect(result.current.user).toEqual(mockUser);
    });

    it('authType이 자동으로 github로 설정되어야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setAuth({ authType: 'guest' });
      });
      expect(result.current.authType).toBe('guest');

      // When
      act(() => {
        result.current.setGitHubAuth({
          id: 'new-user',
          name: 'New User',
          email: 'new@test.com',
        });
      });

      // Then
      expect(result.current.authType).toBe('github');
    });

    it('CustomEvent를 발생시켜야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());
      dispatchEventSpy.mockClear();

      // When
      act(() => {
        result.current.setGitHubAuth({
          id: 'user-1',
          name: 'User',
          email: 'user@test.com',
        });
      });

      // Then
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('auth-state-changed');
      expect(event.detail.authType).toBe('github');
    });
  });

  describe('clearAuth', () => {
    it('모든 인증 상태를 초기화해야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setGitHubAuth({
          id: 'user-1',
          name: 'User',
          email: 'user@test.com',
        });
      });

      // When
      act(() => {
        result.current.clearAuth();
      });

      // Then
      expect(result.current.authType).toBe(null);
      expect(result.current.sessionId).toBe(null);
      expect(result.current.user).toBe(null);
    });

    it('CustomEvent를 발생시켜야 함', () => {
      // Given
      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setAuth({ authType: 'guest' });
      });
      dispatchEventSpy.mockClear();

      // When
      act(() => {
        result.current.clearAuth();
      });

      // Then
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
      const event = dispatchEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe('auth-state-changed');
      expect(event.detail.authType).toBe(null);
    });
  });
});
