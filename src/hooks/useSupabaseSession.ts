'use client';

import type { User } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { clearAuthData } from '@/lib/auth/auth-state-manager';
import {
  AUTH_SESSION_ID_KEY,
  AUTH_TYPE_KEY,
  AUTH_USER_KEY,
  hasGuestStorageState,
} from '@/lib/auth/guest-session-utils';
import { logger } from '@/lib/logging';
import { getSupabase } from '@/lib/supabase/client';

// NextAuth 호환 세션 타입
interface Session {
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    provider?: string | null;
  } | null;
  expires?: string;
}

interface UseSessionReturn {
  data: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  update: () => Promise<Session | null>;
}

/**
 * NextAuth의 useSession을 대체하는 Supabase 기반 훅
 * 기존 코드와의 호환성을 위해 동일한 인터페이스 제공
 */
export function useSession(): UseSessionReturn {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<
    'loading' | 'authenticated' | 'unauthenticated'
  >('loading');

  useEffect(() => {
    // 초기 세션 확인 - getUser()로 JWT 검증 활성화 (보안 강화)
    const checkSession = async () => {
      try {
        // 🔐 getUser()는 서버에서 JWT 서명을 검증함 (getSession()은 로컬 캐시만 확인)
        const {
          data: { user: validatedUser },
          error,
        } = await getSupabase().auth.getUser();
        if (error) {
          // 'Auth session missing!'은 게스트 모드에서 예상된 동작 (경고 레벨 낮춤)
          if (error.message !== 'Auth session missing!') {
            logger.warn('⚠️ JWT 검증 실패:', error.message);
          }
        }
        if (validatedUser) {
          setUser(validatedUser);
          setStatus('authenticated');
        } else {
          // 🎯 게스트 세션 확인 (AuthStateManager 키 체계 통일)
          try {
            const guestUser = localStorage.getItem(AUTH_USER_KEY);
            const authType = localStorage.getItem(AUTH_TYPE_KEY);
            const sessionId = localStorage.getItem(AUTH_SESSION_ID_KEY);

            if (
              hasGuestStorageState({
                sessionId,
                authType,
                userJson: guestUser,
              }) &&
              guestUser
            ) {
              try {
                const guestUserData = JSON.parse(guestUser);
                // 게스트 사용자를 Supabase User 형태로 변환
                setUser({
                  id: guestUserData.id,
                  aud: 'guest',
                  email: guestUserData.email || null,
                  created_at:
                    guestUserData.created_at || new Date().toISOString(),
                  updated_at:
                    guestUserData.updated_at || new Date().toISOString(),
                  last_sign_in_at:
                    guestUserData.last_sign_in_at || new Date().toISOString(),
                  app_metadata: {
                    provider: 'guest',
                    providers: ['guest'],
                  },
                  user_metadata: {
                    name: guestUserData.name,
                    auth_type: 'guest',
                  },
                  identities: [],
                  factors: [],
                  role: 'authenticated',
                } as User);
                setStatus('authenticated');
              } catch (parseError) {
                logger.warn('게스트 사용자 정보 JSON 파싱 실패:', parseError);
                // localStorage에서 잘못된 데이터 제거
                localStorage.removeItem(AUTH_USER_KEY);
                localStorage.removeItem(AUTH_TYPE_KEY);
                localStorage.removeItem(AUTH_SESSION_ID_KEY);
                setUser(null);
                setStatus('unauthenticated');
              }
            } else {
              setUser(null);
              setStatus('unauthenticated');
            }
          } catch (error) {
            logger.warn(
              '게스트 세션 확인 오류 (localStorage 접근 제한):',
              error
            );
            setUser(null);
            setStatus('unauthenticated');
          }
        }
      } catch (error) {
        logger.error('세션 확인 오류:', error);
        setStatus('unauthenticated');
      }
    };

    void checkSession();

    // 세션 변경 감지
    const response = getSupabase().auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }

      // 🎯 router.refresh() 제거: 불필요한 전체 페이지 리렌더링 방지
      // React의 자연스러운 상태 전파를 통해 필요한 컴포넌트만 리렌더링
    });

    return () => {
      if (response?.data?.subscription) {
        response.data.subscription.unsubscribe();
      }
    };
  }, []); // router 의존성 제거 - Next.js router는 불안정한 참조로 무한 리렌더링 유발

  // NextAuth 호환 세션 객체 생성
  const data: Session | null = user
    ? {
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0] || null,
          image: user.user_metadata?.avatar_url || null,
          provider: user.app_metadata?.provider || 'unknown',
        },
        expires: new Date(Date.now() + 60 * 60 * 24 * 30 * 1000).toISOString(), // 30일
      }
    : null;

  // 세션 업데이트 함수 - getUser()로 JWT 검증 활성화
  const update = async (): Promise<Session | null> => {
    const {
      data: { user: validatedUser },
      error,
    } = await getSupabase().auth.getUser();
    if (error && error.message !== 'Auth session missing!') {
      logger.warn('⚠️ 세션 업데이트 JWT 검증 실패:', error.message);
    }
    if (validatedUser) {
      setUser(validatedUser);
      setStatus('authenticated');
    }
    return data;
  };

  return {
    data,
    status,
    update,
  };
}

