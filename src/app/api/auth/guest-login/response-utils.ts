import { NextResponse } from 'next/server';
import {
  AUTH_SESSION_ID_KEY,
  AUTH_TYPE_KEY,
  GUEST_AUTH_PROOF_COOKIE_KEY,
  LEGACY_GUEST_SESSION_COOKIE_KEY,
} from '@/lib/auth/guest-session-utils';

export function createGuestPinRateLimitedResponse(
  retryAfterSeconds: number
): NextResponse {
  return NextResponse.json(
    {
      error: 'guest_pin_rate_limited',
      message:
        '게스트 PIN을 5회 연속 잘못 입력했습니다. 1분 후 다시 시도해주세요.',
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

export function createGuestPinRequiredResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'guest_pin_required',
      message: '게스트 PIN이 설정되지 않았습니다. 관리자에게 문의해주세요.',
    },
    { status: 403 }
  );
}

export function createGuestPinInvalidResponse(
  attemptsLeft: number
): NextResponse {
  return NextResponse.json(
    {
      error: 'guest_pin_invalid',
      message: `게스트 PIN이 올바르지 않습니다. (${attemptsLeft}회 남음)`,
      attemptsLeft,
    },
    { status: 403 }
  );
}

export function createGuestRegionBlockedResponse(
  countryCode: string | null
): NextResponse {
  return NextResponse.json(
    {
      error: 'guest_region_blocked',
      message: '현재 지역에서는 게스트 로그인이 제한됩니다.',
      countryCode,
    },
    { status: 403 }
  );
}

export function createGuestSessionIssueFailedResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'guest_session_issue_failed',
      message:
        '게스트 세션 발급 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    },
    { status: 500 }
  );
}

interface GuestSuccessResponseOptions {
  countryCode: string | null;
  guestSessionProof: string;
  secureCookie: boolean;
  sessionId: string;
  sessionMaxAgeSeconds: number;
}

export function createGuestSuccessResponse({
  countryCode,
  guestSessionProof,
  secureCookie,
  sessionId,
  sessionMaxAgeSeconds,
}: GuestSuccessResponseOptions): NextResponse {
  const response = NextResponse.json({
    success: true,
    countryCode,
    sessionId,
  });

  response.cookies.set({
    name: AUTH_SESSION_ID_KEY,
    value: sessionId,
    path: '/',
    maxAge: sessionMaxAgeSeconds,
    httpOnly: false,
    sameSite: 'strict',
    secure: secureCookie,
  });
  response.cookies.set({
    name: GUEST_AUTH_PROOF_COOKIE_KEY,
    value: guestSessionProof,
    path: '/',
    maxAge: sessionMaxAgeSeconds,
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookie,
  });
  response.cookies.set({
    name: LEGACY_GUEST_SESSION_COOKIE_KEY,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: false,
    sameSite: 'strict',
    secure: secureCookie,
  });
  response.cookies.set({
    name: AUTH_TYPE_KEY,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: false,
    sameSite: 'strict',
    secure: secureCookie,
  });

  return response;
}
