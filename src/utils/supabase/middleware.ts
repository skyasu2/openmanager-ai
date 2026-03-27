import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logging';
import {
  getSupabaseServerPublishableKey,
  getSupabaseServerUrl,
} from '@/lib/supabase/env';
import { getCookieValue } from '@/utils/cookies/safe-cookie-utils';

// 🔧 타입 정의: Next.js 16 Response의 cookies 인터페이스
interface ResponseWithCookies extends Omit<NextResponse, 'cookies'> {
  cookies: {
    set(name: string, value: string, options?: Record<string, unknown>): void;
    get(name: string): { name: string; value: string } | undefined;
    getAll(): Array<{ name: string; value: string }>;
    has(name: string): boolean;
    delete(name: string): void;
  };
}

interface SessionUpdateResult {
  response: NextResponse;
  user: User | null;
  error: string | null;
}

function getSupabaseUrl(): string {
  return getSupabaseServerUrl();
}

function getSupabasePublishableKey(): string {
  return getSupabaseServerPublishableKey();
}

/**
 * 🔐 Supabase 미들웨어 세션 업데이트 함수
 *
 * PKCE 플로우를 자동으로 처리하고 쿠키를 관리합니다.
 * Server Components가 쿠키를 쓸 수 없으므로 미들웨어에서 처리합니다.
 */
export async function updateSessionWithAuth(
  request: NextRequest,
  response?: NextResponse
): Promise<SessionUpdateResult> {
  // response가 없으면 새로 생성
  const supabaseResponse = response || NextResponse.next();

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        get(name: string) {
          // ✅ 타입 안전 유틸리티 사용 (Issue #001 근본 해결)
          return getCookieValue(request, name);
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          // ✅ 개선: 여러 쿠키 공존을 위해 response.cookies.set 사용
          try {
            (supabaseResponse as ResponseWithCookies).cookies.set(name, value, {
              // 🔧 수정: 타입 안전 단언
              path: '/',
              ...options,
            });
          } catch {
            // Fallback: Headers.append 사용 (여러 쿠키 지원)
            const cookieValue = `${name}=${value}; Path=/; ${Object.entries(
              options
            )
              .map(
                ([k, v]) =>
                  `${k}=${
                    typeof v === 'string' ||
                    typeof v === 'number' ||
                    typeof v === 'boolean'
                      ? String(v)
                      : (
                          () => {
                            try {
                              return JSON.stringify(v);
                            } catch {
                              return '[unserializable]';
                            }
                          }
                        )()
                  }`
              )
              .join('; ')}`;
            supabaseResponse.headers.append('Set-Cookie', cookieValue);
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          // ✅ 개선: 여러 쿠키 공존을 위해 response.cookies.set 사용
          try {
            (supabaseResponse as ResponseWithCookies).cookies.set(name, '', {
              // 🔧 수정: 타입 안전 단언
              path: '/',
              maxAge: 0,
              ...options,
            });
          } catch {
            // Fallback: Headers.append 사용 (여러 쿠키 지원)
            const cookieValue = `${name}=; Path=/; Max-Age=0; ${Object.entries(
              options
            )
              .map(
                ([k, v]) =>
                  `${k}=${
                    typeof v === 'string' ||
                    typeof v === 'number' ||
                    typeof v === 'boolean'
                      ? String(v)
                      : (
                          () => {
                            try {
                              return JSON.stringify(v);
                            } catch {
                              return '[unserializable]';
                            }
                          }
                        )()
                  }`
              )
              .join('; ')}`;
            supabaseResponse.headers.append('Set-Cookie', cookieValue);
          }
        },
      },
    }
  );

  // Supabase 권장: 보호 라우트 판별은 getUser()로 검증된 사용자 기준
  const {
    data: { user },
    error,
  } = await (supabase as SupabaseClient).auth.getUser();

  if (user) {
    logger.info('✅ updateSession: 사용자 확인됨', 'userId:', user.id);
  } else {
    const errorMessage = error?.message ?? null;
    if (errorMessage && errorMessage !== 'Auth session missing!') {
      logger.warn('⚠️ updateSession: 사용자 검증 실패', errorMessage);
    }
  }

  return {
    response: supabaseResponse,
    user: user ?? null,
    error: error?.message ?? null,
  };
}

export async function updateSession(
  request: NextRequest,
  response?: NextResponse
): Promise<NextResponse> {
  const result = await updateSessionWithAuth(request, response);
  return result.response;
}
