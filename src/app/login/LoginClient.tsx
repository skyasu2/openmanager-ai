/**
 * Login Client: OAuth + 게스트 로그인
 *
 * [보안 경고 오탐 방지]
 * Supabase Security Advisor가 "Leaked Password Protection Disabled" 경고를 표시하지만,
 * 이 프로젝트는 이메일+비밀번호 로그인을 사용하지 않으므로 해당 경고는 오탐(false positive)이다.
 *
 * 실제 인증 방식:
 *  - Google OAuth    → signInWithOAuthProvider('google')
 *  - GitHub OAuth    → signInWithOAuthProvider('github')
 *  - Email Magic Link → signInWithEmailMagicLink(email)  ← 비밀번호 없음
 *  - Guest PIN       → /api/auth/guest-login (Supabase Auth 미사용, 자체 구현)
 *
 * 결론: 유출 비밀번호 체크 적용 대상 없음. Pro plan 업그레이드 불필요.
 */

'use client';

import { type FormEvent, useState } from 'react';
import { MouseSpotlight } from '@/components/landing/MouseSpotlight';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { APP_VERSION } from '@/config/app-meta';
import {
  isGuestFullAccessEnabled,
  isGuestLoginButtonVisible,
} from '@/config/guestMode';
import {
  signInWithEmailMagicLink,
  signInWithOAuthProvider,
} from '@/lib/auth/supabase-auth-oauth';
import debug from '@/utils/debug';
import { renderAIGradientWithAnimation } from '@/utils/text-rendering';
import { useGuestLogin, useLoadingMessages, useLoginUrlParams } from './hooks';
import { LoginButtons } from './LoginButtons';
import type { LoadingType } from './login.constants';

type AuthError = { message?: string; code?: string };

