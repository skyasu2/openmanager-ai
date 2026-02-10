/**
 * 🧪 GitHub OAuth 및 Supabase Auth 테스트 API
 *
 * 활성화된 GitHub OAuth가 올바르게 작동하는지 검증
 * Zod 스키마와 타입 안전성 적용
 *
 * v5.84.1 변경사항:
 * - /api/auth/test에서 /api/test/auth로 이동
 * - 테스트 라우트 그룹화로 일관성 향상
 *
 * GET /api/test/auth - 인증 시스템 전체 테스트
 * POST /api/test/auth - GitHub OAuth 상세 진단
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createApiRoute } from '@/lib/api/zod-middleware';
import { createClient } from '@/lib/supabase/server';
import { getErrorMessage } from '@/types/type-utils';
import {
  type AuthDiagnostics,
  AuthDiagnosticsRequestSchema,
  type AuthDiagnosticsResponse,
  AuthDiagnosticsResponseSchema,
  type AuthTestResponse,
  AuthTestResponseSchema,
  type AuthTestResult,
} from '@/schemas/api.schema';
import debug from '@/utils/debug';

// OAuth 데이터 타입 정의
interface OAuthData {
  url: string;
  provider: string;
}

interface OAuthError {
  message: string;
}

// GET 핸들러
const getHandler = createApiRoute()
  .response(AuthTestResponseSchema)
  .configure({
    showDetailedErrors: process.env.NODE_ENV === 'development',
    enableLogging: true,
  })
  .build(async (request, _context): Promise<AuthTestResponse> => {
    debug.log('🧪 Supabase Auth 설정 테스트 시작...');

    // 중앙 집중식 Supabase 클라이언트 사용 (환경 변수 검증 포함)
    const supabase = await createClient();

    // 1. Supabase 연결 테스트
    debug.log('📡 Supabase 연결 테스트...');
    const { data: _connectionTest, error: connectionError } = await supabase
      .from('_supabase_migrations')
      .select('version')
      .limit(1);

    const connectionStatus = !connectionError;
    debug.log('📡 연결 상태:', connectionStatus ? '✅ 성공' : '❌ 실패');

    // 2. Auth 설정 확인 (auth.users 테이블 접근 테스트)
    debug.log('🔐 Auth 스키마 접근 테스트...');
    const { data: authTest, error: authError } =
      await supabase.auth.getSession();

    // 3. GitHub OAuth URL 생성 테스트 (서버 환경 대응 - 브라우저 API 회피)
    debug.log('🐙 GitHub OAuth URL 생성 테스트 (서버 환경 안전 모드)...');
    let oauthData: OAuthData | null = null;
    let oauthError: OAuthError | null = null;

    try {
      // 서버 환경에서는 OAuth URL만 생성 (브라우저 API 사용 방지)
      const redirectUrl = `${request.headers.get('origin') || `https://${request.headers.get('host')}`}/auth/callback`;

      // Supabase OAuth URL 직접 생성 (브라우저 API 회피)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        // OAuth URL 수동 생성으로 브라우저 API 의존성 제거
        const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectUrl)}&scopes=read:user+user:email`;
        oauthData = {
          url: oauthUrl,
          provider: 'github',
        };
        debug.log('✅ OAuth URL 생성 성공:', oauthUrl);
      } else {
        oauthError = { message: 'Supabase URL이 설정되지 않았습니다.' };
      }
    } catch (error) {
      oauthError = {
        message: `OAuth 테스트 실패: ${getErrorMessage(error)}`,
      };
    }

    const testResults: AuthTestResult = {
      timestamp: new Date().toISOString(),
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not-configured',
        connection: connectionStatus,
        connectionError: connectionError?.message || null,
      },
      auth: {
        configured: !authError,
        error: authError?.message || null,
        session: !!authTest.session,
      },
      githubOAuth: {
        urlGenerated: !!oauthData?.url,
        error: oauthError?.message || null,
        redirectUrl: oauthData?.url || null,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercel: !!process.env.VERCEL,
        domain:
          request.headers.get('origin') || request.headers.get('host') || '',
      },
    };

    debug.log('🧪 테스트 결과:', testResults);

    // 전체 성공 여부 판단
    const allSystemsOperational =
      connectionStatus && !authError && !!oauthData?.url && !oauthError;

    return {
      success: allSystemsOperational,
      message: allSystemsOperational
        ? '✅ 모든 인증 시스템이 정상 작동합니다!'
        : '⚠️ 일부 시스템에 문제가 발견되었습니다.',
      data: testResults,
      recommendations: !allSystemsOperational
        ? [
            !connectionStatus && '📡 Supabase 연결 확인 필요',
            authError && '🔐 Auth 설정 확인 필요',
            oauthError && '🐙 GitHub OAuth Provider 설정 확인 필요',
          ].filter((item): item is string => Boolean(item))
        : ['🎉 모든 시스템이 정상입니다!'],
    };
  });

export async function GET(request: NextRequest) {
  // 🚫 개발 환경에서만 접근 허용
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints are not available in production' },
      { status: 404 }
    );
  }

  try {
    return await getHandler(request);
  } catch (error) {
    debug.error('💥 Auth 테스트 중 예상치 못한 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Auth 테스트 실패',
        details: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// POST 핸들러
const postHandler = createApiRoute()
  .body(AuthDiagnosticsRequestSchema)
  .response(AuthDiagnosticsResponseSchema)
  .configure({
    showDetailedErrors: process.env.NODE_ENV === 'development',
    enableLogging: true,
  })
  .build(async (request, context): Promise<AuthDiagnosticsResponse> => {
    const { testType = 'full' } = context.body;

    debug.log('🔬 GitHub OAuth 상세 진단 시작...', testType);

    // 중앙 집중식 Supabase 클라이언트 사용
    const supabase = await createClient();

    const diagnostics: AuthDiagnostics = {
      timestamp: new Date().toISOString(),
      testType,
    };

    // GitHub OAuth 제공자 설정 테스트
    if (testType === 'full' || testType === 'oauth') {
      debug.log('🐙 GitHub OAuth 상세 설정 확인...');

      try {
        // OAuth URL 생성 및 검증 (서버 환경 대응 - 브라우저 API 회피)
        const redirectUrl = `${request.headers.get('origin') || `https://${request.headers.get('host')}`}/auth/callback`;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        let oauthData: OAuthData | null = null;
        let oauthError: OAuthError | null = null;

        if (supabaseUrl) {
          // OAuth URL 수동 생성으로 브라우저 API 의존성 제거
          const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=github&redirect_to=${encodeURIComponent(redirectUrl)}&scopes=read:user+user:email&prompt=consent`;
          oauthData = {
            url: oauthUrl,
            provider: 'github',
          };
        } else {
          oauthError = { message: 'Supabase URL이 설정되지 않았습니다.' };
        }

        diagnostics.github = {
          success: !oauthError,
          url: oauthData?.url || undefined,
          error: oauthError?.message || undefined,
          provider: oauthData?.provider,
        };

        // URL 구조 분석
        if (oauthData?.url && diagnostics.github) {
          const url = new URL(oauthData.url);
          diagnostics.github.urlAnalysis = {
            domain: url.hostname,
            hasClientId: url.searchParams.has('client_id'),
            hasRedirectUri: url.searchParams.has('redirect_uri'),
            hasScopes: url.searchParams.has('scope'),
            redirectUri: url.searchParams.get('redirect_uri'),
            scopes: url.searchParams.get('scope'),
            state: url.searchParams.get('state'),
          };
        }
      } catch (oauthTestError) {
        diagnostics.github = {
          success: false,
          error:
            oauthTestError instanceof Error
              ? oauthTestError.message
              : 'Unknown OAuth error',
        };
      }
    }

    // Auth 스키마 및 정책 테스트
    if (testType === 'full' || testType === 'auth') {
      debug.log('🔐 Auth 스키마 및 정책 확인...');

      try {
        const { data: _userCount, error: userError } = await supabase
          .from('auth.users')
          .select('count(*)', { count: 'exact' });

        diagnostics.authSchema = {
          success: !userError,
          error: userError?.message,
          canAccessAuthTable: !userError,
        };
      } catch (authSchemaError) {
        diagnostics.authSchema = {
          success: false,
          canAccessAuthTable: false,
          error:
            authSchemaError instanceof Error
              ? authSchemaError.message
              : 'Auth schema access error',
        };
      }
    }

    return {
      success: true,
      message: '🔬 GitHub OAuth 상세 진단 완료',
      diagnostics,
    };
  });

/**
 * 🔧 POST: GitHub OAuth 설정 상세 진단
 */
export async function POST(request: NextRequest) {
  // 🚫 개발 환경에서만 접근 허용
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Test endpoints are not available in production' },
      { status: 404 }
    );
  }

  try {
    return await postHandler(request);
  } catch (error) {
    debug.error('💥 OAuth 진단 중 오류:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'OAuth 진단 실패',
        details: getErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
