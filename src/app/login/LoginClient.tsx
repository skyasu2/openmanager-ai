/** Login Client: OAuth + 게스트 로그인 */

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import UnifiedProfileHeader from '@/components/shared/UnifiedProfileHeader';
// 게스트 로그인 관련 임포트 (lib/auth-state-manager로 통합)
import type { AuthUser } from '@/lib/auth/auth-state-manager';
import { authStateManager } from '@/lib/auth/auth-state-manager';
// Supabase Auth 관련 임포트
import { signInWithGitHub, signInWithGoogle } from '@/lib/auth/supabase-auth';
import { PAGE_BACKGROUNDS } from '@/styles/design-constants';
import debug from '@/utils/debug';
import { renderAIGradientWithAnimation } from '@/utils/text-rendering';
import { LoginButtons } from './LoginButtons';
import {
  COOKIE_MAX_AGE_SECONDS,
  DEFAULT_REDIRECT_PATH,
  LOADING_MESSAGE_INTERVAL_MS,
  PAGE_REDIRECT_DELAY_MS,
  PULSE_ANIMATION_DURATION_MS,
  REDIRECT_STORAGE_KEY,
  SUCCESS_MESSAGE_TIMEOUT_MS,
  sanitizeRedirectPath,
} from './login.constants';

interface GuestSessionData {
  sessionId: string;
  user: AuthUser;
}

// 🎯 TypeScript strict: Supabase Auth error 타입 정의
type AuthError = { message?: string; code?: string };

