/**
 * 🔐 Supabase Auth 클라이언트 설정
 *
 * GitHub OAuth 및 게스트 로그인 지원
 * NextAuth 대체 구현
 */

'use client';

import type { AuthError, Session } from '@supabase/supabase-js';
import { logger } from '@/lib/logging';
import { guestSessionCookies } from '@/lib/security/secure-cookies';
import { getSupabase } from '../supabase/client';
import { authStateManager } from './auth-state-manager';
import { signInWithOAuthProvider } from './supabase-auth-oauth';

// 런타임에 클라이언트를 가져오는 헬퍼 (PKCE flow를 위해 필수)
const getClient = () => getSupabase();

/**
 * 🔧 Supabase 프로젝트 ID 동적 추출
 * URL에서 프로젝트 ID를 추출하여 스토리지 키를 생성합니다
 */
function getSupabaseStorageKey(suffix: string = ''): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }

  // https://vnswjnltnhpsueosfhmw.supabase.co → vnswjnltnhpsueosfhmw
  const projectId = url.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectId) {
    throw new Error(`Invalid Supabase URL format: ${url}`);
  }

  return suffix
    ? `sb-${projectId}-auth-token-${suffix}`
    : `sb-${projectId}-auth-token`;
}

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  provider?: 'github' | 'google' | 'guest';
}

export interface AuthCallbackResult {
  session: Session | null;
  error: AuthError | Error | null;
}

/**
 * GitHub OAuth 로그인
 */
export async function signInWithGitHub() {
  return signInWithOAuthProvider('github');
}

/**
 * Google OAuth 로그인
 */
export async function signInWithGoogle() {
  return signInWithOAuthProvider('google');
}

/**
 * 로그아웃 (AuthStateManager 사용)
 * @deprecated - 새로운 코드에서는 authStateManager.clearAllAuthData() 사용 권장
 */
export async function signOut(options?: { authType?: 'github' | 'guest' }) {
  try {
    logger.info('🚪 통합 로그아웃 시작:', options);

    // AuthStateManager를 통한 통합 로그아웃 처리
    // authStateManager는 이미 import됨
    await authStateManager.clearAllAuthData(options?.authType);

    logger.info('✅ 통합 로그아웃 성공');
    return { error: null };
  } catch (error) {
    logger.error('❌ 통합 로그아웃 에러:', error);

    // Fallback: 레거시 로직 사용
    logger.warn('⚠️ 레거시 로그아웃으로 fallback');
    return await signOutLegacy(options?.authType);
  }
}

/**
 * 레거시 로그아웃 구현 (하위 호환성용)
 */
async function signOutLegacy(authType?: 'github' | 'guest') {
  try {
    logger.warn(
      '⚠️ 레거시 signOut 사용 중 - AuthStateManager로 마이그레이션 권장'
    );

    // Supabase 세션 정리 (GitHub OAuth)
    if (!authType || authType === 'github') {
      const { error } = await getClient().auth.signOut();
      if (error) {
        logger.warn('⚠️ Supabase 로그아웃 실패:', error);
      }
    }

    // localStorage 정리 (레거시 키들)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_session_id');
      localStorage.removeItem('auth_type');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('admin_mode');

      // Supabase 관련 키들도 정리
      const supabaseKeys = Object.keys(localStorage).filter(
        (key) => key.startsWith('sb-') || key.includes('supabase')
      );
      for (const key of supabaseKeys) {
        localStorage.removeItem(key);
      }
    }

    // 쿠키 정리 (레거시)
    if (typeof document !== 'undefined') {
      document.cookie =
        'guest_session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict';
      document.cookie =
        'auth_type=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict';
    }

    // 🍪 보안 강화된 게스트 세션 쿠키 정리 (기존 유틸 사용)
    try {
      guestSessionCookies.clearGuestSession();
    } catch (error) {
      logger.warn('⚠️ guestSessionCookies 정리 실패:', error);
    }

    logger.info('✅ 레거시 로그아웃 완료');
    return { error: null };
  } catch (error) {
    logger.error('❌ 레거시 로그아웃 에러:', error);
    return { error };
  }
}

