/**
 * 🔐 통합 인증 상태 관리자
 *
 * GitHub OAuth와 게스트 인증의 통합 관리
 * - 단일 소스를 통한 일관된 상태 확인
 * - 원자적 로그아웃 처리
 * - 저장소 키 분리로 충돌 방지
 */

import type { Session } from '@supabase/supabase-js';
import { logger } from '@/lib/logging';
import { getSupabase } from '../supabase/client';
import {
  clearBrowserAuthStorage,
  generateClientSessionId,
  getGuestAuthState,
  migrateLegacyAuthCookieKeys,
  SESSION_MAX_AGE_MS,
} from './auth-state-manager-browser';
import type { AuthState, AuthUser } from './auth-state-manager-types';

// 런타임에 클라이언트를 가져오는 헬퍼 (PKCE flow를 위해 필수)
const getClient = () => getSupabase();

export class AuthStateManager {
  private static instance: AuthStateManager;
  private cachedState: AuthState | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5000; // 5초 캐시

  public static getInstance(): AuthStateManager {
    if (!AuthStateManager.instance) {
      AuthStateManager.instance = new AuthStateManager();
    }
    return AuthStateManager.instance;
  }

  /**
   * 통합 인증 상태 확인 (캐싱 포함)
   */
  async getAuthState(): Promise<AuthState> {
    // 레거시 키 자동 마이그레이션
    migrateLegacyAuthCookieKeys();

    // 캐시된 상태가 유효하면 반환
    if (this.cachedState && Date.now() < this.cacheExpiry) {
      return this.cachedState;
    }

    try {
      // 1. Supabase 세션 확인 (GitHub/Google OAuth) 우선
      const session = await this.getSupabaseSession();
      if (session?.user) {
        const authUser = this.extractUserFromSession(session);
        const state: AuthState = {
          user: authUser,
          type: (authUser.provider as 'github' | 'google') || 'github',
          isAuthenticated: true,
          sessionId: `${session.access_token?.substring(0, 8)}...`,
        };

        this.setCachedState(state);
        logger.info('🔐 인증 세션 확인', {
          userId: authUser.id,
          provider: authUser.provider,
        });
        return state;
      }

      // 2. 게스트 세션 확인 - OAuth 세션이 없을 때만
      const guestState = await this.getGuestState();
      if (guestState.isAuthenticated) {
        this.setCachedState(guestState);
        logger.info('🔐 게스트 세션 확인', { userId: guestState.user?.id });
        return guestState;
      }

      // 3. 인증되지 않은 상태
      const unknownState: AuthState = {
        user: null,
        type: 'unknown',
        isAuthenticated: false,
      };

      this.setCachedState(unknownState);
      return unknownState;
    } catch (error) {
      logger.error('❌ 인증 상태 확인 실패:', error);
      const errorState: AuthState = {
        user: null,
        type: 'unknown',
        isAuthenticated: false,
      };

      this.setCachedState(errorState);
      return errorState;
    }
  }

  /**
   * GitHub 인증 전용 상태 확인
   */
  async isGitHubAuthenticated(): Promise<boolean> {
    try {
      const session = await this.getSupabaseSession();
      return !!(session?.user && this.isProvider(session, 'github'));
    } catch (error) {
      logger.error('❌ GitHub 인증 상태 확인 실패:', error);
      return false;
    }
  }

  /**
   * 원자적 로그아웃 처리 (모든 인증 데이터 정리)
   */
  async clearAllAuthData(authType?: 'github' | 'guest'): Promise<void> {
    logger.info('🔐 clearAllAuthData 시작', { authType: authType || 'all' });

    try {
      // 1. React 상태 캐시 즉시 무효화
      this.invalidateCache();

      // 2. Supabase 세션 정리 (GitHub OAuth)
      if (!authType || authType === 'github') {
        try {
          const { error } = await getClient().auth.signOut();
          if (error) {
            logger.warn('⚠️ Supabase 로그아웃 실패:', error.message);
          }
        } catch (error) {
          logger.warn('⚠️ Supabase 로그아웃 예외:', error);
        }
      }

      // 3. 통합 저장소 정리 (localStorage + sessionStorage + 쿠키)
      this.clearStorage(authType);

      logger.info('🔐 인증 데이터 정리 완료');
    } catch (error) {
      logger.error('❌ 인증 데이터 정리 실패:', error);
      throw error;
    }
  }

  /**
   * 캐시 무효화
   */
  invalidateCache(): void {
    this.cachedState = null;
    this.cacheExpiry = 0;
  }

