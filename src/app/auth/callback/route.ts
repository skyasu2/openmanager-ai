/**
 * 🔐 OAuth Callback Route Handler (Server-side PKCE)
 *
 * Supabase OAuth 콜백을 서버에서 처리
 * - PKCE code_verifier가 쿠키에서 읽혀짐
 * - 코드 교환 후 세션 쿠키 설정
 * - 메인 페이지로 리다이렉트
 *
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import {
  normalizeOAuthProvider,
  recordLoginEvent,
} from '@/lib/auth/login-audit';
import { logger } from '@/lib/logging';

function sanitizeRedirectPath(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith('/')) return null;
  if (path.startsWith('//')) return null;
  if (path.includes('\n') || path.includes('\r')) return null;
  return path;
}

function getRequestedOAuthProvider(requestUrl: URL): string | null {
  return (
    requestUrl.searchParams.get('provider') ||
    requestUrl.searchParams.get('oauth_provider') ||
    null
  );
}

async function recordOAuthFailureEvent(params: {
  request: NextRequest;
  requestUrl: URL;
  reason: string;
  errorMessage: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await recordLoginEvent({
    request: params.request,
    provider: normalizeOAuthProvider(
      getRequestedOAuthProvider(params.requestUrl)
    ),
    success: false,
    errorMessage: params.errorMessage,
    metadata: {
      reason: params.reason,
      ...params.metadata,
    },
  });
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const nextPath =
    sanitizeRedirectPath(requestUrl.searchParams.get('next')) ||
    sanitizeRedirectPath(requestUrl.searchParams.get('redirectTo')) ||
    '/main';

  logger.info('🔐 OAuth 콜백 수신 (Server-side):', {
    hasCode: !!code,
    hasError: !!error,
    origin: requestUrl.origin,
  });

  // OAuth 에러 처리
  if (error) {
    logger.error('❌ OAuth 에러:', error, errorDescription);
    await recordOAuthFailureEvent({
      request,
      requestUrl,
      reason: 'oauth_callback_error',
      errorMessage: errorDescription || error,
      metadata: {
        oauthError: error,
      },
    });

    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', error);
    if (errorDescription) {
      loginUrl.searchParams.set('message', errorDescription);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 코드가 없으면 로그인 페이지로
  if (!code) {
    logger.info('⚠️ 인증 코드 없음 - 로그인 페이지로 이동');
    return NextResponse.redirect(new URL('/login', requestUrl.origin));
  }

  try {
    const cookieStore = await cookies();
    // trim()으로 환경 변수의 불필요한 공백/줄바꿈 제거
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      '';

    if (!supabaseUrl || !supabaseKey) {
      logger.error('❌ Supabase 환경 변수 누락');
      const loginUrl = new URL('/login', requestUrl.origin);
      loginUrl.searchParams.set('error', 'config_error');
      return NextResponse.redirect(loginUrl);
    }

    // 응답 객체 생성 (쿠키 설정용)
    const response = NextResponse.redirect(
      new URL(nextPath, requestUrl.origin)
    );

    // 서버 클라이언트 생성 (쿠키 읽기/쓰기 가능)
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // PKCE 코드 교환
    logger.info('🔑 PKCE 코드 교환 시작...');
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      logger.error('❌ 코드 교환 실패:', exchangeError.message);
      await recordOAuthFailureEvent({
        request,
        requestUrl,
        reason: 'oauth_code_exchange_failed',
        errorMessage: exchangeError.message,
      });

      const loginUrl = new URL('/login', requestUrl.origin);
      loginUrl.searchParams.set('error', 'exchange_failed');
      loginUrl.searchParams.set('message', exchangeError.message);
      return NextResponse.redirect(loginUrl);
    }

    if (!data.session) {
      logger.error('❌ 세션 생성 실패');
      await recordOAuthFailureEvent({
        request,
        requestUrl,
        reason: 'oauth_session_missing',
        errorMessage: 'OAuth exchange succeeded but session is missing',
      });

      const loginUrl = new URL('/login', requestUrl.origin);
      loginUrl.searchParams.set('error', 'no_session');
      return NextResponse.redirect(loginUrl);
    }

    logger.info('✅ OAuth 로그인 성공:', {
      userId: data.session.user.id,
      provider: data.session.user.app_metadata?.provider,
    });

    await recordLoginEvent({
      request,
      provider: normalizeOAuthProvider(
        data.session.user.app_metadata?.provider
      ),
      success: true,
      userId: data.session.user.id,
      userEmail: data.session.user.email ?? null,
      metadata: {
        reason: 'oauth_callback_success',
      },
    });

    // 게스트 쿠키 정리
    response.cookies.delete('guest_session_id');
    response.cookies.delete('auth_session_id');
    response.cookies.delete('auth_type');

    // 🚀 Cloud Run 선제 웜업: OAuth 성공 즉시 서버 사이드에서 발사
    // 사용자가 /main → 시스템 시작 → 대시보드까지 가는 동안 cold start 해소
    const cloudRunUrl = process.env.CLOUD_RUN_AI_URL;
    if (cloudRunUrl) {
      const warmupStartedAt = Date.now();
      logger.info(
        {
          event: 'warmup_started',
          source: 'oauth_callback',
        },
        '[AI Warmup] Started'
      );

      void fetch(`${cloudRunUrl}/warmup`, {
        method: 'GET',
        signal: AbortSignal.timeout(10_000),
      })
        .then((warmupResponse) => {
          logger.info(
            {
              event: warmupResponse.ok
                ? 'warmup_ready'
                : 'warmup_upstream_not_ready',
              source: 'oauth_callback',
              warmup_latency_ms: Date.now() - warmupStartedAt,
              upstream_status: warmupResponse.status,
            },
            warmupResponse.ok
              ? '[AI Warmup] Ready'
              : '[AI Warmup] Upstream not ready'
          );
        })
        .catch((warmupError: unknown) => {
          logger.warn(
            {
              event: 'warmup_failed',
              source: 'oauth_callback',
              warmup_latency_ms: Date.now() - warmupStartedAt,
              error_name:
                warmupError instanceof Error
                  ? warmupError.name
                  : 'UnknownError',
              error_message:
                warmupError instanceof Error
                  ? warmupError.message
                  : String(warmupError),
            },
            '[AI Warmup] Failed'
          );
        });
    }

    return response;
  } catch (error) {
    logger.error('❌ 콜백 처리 예외:', error);
    await recordOAuthFailureEvent({
      request,
      requestUrl,
      reason: 'oauth_callback_exception',
      errorMessage:
        error instanceof Error ? error.message : 'Unknown callback exception',
    });

    const loginUrl = new URL('/login', requestUrl.origin);
    loginUrl.searchParams.set('error', 'callback_exception');
    return NextResponse.redirect(loginUrl);
  }
}