/**
 * 현재 세션 가져오기 (JWT 검증 포함)
 * 🔐 보안 강화: getUser()로 JWT 서명 검증 후 세션 반환
 */
export async function getSession(): Promise<Session | null> {
  try {
    // 1. 먼저 getUser()로 JWT 검증 (보안 우선)
    const {
      data: { user: validatedUser },
      error: userError,
    } = await getClient().auth.getUser();
    if (userError) {
      logger.warn('⚠️ JWT 검증 실패:', userError.message);
      return null;
    }
    if (!validatedUser) {
      return null;
    }

    // 2. JWT가 유효한 경우에만 세션 반환
    const {
      data: { session },
      error: sessionError,
    } = await getClient().auth.getSession();
    if (sessionError) {
      logger.error('❌ 세션 가져오기 실패:', sessionError);
      return null;
    }

    return session;
  } catch (error) {
    logger.error('❌ 세션 가져오기 에러:', error);
    return null;
  }
}

/**
 * 현재 사용자 가져오기 (AuthStateManager 사용)
 * @deprecated - 새로운 코드에서는 authStateManager.getAuthState() 사용 권장
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    // AuthStateManager를 통한 통합 상태 관리로 리팩토링
    // authStateManager는 이미 import됨
    const authState = await authStateManager.getAuthState();

    logger.info('🔄 getCurrentUser -> AuthStateManager 위임:', {
      type: authState.type,
      isAuthenticated: authState.isAuthenticated,
      userId: authState.user?.id,
    });

    return authState.user;
  } catch (error) {
    logger.error('❌ getCurrentUser 에러 (AuthStateManager 위임 실패):', error);

    // Fallback: 기존 로직 유지 (하위 호환성)
    return await getCurrentUserLegacy();
  }
}

/**
 * 레거시 getCurrentUser 구현 (하위 호환성용)
 */
async function getCurrentUserLegacy(): Promise<AuthUser | null> {
  try {
    logger.warn(
      '⚠️ 레거시 getCurrentUser 사용 중 - AuthStateManager로 마이그레이션 권장'
    );

    // 세션 상태 확인 (재시도 로직 포함)
    let session = null;
    let attempts = 0;
    const maxAttempts = 3;

    // GitHub OAuth 콜백 후 세션이 설정되는 데 시간이 걸릴 수 있으므로 재시도
    do {
      const sessionResult = await getSession();
      session = sessionResult;

      if (!session?.user && attempts < maxAttempts - 1) {
        // 짧은 지연 후 재시도 (OAuth 콜백 직후 세션 설정 대기)
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      attempts++;
    } while (!session?.user && attempts < maxAttempts);

    if (!session?.user) {
      // 클라이언트 환경에서만 localStorage 확인
      if (typeof window !== 'undefined') {
        // 게스트 사용자 확인 (localStorage) - 레거시 키 사용
        const guestUser = localStorage.getItem('auth_user');
        if (guestUser) {
          return JSON.parse(guestUser);
        }

        // Supabase 세션 토큰 직접 확인 (fallback)
        const supabaseAuthToken = localStorage.getItem(getSupabaseStorageKey());
        if (supabaseAuthToken) {
          try {
            const tokenData = JSON.parse(supabaseAuthToken);
            if (tokenData?.access_token && tokenData?.user) {
              logger.info('🔄 Supabase 토큰에서 세션 복원 시도');
              // 세션을 한 번 더 시도해보기
              const retrySession = await getSession();
              if (retrySession?.user) {
                const user = retrySession.user;
                return {
                  id: user.id,
                  email: user.email,
                  name:
                    user.user_metadata?.full_name ||
                    user.user_metadata?.user_name ||
                    user.email?.split('@')[0] ||
                    'GitHub User',
                  avatar: user.user_metadata?.avatar_url,
                  provider: 'github',
                };
              }
            }
          } catch (e) {
            logger.warn('⚠️ Supabase 토큰 파싱 실패:', e);
          }
        }
      }

      // 서버 환경 또는 localStorage가 없는 경우 쿠키 확인
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';').map((c) => c.trim());
        const guestSessionCookie = cookies.find((c) =>
          c.startsWith('guest_session_id=')
        );
        const authTypeCookie = cookies.find((c) =>
          c.startsWith('auth_type=guest')
        );

        if (guestSessionCookie && authTypeCookie) {
          // 쿠키에서 게스트 사용자 정보 복원
          const sessionId =
            guestSessionCookie.split('=')[1] ?? crypto.randomUUID();

          // localStorage에서 사용자 정보 확인 (쿠키는 sessionId만 저장)
          if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('auth_user');
            if (storedUser) {
              return JSON.parse(storedUser);
            }
          }

          // localStorage가 없으면 기본 게스트 사용자 생성
          return {
            id: sessionId,
            name: '게스트 사용자',
            provider: 'guest',
          };
        }
      }

      return null;
    }

    const user = session.user;
    return {
      id: user.id,
      email: user.email,
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.user_name ||
        user.email?.split('@')[0] ||
        'GitHub User',
      avatar: user.user_metadata?.avatar_url,
      provider: 'github',
    };
  } catch (error) {
    logger.error('❌ 레거시 getCurrentUser 에러:', error);
    return null;
  }
}

