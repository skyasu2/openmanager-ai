/**
 * 🔐 간단한 API 보호 미들웨어
 *
 * 포트폴리오용 기본 보안 - 민감한 API만 보호
 */

import { timingSafeEqual } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { SECURITY } from '@/config/constants';
import { isGuestFullAccessEnabledServer } from '@/config/guestMode.server';
import { logger } from '@/lib/logging';
import { createClient } from '@/lib/supabase/server';
import { securityLogger } from '../security/security-logger';

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
    return null; // 개발환경에서 인증 우회
  }

  // 🎭 게스트 풀 액세스 모드: 로그인 없이도 AI 기능 사용 허용
  if (isGuestFullAccessEnabledServer()) {
    return null; // 게스트 풀 액세스 활성화 시 인증 우회
  }

  // 🧪 E2E 테스트 헤더 확인 (Playwright 테스트용)
  const testSecret = request.headers.get('x-test-secret');
  const envTestSecret = process.env.TEST_SECRET_KEY;

  if (testSecret && envTestSecret && testSecret === envTestSecret) {
    logger.info('✅ [API Auth] E2E 테스트 모드 바이패스 활성화');
    return null; // E2E 테스트 인증 통과
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
 * 관리자 전용 API 보호
 * - 현재는 로그인만 확인 (포트폴리오용이므로 복잡한 권한 체계 없음)
 */
export function withAdminAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return withAuth(handler); // 포트폴리오용이므로 일반 인증과 동일
}
