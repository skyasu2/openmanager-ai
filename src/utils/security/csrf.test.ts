/**
 * @vitest-environment jsdom
 *
 * CSRF 토큰 유틸리티 테스트
 *
 * @description
 * - 토큰 생성: 32자 hex 문자열
 * - 토큰 검증: 헤더 vs 쿠키 비교
 * - 쿠키 설정: Secure, SameSite, HttpOnly 플래그
 */

import type { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateCSRFToken,
  getCSRFTokenFromCookie,
  setCSRFCookie,
  setupCSRFProtection,
  verifyCSRFToken,
} from './csrf';

describe('generateCSRFToken', () => {
  it('32자 hex 문자열 생성', () => {
    // When
    const token = generateCSRFToken();

    // Then
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    expect(token.length).toBe(32);
  });

  it('매 호출마다 고유값 생성', () => {
    // When
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateCSRFToken());
    }

    // Then - 모든 토큰이 고유해야 함
    expect(tokens.size).toBe(100);
  });

  it('하이픈 없이 생성됨', () => {
    // When
    const token = generateCSRFToken();

    // Then
    expect(token).not.toContain('-');
  });
});

describe('verifyCSRFToken', () => {
  const createMockRequest = (
    headerToken: string | null,
    cookieToken: string | null
  ): NextRequest => {
    return {
      headers: {
        get: (name: string) => (name === 'X-CSRF-Token' ? headerToken : null),
      },
      cookies: {
        get: (name: string) =>
          name === 'csrf_token' && cookieToken
            ? { value: cookieToken }
            : undefined,
      },
    } as unknown as NextRequest;
  };

  it('헤더와 쿠키 일치 시 true', () => {
    // Given
    const token = 'a1b2c3d4e5f6789012345678abcdef01';
    const request = createMockRequest(token, token);

    // When
    const result = verifyCSRFToken(request);

    // Then
    expect(result).toBe(true);
  });

  it('헤더 누락 시 false', () => {
    // Given
    const request = createMockRequest(null, 'validToken123456789012345678abcd');

    // When
    const result = verifyCSRFToken(request);

    // Then
    expect(result).toBe(false);
  });

  it('쿠키 누락 시 false', () => {
    // Given
    const request = createMockRequest('validToken123456789012345678abcd', null);

    // When
    const result = verifyCSRFToken(request);

    // Then
    expect(result).toBe(false);
  });

  it('헤더와 쿠키 불일치 시 false', () => {
    // Given
    const request = createMockRequest(
      'headerToken12345678901234567890ab',
      'cookieToken12345678901234567890ab'
    );

    // When
    const result = verifyCSRFToken(request);

    // Then
    expect(result).toBe(false);
  });

  it('둘 다 빈 문자열일 때 false', () => {
    // Given
    const request = createMockRequest('', '');

    // When
    const result = verifyCSRFToken(request);

    // Then
    expect(result).toBe(false);
  });
});

describe('setCSRFCookie', () => {
  const createMockResponse = () => {
    const cookies: string[] = [];
    return {
      headers: {
        append: (name: string, value: string) => {
          if (name === 'Set-Cookie') {
            cookies.push(value);
          }
        },
        getCookies: () => cookies,
      },
    } as unknown as NextResponse & { headers: { getCookies: () => string[] } };
  };

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('Secure 플래그 설정 (프로덕션)', () => {
    // Given
    const response = createMockResponse();
    const token = 'testtoken123456789012345678abcdef';

    // When
    setCSRFCookie(response, token);

    // Then
    const cookies = response.headers.getCookies();
    expect(cookies[0]).toContain('Secure');
  });

  it('SameSite=Strict 설정', () => {
    // Given
    const response = createMockResponse();
    const token = 'testtoken123456789012345678abcdef';

    // When
    setCSRFCookie(response, token);

    // Then
    const cookies = response.headers.getCookies();
    expect(cookies[0]).toContain('SameSite=Strict');
  });

  it('Path=/ 설정', () => {
    // Given
    const response = createMockResponse();
    const token = 'testtoken123456789012345678abcdef';

    // When
    setCSRFCookie(response, token);

    // Then
    const cookies = response.headers.getCookies();
    expect(cookies[0]).toContain('Path=/');
  });

  it('Max-Age=86400 설정 (24시간)', () => {
    // Given
    const response = createMockResponse();
    const token = 'testtoken123456789012345678abcdef';

    // When
    setCSRFCookie(response, token);

    // Then
    const cookies = response.headers.getCookies();
    expect(cookies[0]).toContain('Max-Age=86400');
  });

  it('개발환경에서 Secure 플래그 미설정', () => {
    // Given
    vi.stubEnv('NODE_ENV', 'development');
    const response = createMockResponse();
    const token = 'testtoken123456789012345678abcdef';

    // When
    setCSRFCookie(response, token);

    // Then
    const cookies = response.headers.getCookies();
    expect(cookies[0]).not.toContain('Secure');
  });
});

describe('setupCSRFProtection', () => {
  const createMockResponse = () => {
    const cookies: string[] = [];
    return {
      headers: {
        append: (name: string, value: string) => {
          if (name === 'Set-Cookie') {
            cookies.push(value);
          }
        },
        getCookies: () => cookies,
      },
    } as unknown as NextResponse & { headers: { getCookies: () => string[] } };
  };

  it('토큰 생성 및 쿠키 설정', () => {
    // Given
    const response = createMockResponse();

    // When
    const token = setupCSRFProtection(response);

    // Then
    expect(token).toMatch(/^[a-f0-9]{32}$/);
    const cookies = response.headers.getCookies();
    expect(cookies[0]).toContain(`csrf_token=${token}`);
  });

  it('매 호출마다 새 토큰 생성', () => {
    // Given
    const response1 = createMockResponse();
    const response2 = createMockResponse();

    // When
    const token1 = setupCSRFProtection(response1);
    const token2 = setupCSRFProtection(response2);

    // Then
    expect(token1).not.toBe(token2);
  });
});

describe('getCSRFTokenFromCookie', () => {
  beforeEach(() => {
    // document.cookie 모킹
    Object.defineProperty(global, 'document', {
      value: { cookie: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error - 테스트 정리
    delete global.document;
  });

  it('쿠키에서 토큰 파싱', () => {
    // Given
    const token = 'a1b2c3d4e5f6789012345678abcdef01';
    global.document.cookie = `csrf_token=${token}; other_cookie=value`;

    // When
    const result = getCSRFTokenFromCookie();

    // Then
    expect(result).toBe(token);
  });

  it('쿠키 없을 시 빈 문자열', () => {
    // Given
    global.document.cookie = 'other_cookie=value; another=test';

    // When
    const result = getCSRFTokenFromCookie();

    // Then
    expect(result).toBe('');
  });

  it('document 없을 시 빈 문자열 (SSR)', () => {
    // Given - document를 undefined로 설정
    // @ts-expect-error - 테스트를 위한 의도적 삭제
    delete global.document;

    // When
    const result = getCSRFTokenFromCookie();

    // Then
    expect(result).toBe('');
  });

  it('여러 쿠키 중 csrf_token만 추출', () => {
    // Given
    const token = 'correcttoken12345678901234567890';
    global.document.cookie = `session_id=abc123; csrf_token=${token}; user_pref=dark`;

    // When
    const result = getCSRFTokenFromCookie();

    // Then
    expect(result).toBe(token);
  });
});