  /**
   * 게스트 로그인 설정 (기존 GitHub 세션 자동 정리)
   */
  async setGuestAuth(guestUser: AuthUser): Promise<void> {
    logger.info('🔐 게스트 로그인 설정 시작');

    // 1. 기존 GitHub 세션이 있으면 먼저 정리
    try {
      const existingSession = await this.getSupabaseSession();
      if (existingSession?.user) {
        await getClient().auth.signOut();
        logger.info('🔐 기존 GitHub 세션 정리 완료');
      }
    } catch (error) {
      logger.warn('⚠️ 기존 세션 정리 실패 (계속 진행):', error);
    }

    // 1.5. 🛡️ PKCE 관련 데이터 명시적 정리 (fetch 에러 방지)
    if (typeof window !== 'undefined') {
      // Supabase PKCE code-verifier 패턴: sb-{projectId}-auth-token-code-verifier
      const pkceKeys = Object.keys(localStorage).filter(
        (key) =>
          key.includes('code-verifier') ||
          key.includes('code_verifier') ||
          (key.startsWith('sb-') && key.includes('auth-token'))
      );
      pkceKeys.forEach((key) => {
        localStorage.removeItem(key);
        logger.info(`🧹 PKCE 키 정리: ${key}`);
      });
    }

    // 1.6. 🛡️ localStorage 완전 정리 (admin_mode 등 관리자 데이터 포함)
    this.clearStorage(); // 모든 인증 관련 데이터 정리

    // 2. 게스트 세션 설정
    if (typeof window !== 'undefined') {
      // 브라우저 호환 세션 ID 생성 (Web Crypto API 또는 폴백)
      const sessionId = generateClientSessionId();
      const createdAt = Date.now();

      // localStorage에 게스트 정보 저장
      localStorage.setItem('auth_type', 'guest');
      localStorage.setItem('auth_session_id', sessionId);
      localStorage.setItem('auth_user', JSON.stringify(guestUser));
      localStorage.setItem('auth_created_at', createdAt.toString()); // 7일 만료용

      // 쿠키에 세션 ID 저장 (7일 만료)
      // 🔧 localhost(HTTP)에서도 쿠키가 설정되도록 Secure 플래그 조건부 적용
      const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);
      const isProduction = window.location.protocol === 'https:';
      const secureFlag = isProduction ? '; Secure' : '';
      document.cookie = `auth_session_id=${sessionId}; path=/; expires=${expires.toUTCString()}${secureFlag}; SameSite=Lax`;
      document.cookie = `auth_type=guest; path=/; expires=${expires.toUTCString()}${secureFlag}; SameSite=Lax`;

      logger.info('🔐 게스트 로그인 설정 완료', { userId: guestUser.id });
    }

    // 캐시 무효화하여 다음 호출에서 새 상태 반영
    this.invalidateCache();
  }

  /**
   * Private 헬퍼 메서드들
   */
  /**
   * 🔐 Supabase 세션 가져오기 (getUser + getSession 조합)
   * - getUser(): JWT 서명 검증 (보안 강화)
   * - getSession(): 토큰 정보 필요시 사용
   */
  private async getSupabaseSession(): Promise<Session | null> {
    try {
      // 1. 먼저 getUser()로 JWT 검증 (보안 우선)
      const {
        data: { user: validatedUser },
        error: userError,
      } = await getClient().auth.getUser();
      if (userError) {
        // 'Auth session missing!'은 게스트 모드에서 예상된 동작 (경고 레벨 낮춤)
        if (userError.message === 'Auth session missing!') {
          logger.debug('🔐 Supabase 세션 없음 - 게스트 모드 확인 중...');
        } else {
          logger.warn('⚠️ JWT 검증 실패:', userError.message);
        }
        return null;
      }
      if (!validatedUser) {
        return null;
      }

      // 2. JWT가 유효하면 세션 정보도 가져옴 (토큰 정보 필요시)
      const {
        data: { session },
        error: sessionError,
      } = await getClient().auth.getSession();
      if (sessionError) {
        logger.warn('⚠️ 세션 가져오기 실패:', sessionError.message);
        // JWT는 유효하므로 기본 세션 객체 생성
        return {
          user: validatedUser,
          access_token: '',
          refresh_token: '',
          expires_in: 0,
          expires_at: 0,
          token_type: 'bearer',
        } as Session;
      }
      return session || null;
    } catch (error) {
      logger.error('❌ Supabase 세션 에러:', error);
      return null;
    }
  }

  private async getGuestState(): Promise<AuthState> {
    return getGuestAuthState(() => this.clearStorage('guest'));
  }

  private extractUserFromSession(session: Session): AuthUser {
    const user = session.user;
    // Provider 감지 (app_metadata 우선)
    const provider =
      user.app_metadata?.provider === 'google'
        ? 'google'
        : user.app_metadata?.provider === 'github'
          ? 'github'
          : user.user_metadata?.provider === 'google'
            ? 'google'
            : 'github'; // Default fallback

    return {
      id: user.id,
      email: user.email,
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.user_name ||
        user.user_metadata?.name || // Google uses 'name'
        user.email?.split('@')[0] ||
        `${provider === 'google' ? 'Google' : 'GitHub'} User`,
      avatar: user.user_metadata?.avatar_url || user.user_metadata?.picture, // Google uses 'picture'
      provider: provider as 'github' | 'google',
    };
  }

  private isProvider(session: Session, provider: string): boolean {
    return !!(
      session.user?.app_metadata?.provider === provider ||
      session.user?.user_metadata?.provider === provider
    );
  }

  private setCachedState(state: AuthState): void {
    this.cachedState = state;
    this.cacheExpiry = Date.now() + this.CACHE_DURATION;
  }

  /**
   * 통합 저장소 정리 (localStorage + sessionStorage + 쿠키)
   */
  private clearStorage(authType?: 'github' | 'guest'): void {
    clearBrowserAuthStorage(authType);
  }
}

// 싱글톤 인스턴스 내보내기
export const authStateManager = AuthStateManager.getInstance();

// 편의 함수들
export const getAuthState = () => authStateManager.getAuthState();
export const isGitHubAuthenticated = () =>
  authStateManager.isGitHubAuthenticated();
export const clearAuthData = (authType?: 'github' | 'guest') =>
  authStateManager.clearAllAuthData(authType);
export const invalidateAuthCache = () => authStateManager.invalidateCache();
export type { AuthState, AuthUser } from './auth-state-manager-types';

// AuthStateManager 싱글톤 초기화 완료