export default function LoginClient() {
  const isGuestFullAccessMode = isGuestFullAccessEnabled();
  const showGuestLogin = isGuestLoginButtonVisible();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<LoadingType>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

  const { currentProvider } = useLoginUrlParams({
    setErrorMessage,
    setSuccessMessage,
  });

  const {
    guestPinInput,
    setGuestPinInput,
    guestAttemptsLeft,
    guestLockRemainingSeconds,
    handleGuestLogin,
  } = useGuestLogin({
    setIsLoading,
    setLoadingType,
    setErrorMessage,
    setSuccessMessage,
  });

  const { loadingMessage, handleCancelLoading } = useLoadingMessages(
    isLoading,
    loadingType,
    { setIsLoading, setLoadingType, setSuccessMessage }
  );

  const handleGuestModalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      isLoading ||
      guestLockRemainingSeconds > 0 ||
      guestPinInput.length < 4
    ) {
      return;
    }
    void handleGuestLogin();
  };

  // Google OAuth 로그인
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      setLoadingType('google');
      setErrorMessage('');

      debug.log('🔐 Google OAuth 로그인 시작 (Supabase Auth)...');

      const { error } = await signInWithOAuthProvider('google');

      if (error) {
        debug.error('❌ Google 로그인 실패:', error);
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

        let errorMsg = 'GitHub 로그인에 실패했습니다.';
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
    } catch (error) {
      debug.error('❌ GitHub 로그인 에러:', error);
      setErrorMessage(
        '로그인 중 예상치 못한 오류가 발생했습니다. 게스트 모드를 이용해주세요.'
      );
      setIsLoading(false);
      setLoadingType(null);
    }
  };

  // Email Magic Link 로그인
  const handleEmailLogin = async (email: string): Promise<boolean> => {
    try {
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
        return false;
      }

      setSuccessMessage(
        '이메일로 로그인 링크가 발송되었습니다! 메일함을 확인해주세요.'
      );
      setIsLoading(false);
      setLoadingType(null);
      return true;
    } catch (error) {
      debug.error('❌ Email 로그인 에러:', error);
      setErrorMessage('링크 전송 중 예상치 못한 오류가 발생했습니다.');
      setIsLoading(false);
      setLoadingType(null);
      return false;
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-black font-sans">
      <MouseSpotlight />
      <div className="wave-particles" />

      <header className="relative z-50 flex items-center p-4 sm:p-6">
        <OpenManagerLogo
          variant="dark"
          href="/"
          titleAs="p"
          showSubtitle={false}
        />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-8 pt-2 sm:pt-4">
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.06] px-8 py-10 shadow-[0_24px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            {/* 상단 인디고 엣지 라인 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-indigo-400/50 to-transparent" />
            {/* 내부 광택 */}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/[0.10] via-white/[0.04] to-transparent" />
            <div className="relative">
              {/* Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-5 h-12 w-12 rounded-xl bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_32px_rgba(129,92,255,0.45)]" />
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

                {errorMessage && !isGuestModalOpen && (
                  <div className="rounded-lg border border-red-300/35 bg-red-500/15 px-4 py-3 text-sm text-red-100 backdrop-blur-sm">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 backdrop-blur-sm">
                    {successMessage}
                  </div>
                )}

                <Dialog
                  open={isGuestModalOpen}
                  onOpenChange={(open) => {
                    setIsGuestModalOpen(open);
                    if (!open) {
                      setErrorMessage(null);
                    }
                  }}
                >
                  <DialogContent className="border-indigo-500/25 bg-[#0a0a0f] sm:max-w-md">
                    <DialogHeader className="text-center">
                      <DialogTitle className="text-xl font-semibold text-white">
                        게스트 로그인
                      </DialogTitle>
                      <DialogDescription className="text-slate-300">
                        게스트 모드 접근을 위한 4자리 PIN을 입력해주세요.
                      </DialogDescription>
                    </DialogHeader>

                    {errorMessage && (
                      <div className="mt-2 rounded-lg border border-red-300/35 bg-red-500/15 px-4 py-3 text-sm text-red-100 backdrop-blur-sm">
                        {errorMessage}
                      </div>
                    )}

                    <form onSubmit={handleGuestModalSubmit} className="mt-4">
                      <div className="rounded-lg bg-white/[0.06] p-4">
                        <label
                          htmlFor="guest-pin-input"
                          className="mb-2 block text-sm font-medium text-white/80"
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
                            const nextValue = event.target.value.replace(
                              /\D/g,
                              ''
                            );
                            setGuestPinInput(nextValue.slice(0, 4));
                          }}
                          disabled={isLoading || guestLockRemainingSeconds > 0}
                          placeholder="PIN 4자리 입력"
                          className="h-12 w-full rounded-lg border border-white/[0.15] bg-black/40 px-4 text-center text-lg tracking-[0.25em] text-white outline-none transition-all placeholder:text-base placeholder:tracking-normal placeholder:text-white/30 focus:border-indigo-400/60 focus:ring-1 focus:ring-indigo-400/20 disabled:opacity-60"
                        />
                        <div className="mt-3 text-center text-xs text-red-300/80">
                          {guestLockRemainingSeconds > 0
                            ? `잠금 해제까지 ${guestLockRemainingSeconds}초 남았습니다.`
                            : typeof guestAttemptsLeft === 'number'
                              ? `남은 시도 횟수: ${guestAttemptsLeft}회`
                              : '연속 5회 실패 시 1분간 잠금 상태가 됩니다.'}
                        </div>
                      </div>

                      <div className="mt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setIsGuestModalOpen(false)}
                          className="h-11 w-full rounded-lg border border-white/[0.12] bg-white/[0.06] text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.10]"
                        >
                          취소
                        </button>
                        <button
                          type="submit"
                          disabled={
                            isLoading ||
                            guestLockRemainingSeconds > 0 ||
                            guestPinInput.length < 4
                          }
                          className="h-11 w-full rounded-lg bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {isLoading ? '로그인 중...' : '로그인'}
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>

                <LoginButtons
                  currentProvider={currentProvider}
                  isLoading={isLoading}
                  loadingType={loadingType}
                  onGitHub={() => void handleGitHubLogin()}
                  onGoogle={() => void handleGoogleLogin()}
                  onGuest={() => {
                    if (!isGuestFullAccessMode) {
                      setIsGuestModalOpen(true);
                    } else {
                      void handleGuestLogin();
                    }
                  }}
                  onEmail={handleEmailLogin}
                  onCancel={handleCancelLoading}
                  showGuestLogin={showGuestLogin}
                  guestButtonDisabled={guestLockRemainingSeconds > 0}
                  guestButtonLabel={
                    guestLockRemainingSeconds > 0
                      ? `게스트 잠금 (${guestLockRemainingSeconds}초)`
                      : '게스트로 체험하기'
                  }
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-white/60">
              OpenManager AI v{APP_VERSION}
            </p>
            <a
              href="/privacy"
              className="mt-1.5 inline-flex min-h-8 items-center justify-center px-2 text-xs text-white/60 transition-colors hover:text-white/85"
            >
              개인정보 처리방침
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
