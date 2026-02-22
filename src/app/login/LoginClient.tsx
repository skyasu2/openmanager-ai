/** Login Client: OAuth + 게스트 로그인 */

'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import UnifiedProfileHeader from '@/components/shared/UnifiedProfileHeader';
import { isGuestFullAccessEnabled } from '@/config/guestMode';
// 게스트 로그인 관련 임포트 (lib/auth-state-manager로 통합)
import type { AuthUser } from '@/lib/auth/auth-state-manager';
import { authStateManager } from '@/lib/auth/auth-state-manager';
import {
  AUTH_SESSION_ID_KEY,
  AUTH_TYPE_KEY,
  AUTH_USER_KEY,
  LEGACY_GUEST_SESSION_COOKIE_KEY,
} from '@/lib/auth/guest-session-utils';
import {
  signInWithEmailMagicLink,
  signInWithOAuthProvider,
} from '@/lib/auth/supabase-auth-oauth';
import { PAGE_BACKGROUNDS } from '@/styles/design-constants';
import debug from '@/utils/debug';
import { renderAIGradientWithAnimation } from '@/utils/text-rendering';
import { LoginButtons } from './LoginButtons';
import {
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
type GuestLoginErrorCode =
  | 'guest_pin_invalid'
  | 'guest_pin_required'
  | 'guest_pin_rate_limited'
  | 'guest_region_blocked'
  | 'guest_session_issue_failed';

interface GuestLoginPayload {
  success?: boolean;
  error?: GuestLoginErrorCode | string;
  message?: string;
  sessionId?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  countryCode?: string;
}

const GUEST_PIN_PATTERN = /^\d{4}$/;

function parseRetryAfterSeconds(
  response: Response,
  payload: GuestLoginPayload
): number {
  const retryAfterHeader = response.headers.get('Retry-After');
  const headerValue = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(headerValue) && headerValue > 0) {
    return Math.ceil(headerValue);
  }

  const bodyValue = payload.retryAfterSeconds;
  if (typeof bodyValue === 'number' && Number.isFinite(bodyValue)) {
    return Math.max(1, Math.ceil(bodyValue));
  }

  return 0;
}

