/**
 * 🚨 Auth Error Handler API
 *
 * Supabase Auth 에러 처리를 위한 엔드포인트
 * GitHub / Google / 이메일 인증 실패 시 이 경로로 리다이렉트됩니다.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { debug } from '@/utils/debug';

export function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const error = searchParams.get('error');
  const error_code = searchParams.get('error_code');
  const error_description = searchParams.get('error_description');

  debug.error('🚨 Auth Error:', {
    error,
    error_code,
    error_description,
    url: request.url,
  });

  // 에러 타입에 따른 사용자 친화적 메시지
  let userMessage = '인증 중 오류가 발생했습니다.';

  if (error === 'access_denied') {
    userMessage = '로그인이 취소되었습니다.';
  } else if (error === 'server_error') {
    userMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
  } else if (
    error_description?.includes('Email address') &&
    error_description?.includes('already registered')
  ) {
    userMessage = '이미 등록된 이메일 주소입니다.';
  } else if (error_description) {
    userMessage = error_description;
  }

  // 로그인 페이지로 리다이렉트 (에러 메시지 포함)
  const redirectUrl = new URL('/login', request.url);
  redirectUrl.searchParams.set('error', error || 'unknown_error');
  redirectUrl.searchParams.set('message', userMessage);

  return NextResponse.redirect(redirectUrl);
}

// POST 메서드도 지원 (일부 OAuth 제공자는 POST 사용)
export function POST(request: NextRequest) {
  return GET(request);
}
