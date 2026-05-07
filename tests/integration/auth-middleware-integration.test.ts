/**
 * 🔗 Auth Middleware Integration Test
 *
 * withAuth → checkAPIAuth → Response 통합 테스트
 *
 * Vercel 무료 티어 안전:
 * - ✅ 외부 API 호출 없음
 * - ✅ NextAuth 세션 Mock
 * - ✅ 10초 이내 실행
 *
 * @vitest-environment node
 */

import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('@/config/constants', () => ({
  SECURITY: {
    API: {
      MAX_KEY_LENGTH: 256,
    },
  },
}));

vi.mock('@/config/guestMode.server', () => ({
  isGuestFullAccessEnabledServer: vi.fn(() => false),
}));

vi.mock('@/lib/security/security-logger', () => ({
  securityLogger: {
    logSecurityEvent: vi.fn(),
    logAuthFailure: vi.fn(),
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { resolveSupervisorInternalDisclosureMode } from '@/app/api/ai/supervisor/internal-disclosure-mode';
// Import after mocks
import { isGuestFullAccessEnabledServer } from '@/config/guestMode.server';
import { checkAPIAuth, getAPIAuthContext, withAuth } from '@/lib/auth/api-auth';
import { createGuestSessionProof } from '@/lib/auth/guest-session-proof.server';
import { GUEST_AUTH_PROOF_COOKIE_KEY } from '@/lib/auth/guest-session-utils';

describe('Auth Middleware Integration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.SESSION_SECRET = 'test-session-secret-for-auth-integration';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetAllMocks();
  });

  describe('checkAPIAuth', () => {
    describe('개발 환경', () => {
      it('NODE_ENV=development에서 인증 우회', async () => {
        // Given
        process.env.NODE_ENV = 'development';
        const request = new NextRequest('http://localhost:3000/api/test');

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeNull();
        expect(getAPIAuthContext(request)).toMatchObject({
          authType: 'development',
        });
      });

      it('NODE_ENV=test에서 인증 우회', async () => {
        // Given
        process.env.NODE_ENV = 'test';
        const request = new NextRequest('http://localhost:3000/api/test');

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeNull();
        expect(getAPIAuthContext(request)).toMatchObject({
          authType: 'test',
        });
      });
    });

    describe('게스트 풀 액세스 모드', () => {
      it('게스트 모드 활성화 시 인증 우회', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(true);
        const request = new NextRequest('http://localhost:3000/api/test');

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeNull();
        expect(isGuestFullAccessEnabledServer).toHaveBeenCalled();
      });
    });

    describe('게스트 세션 쿠키 인증', () => {
      it('제한 모드에서도 서명 검증된 guest 세션 쿠키가 있으면 인증 통과', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);
        const sessionId = 'guest-session-abc-123';
        const proof = createGuestSessionProof(sessionId);
        expect(proof).toBeTruthy();
        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: {
            Cookie: `auth_session_id=${sessionId}; ${GUEST_AUTH_PROOF_COOKIE_KEY}=${proof}`,
          },
        });

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeNull();
        expect(getAPIAuthContext(request)).toMatchObject({
          authType: 'guest',
          userId: sessionId,
        });
      });

      it('proof 쿠키가 없으면 401을 반환한다', async () => {
        process.env.NODE_ENV = 'production';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);
        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: {
            Cookie: 'auth_session_id=guest-session-abc-123',
          },
        });

        const result = await checkAPIAuth(request);

        expect(result).toBeInstanceOf(NextResponse);
        if (result) {
          expect(result.status).toBe(401);
        }
      });
    });

    describe('E2E 테스트 인증', () => {
      it('x-test-secret 헤더로 인증 우회', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        process.env.TEST_SECRET_KEY = 'valid-test-secret-123';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);

        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-test-secret': 'valid-test-secret-123' },
        });

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeNull();
        expect(getAPIAuthContext(request)).toMatchObject({
          authType: 'test-secret',
        });
      });

      it('검증된 x-test-secret만 supervisor developer disclosure로 승격한다', async () => {
        process.env.NODE_ENV = 'production';
        process.env.TEST_SECRET_KEY = 'valid-test-secret-123';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);

        const validRequest = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-test-secret': 'valid-test-secret-123' },
        });
        const invalidRequest = new NextRequest(
          'http://localhost:3000/api/test',
          {
            headers: { 'x-test-secret': 'wrong-secret' },
          }
        );

        expect(await checkAPIAuth(validRequest)).toBeNull();
        expect(
          resolveSupervisorInternalDisclosureMode(
            getAPIAuthContext(validRequest)
          )
        ).toBe('developer');

        const invalidResult = await checkAPIAuth(invalidRequest);
        expect(invalidResult).toBeInstanceOf(NextResponse);
        expect(getAPIAuthContext(invalidRequest)).toMatchObject({
          authType: 'unknown',
        });
        expect(
          resolveSupervisorInternalDisclosureMode(
            getAPIAuthContext(invalidRequest)
          )
        ).toBeUndefined();
      });

      it('잘못된 x-test-secret은 인증 실패', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        process.env.TEST_SECRET_KEY = 'valid-test-secret-123';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);

        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-test-secret': 'wrong-secret' },
        });

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeInstanceOf(NextResponse);
        if (result) {
          expect(result.status).toBe(401);
        }
      });
    });

    describe('API 키 인증', () => {
      it('유효한 x-api-key로 인증 성공', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        process.env.TEST_API_KEY = 'valid-api-key-abc123';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);

        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-api-key': 'valid-api-key-abc123' },
        });

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeNull();
        expect(getAPIAuthContext(request)).toMatchObject({
          authType: 'api-key',
        });
        expect(getAPIAuthContext(request)?.keyFingerprint).toBeTruthy();
      });

      it('잘못된 x-api-key는 401 반환', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        process.env.TEST_API_KEY = 'valid-api-key-abc123';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);

        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-api-key': 'wrong-api-key' },
        });

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeInstanceOf(NextResponse);
        if (result) {
          expect(result.status).toBe(401);
          const data = await result.json();
          expect(data.error).toContain('Unauthorized');
        }
      });

      it('API 키 길이 초과 시 거부', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        process.env.TEST_API_KEY = 'valid-key';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);

        const longKey = 'a'.repeat(300); // MAX_KEY_LENGTH(256) 초과
        const request = new NextRequest('http://localhost:3000/api/test', {
          headers: { 'x-api-key': longKey },
        });

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeInstanceOf(NextResponse);
        if (result) {
          expect(result.status).toBe(401);
        }
      });
    });

    describe('Supabase 세션 인증', () => {
      it('유효한 Supabase 세션으로 인증 성공', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);
        mockGetUser.mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });

        const request = new NextRequest('http://localhost:3000/api/test');

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeNull();
        expect(getAPIAuthContext(request)).toMatchObject({
          authType: 'supabase',
          userId: 'user-123',
        });
      });

      it('Supabase 세션 만료 시 401 반환', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);
        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Session expired' },
        });

        const request = new NextRequest('http://localhost:3000/api/test');

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeInstanceOf(NextResponse);
        if (result) {
          expect(result.status).toBe(401);
          const data = await result.json();
          expect(data.error).toContain('Unauthorized');
          expect(data.error).toContain('login');
        }
      });

      it('세션 없으면 401 반환', async () => {
        // Given
        process.env.NODE_ENV = 'production';
        vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);
        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const request = new NextRequest('http://localhost:3000/api/test');

        // When
        const result = await checkAPIAuth(request);

        // Then
        expect(result).toBeInstanceOf(NextResponse);
        if (result) {
          expect(result.status).toBe(401);
          const data = await result.json();
          expect(data.error).toContain('Unauthorized');
          expect(data.error).toContain('login');
        }
      });
    });
  });

  describe('withAuth wrapper', () => {
    it('인증 성공 시 핸들러 실행', async () => {
      // Given
      process.env.NODE_ENV = 'development';
      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/api/test');

      // When
      const response = await wrappedHandler(request);

      // Then
      expect(mockHandler).toHaveBeenCalledWith(request);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('인증 실패 시 핸들러 실행 안함', async () => {
      // Given
      process.env.NODE_ENV = 'production';
      vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(false);

      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ success: true }));
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/api/test');

      // When
      const response = await wrappedHandler(request);

      // Then
      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });

    it('동적 라우트 context 전달', async () => {
      // Given
      process.env.NODE_ENV = 'development';
      const mockHandler = vi
        .fn()
        .mockResolvedValue(NextResponse.json({ id: '123' }));
      const wrappedHandler = withAuth<{ params: { id: string } }>(mockHandler);
      const request = new NextRequest(
        'http://localhost:3000/api/servers/server-123'
      );
      const context = { params: { id: 'server-123' } };

      // When
      const response = await wrappedHandler(request, context);

      // Then
      expect(mockHandler).toHaveBeenCalledWith(request, context);
      const data = await response.json();
      expect(data.id).toBe('123');
    });
  });

  describe('인증 우선순위', () => {
    it('개발환경 > 게스트모드 > E2E > API키 > 세션 순서', async () => {
      // Given - 모든 인증 수단이 있는 상태에서 개발환경 우선
      process.env.NODE_ENV = 'development';
      process.env.TEST_SECRET_KEY = 'secret';
      process.env.TEST_API_KEY = 'api-key';
      vi.mocked(isGuestFullAccessEnabledServer).mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-test-secret': 'wrong',
          'x-api-key': 'wrong',
          Cookie: 'next-auth.session-token=valid',
        },
      });

      // When
      const result = await checkAPIAuth(request);

      // Then - 개발환경이므로 모든 인증 우회
      expect(result).toBeNull();
    });
  });
});
