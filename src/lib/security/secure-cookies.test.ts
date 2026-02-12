/**
 * 보안 쿠키 유틸리티 테스트
 *
 * @description
 * - Vercel 환경 감지
 * - HTTPS 환경 감지
 * - 보안 쿠키 옵션 생성
 * - OAuth 리다이렉트 URL 검증
 * - 게스트 세션 쿠키 관리
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSecureCookieOptions,
  guestSessionCookies,
  isSecureEnvironment,
  isVercelEnvironment,
  validateRedirectUrl,
} from './secure-cookies';

describe('isVercelEnvironment', () => {
  const originalWindow = global.window;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // @ts-expect-error - 테스트 정리
    global.window = originalWindow;
    process.env = originalEnv;
  });

  it('hostname에 vercel.app 포함 시 true (클라이언트)', () => {
    // Given
    // @ts-expect-error - 테스트를 위한 window 모킹
    global.window = {
      location: { hostname: 'my-app.vercel.app' },
    };

    // When & Then
    expect(isVercelEnvironment()).toBe(true);
  });

  it('hostname에 .vercel.app 포함 시 true (클라이언트)', () => {
    // Given
    // @ts-expect-error - 테스트를 위한 window 모킹
    global.window = {
      location: { hostname: 'openmanager-ai.vercel.app' },
    };

    // When & Then
    expect(isVercelEnvironment()).toBe(true);
  });

  it('VERCEL 환경변수 있으면 true (서버)', () => {
    // Given
    // @ts-expect-error - 테스트를 위해 undefined로 설정
    global.window = undefined;
    process.env.VERCEL = '1';

    // When & Then
    expect(isVercelEnvironment()).toBe(true);
  });

  it('VERCEL_ENV 환경변수 있으면 true (서버)', () => {
    // Given
    // @ts-expect-error - 테스트를 위해 undefined로 설정
    global.window = undefined;
    delete process.env.VERCEL;
    process.env.VERCEL_ENV = 'production';

    // When & Then
    expect(isVercelEnvironment()).toBe(true);
  });

  it('로컬환경 시 false', () => {
    // Given
    // @ts-expect-error - 테스트를 위해 undefined로 설정
    global.window = undefined;
    delete process.env.VERCEL;
    delete process.env.VERCEL_ENV;

    // When & Then
    expect(isVercelEnvironment()).toBe(false);
  });
});

describe('isSecureEnvironment', () => {
  const originalWindow = global.window;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // @ts-expect-error - 테스트 정리
    global.window = originalWindow;
    process.env = originalEnv;
  });

  it('HTTPS 프로토콜 시 true (클라이언트)', () => {
    // Given
    // @ts-expect-error - 테스트를 위한 window 모킹
    global.window = {
      location: { protocol: 'https:' },
    };

    // When & Then
    expect(isSecureEnvironment()).toBe(true);
  });

  it('HTTP 프로토콜 시 false (클라이언트)', () => {
    // Given
    // @ts-expect-error - 테스트를 위한 window 모킹
    global.window = {
      location: { protocol: 'http:' },
    };

    // When & Then
    expect(isSecureEnvironment()).toBe(false);
  });

  it('프로덕션 환경 시 true (서버)', () => {
    // Given
    // @ts-expect-error - 테스트를 위해 undefined로 설정
    global.window = undefined;
    process.env.NODE_ENV = 'production';

    // When & Then
    expect(isSecureEnvironment()).toBe(true);
  });

  it('개발환경 시 false (서버)', () => {
    // Given
    // @ts-expect-error - 테스트를 위해 undefined로 설정
    global.window = undefined;
    process.env.NODE_ENV = 'development';

    // When & Then
    expect(isSecureEnvironment()).toBe(false);
  });
});

describe('getSecureCookieOptions', () => {
  const originalWindow = global.window;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // 기본적으로 서버 환경으로 설정
    // @ts-expect-error - 테스트를 위해 undefined로 설정
    global.window = undefined;
  });

  afterEach(() => {
    // @ts-expect-error - 테스트 정리
    global.window = originalWindow;
    process.env = originalEnv;
  });

  it('프로덕션에서 Secure=true', () => {
    // Given
    process.env.NODE_ENV = 'production';

    // When
    const options = getSecureCookieOptions();

    // Then
    expect(options).toContain('Secure');
  });

  it('항상 SameSite=Strict', () => {
    // Given
    process.env.NODE_ENV = 'development';

    // When
    const options = getSecureCookieOptions();

    // Then
    expect(options).toContain('SameSite=Strict');
  });

  it('개발환경에서 Secure 미포함', () => {
    // Given
    process.env.NODE_ENV = 'development';

    // When
    const options = getSecureCookieOptions();

    // Then
    expect(options).not.toContain('Secure');
  });

  it('maxAge 파라미터 설정됨', () => {
    // When
    const options = getSecureCookieOptions(3600);

    // Then
    expect(options).toContain('max-age=3600');
  });

  it('maxAge 미지정 시 max-age 없음', () => {
    // When
    const options = getSecureCookieOptions();

    // Then
    expect(options).not.toContain('max-age');
  });

  it('path=/ 항상 포함', () => {
    // When
    const options = getSecureCookieOptions();

    // Then
    expect(options).toContain('path=/');
  });
});

describe('validateRedirectUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test'; // 로그 출력 방지
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('프로덕션 도메인 허용', () => {
    expect(
      validateRedirectUrl('https://openmanager-ai.vercel.app/dashboard')
    ).toBe(true);
  });

  it('프리뷰 배포 도메인 허용', () => {
    expect(
      validateRedirectUrl('https://openmanager-ai-abc123.vercel.app/page')
    ).toBe(true);
  });

  it('사용자별 배포 도메인 허용', () => {
    expect(
      validateRedirectUrl('https://test-skyasus-projects.vercel.app/home')
    ).toBe(true);
  });

  it('localhost:3000 허용', () => {
    expect(validateRedirectUrl('http://localhost:3000/callback')).toBe(true);
  });

  it('localhost:3001 허용', () => {
    expect(validateRedirectUrl('http://localhost:3001/auth')).toBe(true);
  });

  it('localhost:3002 거부 (허용되지 않은 포트)', () => {
    expect(validateRedirectUrl('http://localhost:3002/callback')).toBe(false);
  });

  it('악성 도메인 거부', () => {
    expect(validateRedirectUrl('https://evil-site.com/steal')).toBe(false);
    expect(validateRedirectUrl('https://fake-vercel.app/phish')).toBe(false);
  });

  it('잘못된 URL 형식 거부', () => {
    expect(validateRedirectUrl('not-a-url')).toBe(false);
    expect(validateRedirectUrl('')).toBe(false);
  });

  it('다른 서브도메인 거부', () => {
    expect(validateRedirectUrl('https://other-app.vercel.app/')).toBe(false);
  });
});

describe('guestSessionCookies', () => {
  beforeEach(() => {
    // document.cookie 모킹
    let cookieStore = '';
    Object.defineProperty(global, 'document', {
      value: {
        get cookie() {
          return cookieStore;
        },
        set cookie(value: string) {
          // 간단한 쿠키 파싱/설정 시뮬레이션
          const [cookiePart] = value.split(';');
          const [name, val] = cookiePart.split('=');

          if (val === '' || value.includes('max-age=0')) {
            // 쿠키 삭제
            const cookies = cookieStore
              .split('; ')
              .filter((c) => !c.startsWith(`${name}=`));
            cookieStore = cookies.join('; ');
          } else {
            // 쿠키 추가/업데이트
            const cookies = cookieStore
              .split('; ')
              .filter((c) => c && !c.startsWith(`${name}=`));
            cookies.push(`${name}=${val}`);
            cookieStore = cookies.join('; ');
          }
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error - 테스트 정리
    delete global.document;
  });

  it('setGuestSession → 2개 쿠키 설정', () => {
    // When
    guestSessionCookies.setGuestSession('test-session-id');

    // Then
    expect(document.cookie).toContain('auth_session_id=test-session-id');
    expect(document.cookie).toContain('auth_type=guest');
  });

  it('hasGuestSession → 둘 다 있어야 true', () => {
    // Given
    guestSessionCookies.setGuestSession('session-123');

    // When & Then
    expect(guestSessionCookies.hasGuestSession()).toBe(true);
  });

  it('hasGuestSession → auth_session_id만 있으면 false', () => {
    // Given - auth_type 없이 auth_session_id만 설정
    document.cookie = 'auth_session_id=session-123';

    // When & Then
    expect(guestSessionCookies.hasGuestSession()).toBe(false);
  });

  it('hasGuestSession → auth_type만 있으면 false', () => {
    // Given - auth_session_id 없이 auth_type만 설정
    document.cookie = 'auth_type=guest';

    // When & Then
    expect(guestSessionCookies.hasGuestSession()).toBe(false);
  });

  it('clearGuestSession → 2개 쿠키 삭제', () => {
    // Given
    guestSessionCookies.setGuestSession('to-be-deleted');
    expect(guestSessionCookies.hasGuestSession()).toBe(true);

    // When
    guestSessionCookies.clearGuestSession();

    // Then
    expect(guestSessionCookies.hasGuestSession()).toBe(false);
  });

  it('document 없을 시 hasGuestSession false', () => {
    // Given
    // @ts-expect-error - 테스트를 위한 삭제
    delete global.document;

    // When & Then
    expect(guestSessionCookies.hasGuestSession()).toBe(false);
  });
});