/**
 * 게스트 사용자인지 확인 (AuthStateManager 사용)
 * @deprecated - 새로운 코드에서는 authStateManager.getAuthState() 사용 권장
 */
export function isGuestUser(): boolean {
  try {
    // 간단한 localStorage 확인으로 최적화
    if (typeof window !== 'undefined') {
      const authType = localStorage.getItem('auth_type');
      const sessionId = localStorage.getItem('auth_session_id');

      // 간단한 게스트 세션 확인
      if (authType === 'guest' && sessionId) {
        logger.info('🔄 isGuestUser 간단 확인:', {
          isGuest: true,
          sessionId: `${sessionId.substring(0, 8)}...`,
        });
        return true;
      }

      return false;
    }
    return false;
  } catch (error) {
    logger.error('❌ isGuestUser 에러:', error);
    return false;
  }
}

/**
 * 인증 상태 변경 리스너
 */
export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data: authListener } = getClient().auth.onAuthStateChange(
    (event, session) => {
      logger.info('🔄 Auth 상태 변경:', event, 'userId:', session?.user?.id);
      callback(session);
    }
  );

  return authListener;
}

/**
 * 인증 콜백 처리 (OAuth 리다이렉트 후)
 */
export async function handleAuthCallback(): Promise<AuthCallbackResult> {
  try {
    const response = await getClient().auth.getSession();
    const session = response?.data?.session;
    const error = response?.error;

    if (error) {
      logger.error('❌ Auth 콜백 처리 실패:', error);
      return { session: null, error };
    }

    if (session) {
      logger.info('✅ Auth 콜백 처리 성공, userId:', session.user.id);
    }

    return { session, error: null };
  } catch (error) {
    logger.error('❌ Auth 콜백 처리 에러:', error);
    return {
      session: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * 세션 새로고침
 */
export async function refreshSession() {
  try {
    const response = await getClient().auth.refreshSession();
    const session = response?.data?.session;
    const error = response?.error;

    if (error) {
      logger.error('❌ 세션 새로고침 실패:', error);
      return { session: null, error };
    }

    logger.info('✅ 세션 새로고침 성공');
    return { session, error: null };
  } catch (error) {
    logger.error('❌ 세션 새로고침 에러:', error);
    return { session: null, error };
  }
}

// Module initialization log removed - lazy loading pattern prevents module-level execution