/**
 * NextAuth의 signOut을 대체하는 Supabase 기반 함수
 * 초기 성공 버전으로 단순화 - 직접적인 Supabase 호출
 */
export async function signOut(options?: { callbackUrl?: string }) {
  try {
    logger.info('🚪 Supabase 로그아웃 시작');

    // Supabase 세션 종료 (핵심 동작)
    await getSupabase().auth.signOut();

    // AuthStateManager를 통한 통합 세션 정리
    if (typeof window !== 'undefined') {
      try {
        await clearAuthData(); // 모든 인증 데이터 정리
        logger.info('✅ AuthStateManager를 통한 세션 정리 완료');
      } catch (error) {
        logger.warn('⚠️ AuthStateManager 정리 실패 (계속 진행):', error);

        // Fallback: 기본 localStorage 정리
        [AUTH_SESSION_ID_KEY, AUTH_TYPE_KEY, AUTH_USER_KEY].forEach((key) => {
          localStorage.removeItem(key);
        });
      }
    }

    logger.info('✅ 로그아웃 완료');

    // 페이지 이동
    if (typeof window !== 'undefined') {
      window.location.href = options?.callbackUrl || '/login';
    }
  } catch (error) {
    logger.error('❌ 로그아웃 오류:', error);
    // 실패해도 강제로 로그인 페이지로 이동
    if (typeof window !== 'undefined') {
      window.location.href = options?.callbackUrl || '/login';
    }
  }
}

/**
 * NextAuth의 signIn을 대체하는 Supabase 기반 함수
 */
export async function signIn(
  provider: string,
  options?: { callbackUrl?: string }
) {
  try {
    if (provider === 'github') {
      const baseUrl = window.location.origin;
      const finalRedirect = options?.callbackUrl || '/main';

      // 최종 목적지를 세션 스토리지에 저장 (Vercel Edge Runtime 안전성 강화)
      if (finalRedirect) {
        try {
          sessionStorage.setItem('auth_redirect_to', finalRedirect);
        } catch (error) {
          logger.warn('sessionStorage 접근 오류 (무시됨):', error);
        }
      }

      // Supabase OAuth는 자체 콜백 URL을 사용
      // redirectTo는 PKCE 코드 교환 후 리다이렉트될 애플리케이션 URL
      // /auth/callback이 PKCE 처리를 담당하므로 이 경로로 통일
      const redirectTo = `${baseUrl}/auth/callback`;

      logger.info('🔐 GitHub OAuth 시작:', {
        baseUrl,
        finalRedirect,
        redirectTo,
        provider: 'github',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        environment: process.env.NEXT_PUBLIC_NODE_ENV || process.env.NODE_ENV,
      });

      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
          scopes: 'read:user user:email',
          // skipBrowserRedirect: false (기본값) - 브라우저 자동 리다이렉트
        },
      });

      if (error) {
        logger.error('GitHub 로그인 오류:', error);
        throw error;
      }

      logger.info('✅ GitHub OAuth 요청 성공 - 리다이렉트 중...');
    }
  } catch (error) {
    logger.error('로그인 오류:', error);
    throw error;
  }
}
