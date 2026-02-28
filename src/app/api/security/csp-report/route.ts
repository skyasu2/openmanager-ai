import { type NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders } from '@/lib/api/cors';
import { logger } from '@/lib/logging';

// Edge Runtime 사용 (빠른 응답, 낮은 비용)
// CSP 리포트는 실시간성이 덜 중요 - Node.js Runtime 사용

/**
 * CSP 위반 리포트 수집 API
 * 무료 티어 최적화: 로깅만 하고 별도 저장소 사용 안 함
 */
export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const timestamp = new Date().toISOString();

    // CSP 위반 리포트 파싱
    const report = await request.json();

    // 📊 기본 로깅 (Vercel 함수 로그로 수집)
    logger.warn('🛡️ CSP Violation Report:', {
      timestamp,
      ip: ip.split(',')[0], // 첫 번째 IP만 사용
      userAgent: userAgent.substring(0, 100), // 길이 제한
      violation: {
        documentURI: report['document-uri']?.substring(0, 200),
        violatedDirective: report['violated-directive'],
        blockedURI: report['blocked-uri']?.substring(0, 200),
        sourceFile: report['source-file']?.substring(0, 200),
        lineNumber: report['line-number'],
        originalPolicy: report['original-policy']?.substring(0, 500),
      },
    });

    // 📈 간단한 통계 카운팅 (메모리 내)
    const violationType = report['violated-directive']?.split(' ')[0];

    if (violationType) {
      // 개발 환경에서만 상세 로깅
      if (process.env.NODE_ENV === 'development') {
        logger.info(`🔍 CSP Violation Type: ${violationType}`);

        // 일반적인 위반 원인 분석
        if (
          violationType === 'script-src' &&
          report['blocked-uri']?.includes('data:')
        ) {
          logger.warn(
            '💡 Suggestion: Consider using nonce or hash for inline scripts'
          );
        }

        if (
          violationType === 'style-src' &&
          report['blocked-uri']?.includes('data:')
        ) {
          logger.warn(
            '💡 Suggestion: Consider using CSS-in-JS with nonce or external stylesheets'
          );
        }
      }
    }

    // ⚡ 빠른 응답 (무료 티어 최적화)
    return new NextResponse(null, {
      status: 204, // No Content
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('❌ CSP Report Processing Error:', error);

    // 에러 상황에서도 빠른 응답
    return new NextResponse('Error', {
      status: 400,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain',
      },
    });
  }
}

/**
 * CSP 리포트 엔드포인트 상태 확인
 */
export function GET() {
  return NextResponse.json(
    {
      status: 'active',
      endpoint: '/api/security/csp-report',
      description: 'CSP violation report collector',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=3600',
        'Content-Type': 'application/json',
      },
    }
  );
}

// OPTIONS 메서드 지원 (CORS preflight)
export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin),
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
