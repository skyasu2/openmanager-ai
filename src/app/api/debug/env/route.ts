/**
 * 🔍 환경변수 진단 API
 *
 * Vercel 프로덕션 환경에서 AI API 실패 문제 해결을 위한
 * 환경변수 상태 진단 엔드포인트
 *
 * GET /api/debug/env
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { env, features, isProduction, isVercelProduction } from '@/env';
import type { AuthenticatedRequest } from '@/lib/api/auth-middleware';
import { withAdminAuth } from '@/lib/api/auth-middleware';
import { developmentOnly } from '@/lib/api/development-only';
import { logger } from '@/lib/logging';
import { getErrorMessage } from '@/types/type-utils';

async function handler(request: AuthenticatedRequest): Promise<Response> {
  try {
    // SECURITY: 민감한 정보 완전 제거 - 존재 여부만 확인
    const sanitizedEnv = {
      NODE_ENV: env.NODE_ENV,
      VERCEL_ENV: env.VERCEL_ENV,

      // 필수 환경변수 존재 여부만 확인 (값 노출 금지)
      hasSupabaseUrl: !!env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseAnonKey: !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasSupabaseServiceKey: !!env.SUPABASE_SERVICE_ROLE_KEY,
      hasSupabaseProjectId: !!env.SUPABASE_PROJECT_ID,

      hasCloudRunAI: true, // Cloud Run AI는 외부 키 불필요 (GCP 인증)
      hasTavilyKey: !!env.TAVILY_API_KEY,
      hasGithubOAuth: !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET,
      hasGithubToken: !!env.GITHUB_TOKEN,
      hasGcpProjectId: !!env.GCP_PROJECT_ID,

      // SECURITY: 민감한 데이터 미리보기 완전 제거
      // 개발/프로덕션 구분 없이 값 노출 금지
    };

    const diagnostics = {
      environment: {
        isProduction,
        isVercelProduction,
        nodeEnv: env.NODE_ENV,
        vercelEnv: env.VERCEL_ENV,
      },

      features,

      envStatus: sanitizedEnv,

      // AI API 관련 핵심 환경변수 체크
      aiReadiness: {
        localAiReady: features.supabase,
        googleAiReady: features.ai,
        searchReady: features.search,
        overallReady: features.supabase && (features.ai || features.search),
      },

      missingCritical: [
        ...(!features.supabase ? ['Supabase Database Connection'] : []),
        ...(!features.ai && !features.search
          ? ['AI Service (Cloud Run AI or Tavily)']
          : []),
      ],

      timestamp: new Date().toISOString(),
      auditInfo: {
        accessedBy: request.authInfo?.userId,
        sessionId: request.authInfo?.sessionId,
        userRole: request.authInfo?.userRole,
      },
    };

    // 진단 결과에 따른 HTTP 상태 코드
    const hasAnyAiService = features.ai || features.search;
    const status = features.supabase && hasAnyAiService ? 200 : 503;

    const response = {
      success: status === 200,
      message:
        status === 200
          ? 'All critical environment variables are configured'
          : 'Missing critical environment variables for AI functionality',
      diagnostics,
    };

    return NextResponse.json(response, {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Environment': isProduction ? 'production' : 'development',
        'X-AI-Ready': hasAnyAiService ? 'true' : 'false',
        'X-Access-Level': 'admin',
      },
    });
  } catch (error) {
    logger.error('Environment diagnostics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Environment diagnostics failed',
        message: getErrorMessage(error),
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

const authedHandler = withAdminAuth(handler);

export const GET = developmentOnly((request: NextRequest) =>
  authedHandler(request)
);

/**
 * 보안상의 이유로 POST/PUT/DELETE 방법은 허용하지 않음
 */
export function POST() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
    },
    { status: 405 }
  );
}