export default function LoginClient() {
  const _router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<
    'github' | 'guest' | 'google' | null
  >(null);
  const [guestSession, setGuestSession] = useState<GuestSessionData | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [_showPulse, _setShowPulse] = useState<
    'github' | 'guest' | 'google' | null
  >(null);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const glassButtonBaseClass =
    'group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-cyan-100/80 bg-white/92 text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.16)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-50 hover:bg-white hover:shadow-[0_12px_24px_rgba(15,23,42,0.24)] active:scale-[0.98] disabled:opacity-60';
  const providerOverlayClass =
    'pointer-events-none absolute inset-0 rounded-xl bg-linear-to-r from-blue-200/40 via-indigo-200/30 to-cyan-200/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100';
  const guestOverlayClass =
    'pointer-events-none absolute inset-0 rounded-xl bg-linear-to-r from-slate-100/40 via-white/50 to-slate-100/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100';

  // 현재 로그인 방식 감지 (계정 전환 시 해당 버튼 숨김)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const current = searchParams.get('current');
    if (current === 'github' || current === 'google' || current === 'guest') {
      setCurrentProvider(current);
    }
  }, []);

  // 단계별 로딩 메시지 효과
  useEffect(() => {
    if (!loadingType) return;

    const messages = {
      github: [
        'GitHub에 연결 중...',
        'OAuth 인증 대기 중...',
        '사용자 정보 확인 중...',
        '리다이렉트 준비 중...',
      ],
      google: [
        'Google에 연결 중...',
        'OAuth 인증 대기 중...',
        '보안 프로필 확인 중...',
        '로그인 승인 중...',
      ],
      guest: [
        '게스트 세션 생성 중...',
        '임시 프로필 설정 중...',
        '시스템 접근 권한 부여 중...',
        '메인 페이지로 이동 중...',
      ],
    };

    const currentMessages = messages[loadingType] || messages.github;
    let messageIndex = 0;
    setLoadingMessage(currentMessages[0] ?? '로딩 중...');

    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % currentMessages.length;
      setLoadingMessage(currentMessages[messageIndex] ?? '로딩 중...');
    }, LOADING_MESSAGE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadingType]);

  // ESC 키로 로딩 취소
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLoading) {
          debug.log('🛑 로딩 취소됨');
          setIsLoading(false);
          setLoadingType(null);
          setLoadingMessage('');
          setSuccessMessage('로그인이 취소되었습니다.');
          setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isLoading]);

  useEffect(() => {
    // URL 파라미터에서 에러 메시지와 리다이렉트 URL 확인
    const searchParams = new URLSearchParams(window.location.search);
    const error = searchParams.get('error');
    const message = searchParams.get('message');
    const warning = searchParams.get('warning');
    const redirectTo = searchParams.get('redirectTo');
    const code = searchParams.get('code'); // OAuth 콜백 코드

    // OAuth 콜백 코드가 있으면 /auth/callback으로 리다이렉트
    if (code) {
      debug.log('🔐 OAuth 콜백 코드 감지:', code);
      debug.log('🔄 /auth/callback으로 리다이렉트 중...');

      // 현재 URL에서 code 파라미터를 유지하면서 /auth/callback으로 이동
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.search = window.location.search; // 모든 파라미터 유지

      window.location.href = callbackUrl.toString();
      return;
    }

    // redirectTo 파라미터가 있으면 안전한 내부 경로만 세션 스토리지에 저장
    const safeRedirectFromQuery = sanitizeRedirectPath(redirectTo);
    if (
      safeRedirectFromQuery &&
      safeRedirectFromQuery !== DEFAULT_REDIRECT_PATH
    ) {
      try {
        sessionStorage.setItem(REDIRECT_STORAGE_KEY, safeRedirectFromQuery);
        debug.log('🔗 로그인 후 리다이렉트 URL 저장:', safeRedirectFromQuery);
      } catch (error) {
        debug.warn('⚠️ redirect 세션 저장 실패, 기본 경로로 이동합니다:', error);
      }
    } else if (redirectTo && redirectTo !== DEFAULT_REDIRECT_PATH) {
      debug.warn('⚠️ 유효하지 않은 redirectTo 파라미터 무시:', redirectTo);
    }

    if (error && message) {
      setErrorMessage(decodeURIComponent(message));
    } else if (error === 'provider_error') {
      setErrorMessage(
        'GitHub OAuth 설정을 확인해주세요. 아래 가이드를 참고하세요.'
      );
    } else if (error === 'auth_callback_failed') {
      setErrorMessage('인증 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } else if (error === 'pkce_failed') {
      // 🚨 PKCE 코드 교환 실패 - 게스트 로그인 권장
      setErrorMessage(
        '인증 코드 처리에 실패했습니다. GitHub 로그인을 다시 시도하거나 게스트 모드를 이용해주세요.'
      );
      // OAuth 상태 정리
      try {
        const keysToRemove = Object.keys(localStorage).filter(
          (key) => key.startsWith('sb-') || key.includes('supabase')
        );
        for (const key of keysToRemove) {
          localStorage.removeItem(key);
        }
      } catch {
        // Safari Private Browsing 등 localStorage 접근 불가 시 무시
      }
    } else if (error === 'session_timeout') {
      setErrorMessage('세션 생성에 실패했습니다. 다시 로그인해주세요.');
    } else if (warning === 'no_session') {
      setSuccessMessage(
        '인증이 완료되었지만 세션이 생성되지 않았습니다. 게스트 모드를 이용해주세요.'
      );
    }
  }, []);

  // guestSession 상태가 변경되면 localStorage와 쿠키에 저장하고 페이지 이동
  useEffect(() => {
    if (guestSession) {
      // localStorage 저장 (Safari Private Browsing 대응)
      try {
        localStorage.setItem('auth_session_id', guestSession.sessionId);
        localStorage.setItem('auth_type', 'guest');
        localStorage.setItem('auth_user', JSON.stringify(guestSession.user));
      } catch {
        // Safari Private Browsing 등 localStorage 쓰기 불가 시 쿠키만 사용
      }

      // 🍪 쿠키 저장 (middleware 인식용, HTTPS 환경 대응)
      const isProduction = window.location.protocol === 'https:';
      const secureFlag = isProduction ? '; Secure' : '';
      // 🔒 보안: encodeURIComponent로 쿠키 값 인코딩 (세미콜론, 등호 방어)
      document.cookie = `guest_session_id=${encodeURIComponent(guestSession.sessionId)}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
      document.cookie = `auth_type=guest; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;

      debug.log(
        '✅ 게스트 세션 저장 완료 (localStorage + 쿠키), 페이지 이동:',
        guestSession.user.name
      );

      // 🚀 리다이렉트 로직: sessionStorage의 저장된 redirect 경로 우선 사용
      let targetPath = DEFAULT_REDIRECT_PATH;
      try {
        const savedRedirect = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
        const safeSavedRedirect = sanitizeRedirectPath(savedRedirect);
        targetPath = safeSavedRedirect || DEFAULT_REDIRECT_PATH;

        if (savedRedirect) {
          sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
        }
        if (savedRedirect && !safeSavedRedirect) {
          debug.warn(
            '⚠️ 저장된 redirect 경로가 유효하지 않아 기본 경로로 이동:',
            savedRedirect
          );
        }
      } catch (error) {
        debug.warn('⚠️ redirect 세션 조회 실패, 기본 경로로 이동합니다:', error);
      }

      // 1. 먼저 라우터로 이동 시도 (빠른 전환)
      _router.push(targetPath);
      _router.refresh(); // 데이터 갱신

      // 2. 혹시 모를 상황 대비 강제 새로고침 폴백
      const redirectTimer = setTimeout(() => {
        if (window.location.pathname === '/login') {
          window.location.href = targetPath;
        }
      }, PAGE_REDIRECT_DELAY_MS);

      // 🧹 Cleanup: 컴포넌트 언마운트 시 타이머 정리 (메모리 누수 방지)
      return () => clearTimeout(redirectTimer);
    }
    return undefined;
  }, [guestSession, _router]);

  // Google OAuth 로그인
  const handleGoogleLogin = async () => {
    try {
      _setShowPulse('google');
      setTimeout(() => _setShowPulse(null), PULSE_ANIMATION_DURATION_MS);

      setIsLoading(true);
      setLoadingType('google');
      setErrorMessage('');

      debug.log('🔐 Google OAuth 로그인 시작 (Supabase Auth)...');

      const { error } = await signInWithGoogle();

      if (error) {
        debug.error('❌ Google 로그인 실패:', error);

        // 에러 메시지 처리
        const authError = error as AuthError;
        setErrorMessage(authError?.message || 'Google 로그인에 실패했습니다.');

        setIsLoading(false);
        setLoadingType(null);
        return;
      }

      debug.log('✅ Google OAuth 로그인 요청 성공 - 리다이렉트 중...');
    } catch (error) {
      debug.error('❌ Google 로그인 에러:', error);
      setErrorMessage('로그인 중 예상치 못한 오류가 발생했습니다.');
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  // GitHub OAuth 로그인
  const handleGitHubLogin = async () => {
    try {
      _setShowPulse('github');
      setTimeout(() => _setShowPulse(null), PULSE_ANIMATION_DURATION_MS);

      setIsLoading(true);
      setLoadingType('github');
      setErrorMessage('');

      debug.log('🔐 GitHub OAuth 로그인 시작 (Supabase Auth)...');
      debug.log('🌍 현재 환경:', {
        origin: window.location.origin,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        isLocal: window.location.origin.includes('localhost'),
        isVercel: window.location.origin.includes('vercel.app'),
      });

      const { error } = await signInWithGitHub();

      if (error) {
        debug.error('❌ GitHub 로그인 실패:', error);

        // 더 구체적인 에러 메시지
        let errorMsg = 'GitHub 로그인에 실패했습니다.';
        // 🎯 TypeScript strict: error 타입 명시 (타입 정의는 파일 상단 참조)
        const authError = error as AuthError;
        const errorMessage = authError?.message || '';
        const errorCode = authError?.code || '';

        if (errorMessage.includes('Invalid login credentials')) {
          errorMsg = 'GitHub 인증 정보가 올바르지 않습니다.';
        } else if (errorMessage.includes('redirect_uri')) {
          errorMsg = 'OAuth 설정 오류입니다. 관리자에게 문의하세요.';
        } else if (errorMessage.includes('network')) {
          errorMsg = '네트워크 오류입니다. 잠시 후 다시 시도해주세요.';
        } else if (errorMessage.includes('Invalid API key')) {
          errorMsg = 'Supabase 설정 오류입니다. 환경변수를 확인해주세요.';
        }

        setErrorMessage(errorMsg);
        debug.log('🔧 디버깅 정보:', {
          errorMessage: errorMessage,
          errorCode: errorCode,
          currentUrl: window.location.href,
          expectedCallback: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/callback`,
        });

        setIsLoading(false);
        setLoadingType(null);
        return;
      }

      debug.log('✅ GitHub OAuth 로그인 요청 성공 - 리다이렉트 중...');
      // 성공 시 자동으로 OAuth 리다이렉트됨
    } catch (error) {
      debug.error('❌ GitHub 로그인 에러:', error);
      setErrorMessage(
        '로그인 중 예상치 못한 오류가 발생했습니다. 게스트 모드를 이용해주세요.'
      );
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  // 게스트 로그인
  const handleGuestLogin = async () => {
    try {
      _setShowPulse('guest');
      setTimeout(() => _setShowPulse(null), PULSE_ANIMATION_DURATION_MS);

      setIsLoading(true);
      setLoadingType('guest');

      debug.log('👤 게스트 로그인 시작...');

      // 🔐 게스트 사용자 생성 - 보안 강화된 ID 생성
      const secureId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}_${Math.random().toString(36).substring(2, 14)}`;

      const guestUser: AuthUser = {
        id: `guest_${secureId}`,
        name: '게스트 사용자',
        email: `guest_${secureId.substring(0, 8)}@example.com`,
        provider: 'guest',
      };

      // AuthStateManager를 통한 게스트 인증 설정
      await authStateManager.setGuestAuth(guestUser);

      // 세션 ID 생성 (localStorage에서 가져옴)
      let sessionId = `guest_${Date.now()}`;
      try {
        sessionId = localStorage.getItem('auth_session_id') || sessionId;
      } catch {
        // Safari Private Browsing 등 localStorage 접근 불가 시 fallback
      }

      setGuestSession({ sessionId, user: guestUser });
    } catch (error) {
      debug.error('게스트 로그인 실패:', error);
      alert('게스트 로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  const handleCancelLoading = () => {
    setIsLoading(false);
    setLoadingType(null);
    setLoadingMessage('');
    setSuccessMessage('로그인이 취소되었습니다.');
    setTimeout(() => setSuccessMessage(null), SUCCESS_MESSAGE_TIMEOUT_MS);
  };

  return (
    <div
      className={`relative flex min-h-screen flex-col overflow-hidden font-sans ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}
    >
      <div className="wave-particles" />

      <header className="relative z-50 flex items-center justify-between p-4 sm:p-6">
        <OpenManagerLogo variant="dark" href="/" />
        <div className="flex items-center gap-3">
          <UnifiedProfileHeader />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-8 pt-2 sm:pt-4">
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/25 bg-white/10 px-8 py-10 shadow-[0_16px_48px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/20 via-white/10 to-white/5" />
            <div className="relative">
              {/* Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 h-12 w-12 rounded-xl bg-linear-to-br from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_28px_rgba(168,85,247,0.4)]" />
                <h1 className="mb-1.5 text-xl font-semibold tracking-tight text-white">
                  <span>OpenManager </span>
                  {renderAIGradientWithAnimation('AI')}
                  <span>에 로그인</span>
                </h1>
                <p className="text-sm text-white/75">
                  {currentProvider
                    ? '다른 방법으로 로그인하세요'
                    : 'AI 서버 모니터링 시스템에 오신 것을 환영합니다'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                {/* Messages */}
                <output aria-live="polite" className="sr-only">
                  {isLoading && loadingMessage}
                </output>

                {errorMessage && (
                  <div className="rounded-lg border border-red-300/35 bg-red-500/15 px-4 py-3 text-sm text-red-100 backdrop-blur-sm">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 backdrop-blur-sm">
                    {successMessage}
                  </div>
                )}

                <LoginButtons
                  currentProvider={currentProvider}
                  isLoading={isLoading}
                  loadingType={loadingType}
                  onGitHub={() => void handleGitHubLogin()}
                  onGoogle={() => void handleGoogleLogin()}
                  onGuest={() => void handleGuestLogin()}
                  onCancel={handleCancelLoading}
                  glassButtonBaseClass={glassButtonBaseClass}
                  providerOverlayClass={providerOverlayClass}
                  guestOverlayClass={guestOverlayClass}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-white/60">
              OpenManager AI v{process.env.NEXT_PUBLIC_APP_VERSION || '8.0.0'}
            </p>
            <a
              href="/privacy"
              className="mt-1.5 inline-block text-xs text-white/60 transition-colors hover:text-white/85"
            >
              개인정보 처리방침
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
