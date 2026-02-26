/** Login Client: OAuth + 게스트 로그인 */

'use client';

import { type FormEvent, useState } from 'react';
import { OpenManagerLogo } from '@/components/shared/OpenManagerLogo';
import UnifiedProfileHeader from '@/components/shared/UnifiedProfileHeader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  isGuestFullAccessEnabled,
  isGuestLoginButtonVisible,
} from '@/config/guestMode';
import {
  signInWithEmailMagicLink,
  signInWithOAuthProvider,
} from '@/lib/auth/supabase-auth-oauth';
import { PAGE_BACKGROUNDS } from '@/styles/design-constants';
import debug from '@/utils/debug';
import { renderAIGradientWithAnimation } from '@/utils/text-rendering';
import { useGuestLogin, useLoadingMessages, useLoginUrlParams } from './hooks';
import { LoginButtons } from './LoginButtons';

type AuthError = { message?: string; code?: string };

export default function LoginClient() {
  const isGuestFullAccessMode = isGuestFullAccessEnabled();
  const showGuestLogin = isGuestLoginButtonVisible();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<
    'github' | 'guest' | 'google' | 'email' | null
  >(null);
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

  const glassButtonBaseClass =
    'group relative flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-xl border border-cyan-100/80 bg-white/92 text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.16)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-50 hover:bg-white hover:shadow-[0_12px_24px_rgba(15,23,42,0.24)] active:scale-[0.98] disabled:opacity-60';
  const providerOverlayClass =
    'pointer-events-none absolute inset-0 rounded-xl bg-linear-to-r from-blue-200/40 via-indigo-200/30 to-cyan-200/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100';
  const guestOverlayClass =
    'pointer-events-none absolute inset-0 rounded-xl bg-linear-to-r from-slate-100/40 via-white/50 to-slate-100/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100';

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
  const handleEmailLogin = async (email: string) => {
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

  return (
    <div
      className={`relative flex min-h-screen flex-col overflow-hidden font-sans ${PAGE_BACKGROUNDS.DARK_PAGE_BG}`}
    >
      <div className="wave-particles" />

      <header className="relative z-50 flex items-center justify-between p-4 sm:p-6">
        <OpenManagerLogo variant="dark" href="/" titleAs="p" />
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

                <Dialog
                  open={isGuestModalOpen}
                  onOpenChange={setIsGuestModalOpen}
                >
                  <DialogContent className="border-cyan-500/30 bg-slate-900 sm:max-w-md">
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
                      <div className="rounded-lg bg-slate-800/50 p-4">
                        <label
                          htmlFor="guest-pin-input"
                          className="mb-2 block text-sm font-medium text-cyan-100"
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
                          className="h-12 w-full rounded-lg border border-slate-600 bg-slate-900 px-4 text-center text-lg tracking-[0.25em] text-white outline-none transition-all placeholder:text-base placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 disabled:opacity-60"
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
                          className="h-11 w-full rounded-lg border border-slate-700 bg-slate-800 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
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
                          className="h-11 w-full rounded-lg bg-cyan-600 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
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
                  onEmail={(email) => void handleEmailLogin(email)}
                  onCancel={handleCancelLoading}
                  showGuestLogin={showGuestLogin}
                  guestButtonDisabled={guestLockRemainingSeconds > 0}
                  guestButtonLabel={
                    guestLockRemainingSeconds > 0
                      ? `게스트 잠금 (${guestLockRemainingSeconds}초)`
                      : '게스트로 체험하기'
                  }
                  guestHelperText={
                    isGuestFullAccessMode
                      ? '현재 Full Access 모드입니다. 테스트 목적에 한해 게스트 기능을 사용할 수 있습니다.'
                      : '게스트 로그인은 테스트 용도입니다. PIN을 입력해 제한된 체험을 진행하세요.'
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
