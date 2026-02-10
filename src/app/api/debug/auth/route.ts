/**
 * 🔍 인증 디버깅 API
 *
 * Vercel 환경에서 세션 상태와 쿠키 정보를 확인합니다.
 *
 * v5.84.1 변경사항:
 * - /api/auth/debug에서 /api/debug/auth로 이동
 * - 디버그 라우트 그룹화로 일관성 향상
 *
 * GET /api/debug/auth - 인증 상태 디버깅
 * POST /api/debug/auth - 세션 새로고침 테스트
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase/middleware';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/types/type-utils';
import debug from '@/utils/debug';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 🚫 개발 환경에서만 접근 허용
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints are not available in production' },
      { status: 404 }
    );
  }

  try {
    const supabase = await createClient();

    // 환경 정보
    const hostname = request.headers.get('host') || '';
    const isVercel =
      hostname.includes('vercel.app') ||
      process.env.VERCEL === '1' ||
      process.env.VERCEL_ENV !== undefined;

    // 쿠키 정보 수집
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const supabaseCookies = allCookies.filter(
      (c: { name: string; value: string }) =>
        c.name.includes('supabase') || c.name.includes('auth')
    );

    // 세션 확인 (두 가지 방법)
    let clientSessionInfo = null;
    let clientSessionError = null;
    let middlewareSessionInfo = null;
    let middlewareSessionError = null;

    // 1. 일반 클라이언트로 세션 확인
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      clientSessionInfo = session
        ? {
            userId: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
            expiresAt: session.expires_at,
            isExpired: session.expires_at
              ? new Date(session.expires_at) < new Date()
              : null,
          }
        : null;
      clientSessionError = error?.message || null;
    } catch (e) {
      clientSessionError = getErrorMessage(e);
    }

    // 2. 미들웨어 클라이언트로 세션 확인
    try {
      const response = NextResponse.next();
      const middlewareSupabase = createMiddlewareClient(
        request,
        response
      ) as SupabaseClient;
      const {
        data: { session },
        error,
      } = await middlewareSupabase.auth.getSession();
      middlewareSessionInfo = session
        ? {
            userId: session.user.id,
            email: session.user.email,
            provider: session.user.app_metadata?.provider,
            expiresAt: session.expires_at,
            isExpired: session.expires_at
              ? new Date(session.expires_at) < new Date()
              : null,
          }
        : null;
      middlewareSessionError = error?.message || null;
    } catch (e) {
      middlewareSessionError = getErrorMessage(e);
    }

    // 게스트 세션 확인
    const guestSessionId = (await cookies()).get('guest_session_id')?.value;
    const authType = (await cookies()).get('auth_type')?.value;

    // 현재 환경 정보
    const debugInfo = {
      timestamp: new Date().toISOString(),
      environment: {
        isVercel,
        hostname,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_URL: process.env.VERCEL_URL,
      },
      cookies: {
        total: allCookies.length,
        supabaseCount: supabaseCookies.length,
        supabaseCookies: supabaseCookies.map(
          (c: { name: string; value: string }) => ({
            name: c.name,
            valueLength: c.value.length,
            hasValue: !!c.value,
          })
        ),
        guestSession: {
          hasGuestSessionId: !!guestSessionId,
          authType,
        },
      },
      sessions: {
        clientSession: {
          hasSession: !!clientSessionInfo,
          info: clientSessionInfo,
          error: clientSessionError,
        },
        middlewareSession: {
          hasSession: !!middlewareSessionInfo,
          info: middlewareSessionInfo,
          error: middlewareSessionError,
        },
        matchingSessions:
          clientSessionInfo?.userId === middlewareSessionInfo?.userId,
      },
      urls: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        currentOrigin:
          request.headers.get('origin') || request.headers.get('host') || '',
      },
      github: {
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? 'SET' : 'MISSING',
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET
          ? 'SET'
          : 'MISSING',
      },
      supabase: {
        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
      },
      expectedUrls: {
        githubCallback: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`,
        appCallback: `${request.headers.get('origin') || `https://${request.headers.get('host')}`}/auth/callback`,
        loginPage: `${request.headers.get('origin') || `https://${request.headers.get('host')}`}/login`,
        mainPage: `${request.headers.get('origin') || `https://${request.headers.get('host')}`}/main`,
      },
    };

    // 로그 출력
    debug.log('🔍 Auth Debug Info:', JSON.stringify(debugInfo, null, 2));

    return NextResponse.json({
      status: 'debug_info',
      ...debugInfo,
      recommendations: [
        clientSessionInfo && !middlewareSessionInfo
          ? '⚠️ 세션이 미들웨어에서 인식되지 않습니다. 쿠키 동기화 문제일 수 있습니다.'
          : null,
        !clientSessionInfo && !middlewareSessionInfo
          ? '❌ 세션이 전혀 없습니다. 로그인이 필요합니다.'
          : null,
        isVercel && supabaseCookies.length === 0
          ? '⚠️ Vercel 환경에서 Supabase 쿠키가 없습니다. 쿠키 설정을 확인하세요.'
          : null,
        'GitHub OAuth App callback URL: ' +
          debugInfo.expectedUrls.githubCallback,
        `Supabase redirect URLs: ${debugInfo.expectedUrls.appCallback}`,
      ].filter(Boolean),
    });
  } catch (error) {
    debug.error('❌ Auth debug error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// 세션 새로고침 테스트
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.next();
    const middlewareSupabase = createMiddlewareClient(
      request,
      response
    ) as SupabaseClient;

    // 현재 세션 확인
    const currentSession = await middlewareSupabase.auth.getSession();
    debug.log('📋 현재 세션:', currentSession.data.session ? '존재' : '없음');

    // 세션 새로고침 시도
    const { data, error } = await middlewareSupabase.auth.refreshSession();

    if (error) {
      debug.error('❌ 세션 새로고침 실패:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          currentSession: !!currentSession.data.session,
        },
        { status: 400 }
      );
    }

    debug.log('✅ 세션 새로고침 성공');

    return NextResponse.json({
      success: true,
      hasSession: !!data.session,
      sessionInfo: data.session
        ? {
            userId: data.session.user.id,
            email: data.session.user.email,
            expiresAt: data.session.expires_at,
          }
        : null,
      previousSession: !!currentSession.data.session,
    });
  } catch (error) {
    debug.error('❌ Session refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
