import { describe, expect, it } from 'vitest';
import {
  getGuestSessionIdFromCookieHeader,
  hasGuestSessionCookieHeader,
  hasGuestStorageState,
} from './guest-session-utils';

describe('guest-session-utils', () => {
  describe('getGuestSessionIdFromCookieHeader', () => {
    it('auth_session_id 쿠키를 우선 추출한다', () => {
      const sessionId = getGuestSessionIdFromCookieHeader(
        'foo=bar; auth_session_id=guest-123; auth_type=guest'
      );

      expect(sessionId).toBe('guest-123');
    });

    it('레거시 guest_session_id 쿠키로 폴백한다', () => {
      const sessionId = getGuestSessionIdFromCookieHeader(
        'foo=bar; guest_session_id=legacy-999'
      );

      expect(sessionId).toBe('legacy-999');
    });

    it('URL 인코딩된 세션 값을 디코딩한다', () => {
      const sessionId = getGuestSessionIdFromCookieHeader(
        'auth_session_id=guest%2Fabc%3D123'
      );

      expect(sessionId).toBe('guest/abc=123');
    });

    it('세션 쿠키가 없으면 null을 반환한다', () => {
      const sessionId = getGuestSessionIdFromCookieHeader('foo=bar');
      expect(sessionId).toBeNull();
    });
  });

  describe('hasGuestSessionCookieHeader', () => {
    it('게스트 세션 쿠키가 있으면 true를 반환한다', () => {
      expect(
        hasGuestSessionCookieHeader('auth_session_id=guest-123; foo=bar')
      ).toBe(true);
    });

    it('게스트 세션 쿠키가 없으면 false를 반환한다', () => {
      expect(hasGuestSessionCookieHeader('foo=bar; baz=qux')).toBe(false);
    });
  });

  describe('hasGuestStorageState', () => {
    it('sessionId + userJson 조합이면 true를 반환한다', () => {
      expect(
        hasGuestStorageState({
          sessionId: 'guest-123',
          authType: null,
          userJson: '{"id":"guest-123"}',
        })
      ).toBe(true);
    });

    it('sessionId + guest auth_type 조합이면 true를 반환한다', () => {
      expect(
        hasGuestStorageState({
          sessionId: 'guest-123',
          authType: 'guest',
          userJson: null,
        })
      ).toBe(true);
    });

    it('sessionId가 없으면 false를 반환한다', () => {
      expect(
        hasGuestStorageState({
          sessionId: null,
          authType: 'guest',
          userJson: '{"id":"guest"}',
        })
      ).toBe(false);
    });

    it('sessionId만 있고 userJson/auth_type이 없으면 false를 반환한다', () => {
      expect(
        hasGuestStorageState({
          sessionId: 'guest-123',
          authType: null,
          userJson: null,
        })
      ).toBe(false);
    });
  });
});
