/**
 * 🔐 간단한 API 보호 미들웨어
 *
 * 포트폴리오용 기본 보안 - 민감한 API만 보호
 */

import { createHash, timingSafeEqual } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { SECURITY } from '@/config/constants';
import { isGuestFullAccessEnabledServer } from '@/config/guestMode.server';
import { verifyGuestSessionProof } from '@/lib/auth/guest-session-proof.server';
import {
  AUTH_SESSION_ID_KEY,
  GUEST_AUTH_PROOF_COOKIE_KEY,
  getCookieValueFromHeader,
} from '@/lib/auth/guest-session-utils';
import { logger } from '@/lib/logging';
import { createClient } from '@/lib/supabase/server';
import { securityLogger } from '../security/security-logger';

export type APIAuthType =
  | 'development'
  | 'test'
  | 'guest'
  | 'test-secret'
  | 'api-key'
  | 'supabase'
  | 'unknown';

export interface APIAuthContext {
  authType: APIAuthType;
  userId?: string;
  keyFingerprint?: string;
}

const apiAuthContextMap = new WeakMap<NextRequest, APIAuthContext>();

function setAPIAuthContext(
  request: NextRequest,
  context: APIAuthContext
): void {
  apiAuthContextMap.set(request, context);
}

export function getAPIAuthContext(request: NextRequest): APIAuthContext | null {
  return apiAuthContextMap.get(request) ?? null;
}

function fingerprintSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

/**
 * API 인증 확인
 * - GitHub OAuth 로그인 여부만 확인
 * - 복잡한 권한 시스템 없음
 * - 테스트용 API 키 지원 (프로덕션 환경에서 외부 도구 테스트용)
 * - 게스트 풀 액세스 모드 지원 (NEXT_PUBLIC_GUEST_FULL_ACCESS=true)
 *
 * ⚠️ 보안 참고:
 * - API 키 인증 시 사용자 세션 컨텍스트 없음
 * - 다른 로직에서 session.user.id 사용 시 에러 발생 가능
 * - 테스트 목적으로만 사용 권장
 * - TEST_API_KEY 길이는 앱 시작 시점에 검증됨 (instrumentation.ts)
 * - 게스트 풀 액세스 모드 시 AI 기능 등 모든 API 접근 허용
 */
export async function checkAPIAuth(request: NextRequest) {
  // 개발 환경에서는 AI 테스트를 위해 인증 우회
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test'
  ) {
    setAPIAuthContext(request, {
      authType: process.env.NODE_ENV === 'test' ? 'test' : 'development',
    });
    return null; // 개발환경에서 인증 우회
  }

  // 🎭 게스트 풀 액세스 모드: 로그인 없이도 AI 기능 사용 허용
  if (isGuestFullAccessEnabledServer()) {
    setAPIAuthContext(request, { authType: 'guest' });
    return null; // 게스트 풀 액세스 활성화 시 인증 우회
  }

  // 게스트 세션 쿠키가 있으면 제한 모드에서도 API 접근 허용
  const cookieHeader = request.headers.get('cookie') ?? '';
  const guestSessionId = getCookieValueFromHeader(
    cookieHeader,
    AUTH_SESSION_ID_KEY
  );
  const guestSessionProof = getCookieValueFromHeader(
    cookieHeader,
    GUEST_AUTH_PROOF_COOKIE_KEY
  );

  if (guestSessionId && guestSessionProof) {
    const verifiedProof = verifyGuestSessionProof(guestSessionProof);
    if (verifiedProof && verifiedProof.sessionId === guestSessionId) {
      setAPIAuthContext(request, {
        authType: 'guest',
        userId: guestSessionId,
      });
      return null;
    }

    logger.warn('[API Auth] Invalid guest session proof detected');
  }

  // 🧪 E2E 테스트 헤더 확인 (Playwright 테스트용)
  const testSecret = request.headers.get('x-test-secret');
  const envTestSecret = process.env.TEST_SECRET_KEY;

  if (testSecret && envTestSecret) {
    const testSecretBuffer = Buffer.from(testSecret);
    const envTestSecretBuffer = Buffer.from(envTestSecret);
    const maxLen = Math.max(
      testSecretBuffer.length,
      envTestSecretBuffer.length
    );
    const paddedTestSecret = Buffer.alloc(maxLen);
    const paddedEnvTestSecret = Buffer.alloc(maxLen);
    testSecretBuffer.copy(paddedTestSecret);
    envTestSecretBuffer.copy(paddedEnvTestSecret);

    if (timingSafeEqual(paddedTestSecret, paddedEnvTestSecret)) {
      logger.info('✅ [API Auth] E2E 테스트 모드 바이패스 활성화');
      setAPIAuthContext(request, { authType: 'test-secret' });
      return null; // E2E 테스트 인증 통과
    }
  }

  // 🔑 테스트용 API 키 확인 (프로덕션 환경에서 Postman/curl 테스트용)
  const apiKey = request.headers.get('x-api-key');
  const envApiKey = process.env.TEST_API_KEY;

  if (apiKey && envApiKey) {
    // 보안: DoS 방지 - API 키 길이 상한
    if (apiKey.length > SECURITY.API.MAX_KEY_LENGTH) {
      const ip =
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for') ||
        'unknown';
      securityLogger.logSecurityEvent({
        type: 'invalid_key',
        ip,
        details: `API key too long: ${apiKey.length} characters (max: ${SECURITY.API.MAX_KEY_LENGTH})`,
      });
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      );
    }

    // 보안: 타이밍 공격 완전 방어 (constant-time comparison + 패딩)
    try {
      const keyBuffer = Buffer.from(apiKey);
      const envKeyBuffer = Buffer.from(envApiKey);

      // 타이밍 공격 방어 강화: 길이가 다를 때도 동일한 경로로 처리
      const maxLength = Math.max(keyBuffer.length, envKeyBuffer.length);
      const paddedKeyBuffer = Buffer.alloc(maxLength);
      const paddedEnvKeyBuffer = Buffer.alloc(maxLength);

      keyBuffer.copy(paddedKeyBuffer);
      envKeyBuffer.copy(paddedEnvKeyBuffer);

      // 타이밍 안전한 비교
      if (timingSafeEqual(paddedKeyBuffer, paddedEnvKeyBuffer)) {
        setAPIAuthContext(request, {
          authType: 'api-key',
          keyFingerprint: fingerprintSecret(apiKey),
        });
        return null; // API 키 인증 통과
      }

      // 실패 로깅 (샘플링 적용 - 로그 폭증 방지)
      const ip =
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for') ||
        'unknown';
      securityLogger.logAuthFailure(ip, 'Invalid API key');

      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      );
    } catch (error) {
      // 에러 로깅 (샘플링 없음 - 중요 이벤트)
      const ip =
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for') ||
        'unknown';
      securityLogger.logSecurityEvent({
        type: 'buffer_error',
        ip,
        details: error instanceof Error ? error.message : 'Unknown error',
      });

      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      );
    }
  }

  // Supabase 세션 검증 (JWT 서명 확인)
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      setAPIAuthContext(request, {
        authType: 'supabase',
        userId: user.id,
      });
      return null; // Supabase 인증 통과
    }

    logger.warn(
      `[API Auth] Supabase session invalid: ${error?.message || 'No user'}`
    );
  } catch (supabaseError) {
    logger.warn(
      '[API Auth] Supabase validation unavailable:',
      supabaseError instanceof Error ? supabaseError.message : supabaseError
    );
  }

  setAPIAuthContext(request, { authType: 'unknown' });
  return NextResponse.json(
    { error: 'Unauthorized - Please login first' },
    { status: 401 }
  );
}