function createGuestAttemptSeed(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export default function LoginClient() {
  const _router = useRouter();
  const isGuestFullAccessMode = isGuestFullAccessEnabled();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<
    'github' | 'guest' | 'google' | 'email' | null
  >(null);
  const [guestSession, setGuestSession] = useState<GuestSessionData | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [guestPinInput, setGuestPinInput] = useState('');
  const [guestAttemptsLeft, setGuestAttemptsLeft] = useState<number | null>(
    null
  );
  const [guestLockUntilMs, setGuestLockUntilMs] = useState<number | null>(null);
  const [guestLockRemainingSeconds, setGuestLockRemainingSeconds] = useState(0);
  const [guestAttemptSeed] = useState(createGuestAttemptSeed);
  const [_showPulse, _setShowPulse] = useState<
    'github' | 'guest' | 'google' | 'email' | null
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

  useEffect(() => {
    debug.log('🎛️ [GuestMode] Login UI mode resolved', {
      mode: isGuestFullAccessMode ? 'full_access' : 'restricted',
    });

    if (isGuestFullAccessMode) {
      setGuestPinInput('');
      setGuestAttemptsLeft(null);
      setGuestLockUntilMs(null);
      setGuestLockRemainingSeconds(0);
    }
  }, [isGuestFullAccessMode]);

  useEffect(() => {
    if (!guestLockUntilMs) {
      setGuestLockRemainingSeconds(0);
      return;
    }

    const syncRemaining = () => {
      const remaining = Math.ceil((guestLockUntilMs - Date.now()) / 1000);
      if (remaining <= 0) {
        setGuestLockUntilMs(null);
        setGuestLockRemainingSeconds(0);
        return;
      }
      setGuestLockRemainingSeconds(remaining);
    };

    syncRemaining();
    const timer = window.setInterval(syncRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [guestLockUntilMs]);

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
      email: [
        '이메일 확인 중...',
        'Magic Link 생성 중...',
        '이메일 발송 중...',
        '보안 링크 전송 완료!',
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
    } else if (error === 'guest_region_blocked') {
      const countryCode = searchParams.get('country');
      setErrorMessage(
        countryCode
          ? `현재 지역(${countryCode})에서는 게스트 로그인이 제한됩니다. GitHub 또는 Google 로그인을 이용해주세요.`
          : '현재 지역에서는 게스트 로그인이 제한됩니다. GitHub 또는 Google 로그인을 이용해주세요.'
      );
    } else if (error === 'guest_pin_invalid') {
      setErrorMessage(
        '게스트 PIN 4자리가 올바르지 않습니다. 다시 확인해주세요.'
      );
    } else if (error === 'guest_pin_required') {
      setErrorMessage(
        '게스트 PIN이 설정되지 않았습니다. 관리자에게 문의해주세요.'
      );
    } else if (warning === 'no_session') {
      setSuccessMessage(
        '인증이 완료되었지만 세션이 생성되지 않았습니다. 게스트 모드를 이용해주세요.'
      );
    }
  }, []);

  // guestSession 상태가 변경되면 localStorage를 저장하고 페이지 이동
  useEffect(() => {
    if (guestSession) {
      // localStorage 저장 (Safari Private Browsing 대응)
      try {
        localStorage.setItem(AUTH_SESSION_ID_KEY, guestSession.sessionId);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(guestSession.user));
      } catch {
        // Safari Private Browsing 등 localStorage 쓰기 불가 시 무시
      }

      // 레거시 쿠키는 즉시 만료시켜 세션 판별 기준을 auth_session_id로 고정
      const isProduction = window.location.protocol === 'https:';
      const secureFlag = isProduction ? '; Secure' : '';
      document.cookie = `${LEGACY_GUEST_SESSION_COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
      document.cookie = `${AUTH_TYPE_KEY}=; path=/; max-age=0; SameSite=Lax${secureFlag}`;

      debug.log(
        '✅ 게스트 세션 저장 완료 (localStorage), 페이지 이동:',
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

      const { error } = await signInWithOAuthProvider('google');

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

      const { error } = await signInWithOAuthProvider('github');

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
      setErrorMessage(null);
      setSuccessMessage(null);

      debug.log('👤 게스트 로그인 시작...');

      if (guestLockRemainingSeconds > 0) {
        setErrorMessage(
          `게스트 PIN 재시도가 잠겨 있습니다. ${guestLockRemainingSeconds}초 후 다시 시도해주세요.`
        );
        return;
      }

      const secureId = guestAttemptSeed;

      const guestUser: AuthUser = {
        id: `guest_${secureId}`,
        name: '게스트 사용자',
        email: `guest_${secureId.substring(0, 8)}@example.com`,
        provider: 'guest',
      };

      let guestPin: string | undefined;
      if (!isGuestFullAccessMode) {
        const normalizedPin = guestPinInput.trim();
        if (!GUEST_PIN_PATTERN.test(normalizedPin)) {
          setErrorMessage('게스트 PIN은 4자리 숫자로 입력해주세요.');
          setGuestAttemptsLeft(null);
          return;
        }
        guestPin = normalizedPin;
      }

      // 잠금/실패 누적을 위해 시도 식별자를 로그인 시도 간 동일하게 유지
      let sessionId = `guest_${guestAttemptSeed}`;
      try {
        sessionId = localStorage.getItem(AUTH_SESSION_ID_KEY) || sessionId;
      } catch {
        // Safari Private Browsing 등 localStorage 접근 불가 시 fallback
      }

      // 서버 정책 검사 + 게스트 로그인 감사 로그 기록 (IP/Country는 서버에서 수집)
      try {
        const guestLoginAuditResponse = await fetch('/api/auth/guest-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            guestUserId: guestUser.id,
            guestEmail: guestUser.email,
            guestPin,
          }),
        });

        const payload = (await guestLoginAuditResponse
          .json()
          .catch(() => ({}))) as GuestLoginPayload;

        if (!guestLoginAuditResponse.ok) {
          const retryAfterSeconds = parseRetryAfterSeconds(
            guestLoginAuditResponse,
            payload
          );

          if (
            guestLoginAuditResponse.status === 429 ||
            payload.error === 'guest_pin_rate_limited'
          ) {
            if (retryAfterSeconds > 0) {
              setGuestLockUntilMs(Date.now() + retryAfterSeconds * 1000);
            }
            setGuestAttemptsLeft(0);
            setErrorMessage(
              payload.message ||
                `게스트 PIN을 5회 연속 잘못 입력했습니다. ${
                  retryAfterSeconds > 0 ? retryAfterSeconds : 60
                }초 후 다시 시도해주세요.`
            );
            return;
          }

          if (payload.error === 'guest_pin_invalid') {
            if (typeof payload.attemptsLeft === 'number') {
              setGuestAttemptsLeft(Math.max(0, payload.attemptsLeft));
            }
            setErrorMessage(
              payload.message ||
                '게스트 PIN 4자리가 올바르지 않습니다. 다시 확인해주세요.'
            );
            return;
          }

          if (payload.error === 'guest_pin_required') {
            setErrorMessage(
              payload.message ||
                '게스트 PIN이 설정되지 않았습니다. 관리자에게 문의해주세요.'
            );
            return;
          }

          if (payload.error === 'guest_region_blocked') {
            setErrorMessage(
              payload.message ||
                '현재 지역에서는 게스트 로그인이 제한됩니다. GitHub 또는 Google 로그인을 이용해주세요.'
            );
            return;
          }

          setErrorMessage(
            payload.message ||
              '게스트 로그인 검증에 실패했습니다. 잠시 후 다시 시도해주세요.'
          );
          return;
        }

        if (payload.sessionId && typeof payload.sessionId === 'string') {
          sessionId = payload.sessionId;
        }
      } catch (auditError) {
        debug.warn('⚠️ 게스트 로그인 감사 로그 API 호출 실패:', auditError);
        setErrorMessage(
          '게스트 로그인 검증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        );
        return;
      }

      await authStateManager.setGuestAuth(guestUser);
      setGuestAttemptsLeft(null);
      setGuestLockUntilMs(null);
      setGuestPinInput('');
      setGuestSession({ sessionId, user: guestUser });
    } catch (error) {
      debug.error('게스트 로그인 실패:', error);
      setErrorMessage('게스트 로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  // Email Magic Link 로그인
  const handleEmailLogin = async (email: string) => {
    try {
      _setShowPulse('email');
      setTimeout(() => _setShowPulse(null), PULSE_ANIMATION_DURATION_MS);

      setIsLoading(true);
      setLoadingType('email');
      setErrorMessage('');

      debug.log(`📧 Email Magic Link 로그인 시작: ${email}`);

      const { error } = await signInWithEmailMagicLink(email);

      if (error) {
        debug.error('❌ Email 로그인 실패:', error);

        const authError = error as AuthError;
        setErrorMessage(
          authError?.message || '이메일 로그인 링크 발송에 실패했습니다.'
        );

        setIsLoading(false);
        setLoadingType(null);
        return;
      }

      setSuccessMessage(
        '이메일로 로그인 링크가 발송되었습니다! 메일함을 확인해주세요.'
      );
      setIsLoading(false);
      setLoadingType(null);
    } catch (error) {
      debug.error('❌ Email 로그인 에러:', error);
      setErrorMessage('링크 전송 중 예상치 못한 오류가 발생했습니다.');
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
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      isGuestFullAccessMode
                        ? 'border-emerald-300/60 bg-emerald-400/20 text-emerald-100'
                        : 'border-amber-300/60 bg-amber-400/20 text-amber-100'
                    }`}
                  >
                    게스트 모드:{' '}
                    {isGuestFullAccessMode ? 'FULL ACCESS' : 'RESTRICTED'}
                  </span>
                  <span className="text-[11px] text-white/65">
                    모드 변경 시 배포 재시작이 필요합니다.
                  </span>
                </div>
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

                {!isGuestFullAccessMode && currentProvider !== 'guest' ? (
                  <div className="rounded-lg border border-cyan-200/45 bg-white/10 px-4 py-3 backdrop-blur-sm">
                    <label
                      htmlFor="guest-pin-input"
                      className="mb-2 block text-xs font-medium text-cyan-100/90"
                    >
                      게스트 PIN (4자리)
                    </label>
                    <input
                      id="guest-pin-input"
                      data-testid="guest-pin-input"
                      type="password"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="\d{4}"
                      maxLength={4}
                      value={guestPinInput}
                      onChange={(event) => {
                        const nextValue = event.target.value.replace(/\D/g, '');
                        setGuestPinInput(nextValue.slice(0, 4));
                      }}
                      disabled={isLoading || guestLockRemainingSeconds > 0}
                      placeholder="PIN 4자리 입력"
                      className="h-11 w-full rounded-lg border border-cyan-100/55 bg-white/85 px-3 text-sm tracking-[0.22em] text-slate-900 outline-none transition-all placeholder:tracking-normal placeholder:text-slate-400 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-200/60 disabled:opacity-60"
                    />
                    <div className="mt-2 text-xs text-cyan-100/85">
                      {guestLockRemainingSeconds > 0
                        ? `잠금 해제까지 ${guestLockRemainingSeconds}초`
                        : typeof guestAttemptsLeft === 'number'
                          ? `PIN 오류 남은 횟수: ${guestAttemptsLeft}회`
                          : '연속 5회 실패 시 1분 동안 재시도할 수 없습니다.'}
                    </div>
                  </div>
                ) : null}

                <LoginButtons
                  currentProvider={currentProvider}
                  isLoading={isLoading}
                  loadingType={loadingType}
                  onGitHub={() => void handleGitHubLogin()}
                  onGoogle={() => void handleGoogleLogin()}
                  onGuest={() => void handleGuestLogin()}
                  onEmail={(email) => void handleEmailLogin(email)}
                  onCancel={handleCancelLoading}
                  guestButtonDisabled={guestLockRemainingSeconds > 0}
                  guestButtonLabel={
                    guestLockRemainingSeconds > 0
                      ? `게스트 잠금 (${guestLockRemainingSeconds}초)`
                      : '게스트로 체험하기'
                  }
                  guestHelperText={
                    isGuestFullAccessMode
                      ? '현재 Full Access 모드입니다. PIN 없이 게스트 기능을 사용할 수 있습니다.'
                      : 'PIN 4자리를 입력한 뒤 게스트 로그인을 진행하세요.'
                  }
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
