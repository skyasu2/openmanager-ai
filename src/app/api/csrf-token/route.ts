/**
 * CSRF 토큰 발급 API
 *
 * 클라이언트가 페이지 로드 시 이 API를 호출하여 CSRF 토큰을 받습니다.
 * 토큰은 쿠키로 설정되며, 클라이언트는 이후 API 요청 시 헤더에 포함시킵니다.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging';
import { setupCSRFProtection } from '@/utils/security/csrf';

export function GET(_request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'CSRF token issued',
    });

    // CSRF 토큰 생성 및 쿠키 설정
    const token = setupCSRFProtection(response);

    logger.info(
      '✅ [CSRF API] 토큰 발급 완료:',
      `${token.substring(0, 10)}...`
    );

    return response;
  } catch (error) {
    logger.error('❌ [CSRF API] 토큰 발급 실패:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to issue CSRF token',
      },
      { status: 500 }
    );
  }
}

// MIGRATED: Removed export const runtime = 'edge';