/**
 * 간단한 API 보호 래퍼
 * 사용법:
 * export const GET = withAuth(async (request) => { ... })
 * export const GET = withAuth(async (request, context) => { ... }) // 동적 라우트
 *
 * Note: Response 타입도 지원하여 스트리밍 엔드포인트에서 사용 가능
 */
export function withAuth<T extends unknown[] = []>(
  handler: (
    request: NextRequest,
    ...args: T
  ) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest, ...args: T) => {
    const authError = await checkAPIAuth(request);
    if (authError) return authError;

    return handler(request, ...args);
  };
}

/**
 * 운영자 전용(ops-only) API 응답에 공통 스코프 헤더를 부여한다.
 * 상품 표면(product surface)이 아닌 admin/ops 라우트임을 명시해 실수로
 * 일반 사용자 UI에 노출되는 걸 방지한다.
 */
const OPS_SCOPE_HEADER = 'X-OpenManager-Api-Scope';
const OPS_SCOPE_VALUE = 'ops-only';

export function withOpsScope(
  response: NextResponse | Response
): NextResponse | Response {
  response.headers.set(OPS_SCOPE_HEADER, OPS_SCOPE_VALUE);
  return response;
}

export function withAdminAuth<T extends unknown[] = []>(
  handler: (
    request: NextRequest,
    ...args: T
  ) => Promise<NextResponse | Response>
) {
  return async (request: NextRequest, ...args: T) => {
    const response = await resolveAdminAuthResponse(request, handler, ...args);
    return withOpsScope(response);
  };
}

async function resolveAdminAuthResponse<T extends unknown[]>(
  request: NextRequest,
  handler: (
    request: NextRequest,
    ...args: T
  ) => Promise<NextResponse | Response>,
  ...args: T
): Promise<NextResponse | Response> {
  // 1. Check base API authentication
  const authError = await checkAPIAuth(request);
  if (authError) return authError;

  // 2. Additional Admin authorization check
  const context = getAPIAuthContext(request);
  if (!context) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Allow development, test environments, and server-to-server API keys
  if (
    context.authType === 'development' ||
    context.authType === 'test' ||
    context.authType === 'test-secret' ||
    context.authType === 'api-key'
  ) {
    return handler(request, ...args);
  }

  // For Supabase users, verify the admin role in metadata
  if (context.authType === 'supabase' && context.userId) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Check if user has 'admin' role in user_metadata or app_metadata
      const isAdmin =
        user?.user_metadata?.role === 'admin' ||
        user?.app_metadata?.role === 'admin';

      if (isAdmin) {
        return handler(request, ...args);
      } else {
        logger.warn(
          `[API Auth] User ${context.userId} attempted to access admin route without admin role.`
        );
        return NextResponse.json(
          { error: 'Forbidden - Admin access required' },
          { status: 403 }
        );
      }
    } catch (error) {
      logger.error('[API Auth] Error verifying admin role:', error);
      return NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
    }
  }

  // Default deny for guests or unknown auth types
  logger.warn(
    `[API Auth] Blocked admin access for authType: ${context.authType}`
  );
  return NextResponse.json(
    { error: 'Forbidden - Admin access required' },
    { status: 403 }
  );
}
