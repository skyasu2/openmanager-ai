'use client';

import { Mail, User } from 'lucide-react';
import { useState } from 'react';

type LoadingType = 'github' | 'guest' | 'google' | 'email' | null;

type LoginButtonsProps = {
  currentProvider: string | null;
  isLoading: boolean;
  loadingType: LoadingType;
  onGitHub: () => void;
  onGoogle: () => void;
  onGuest: () => void;
  onEmail: (email: string) => void;
  onCancel: () => void;
  glassButtonBaseClass: string;
  providerOverlayClass: string;
  guestOverlayClass: string;
};

const Spinner = () => (
  <div className="relative z-10 h-4 w-4 animate-spin rounded-full border-2 border-cyan-200 border-t-slate-700" />
);

export function LoginButtons({
  currentProvider,
  isLoading,
  loadingType,
  onGitHub,
  onGoogle,
  onGuest,
  onEmail,
  onCancel,
  glassButtonBaseClass,
  providerOverlayClass,
  guestOverlayClass,
}: LoginButtonsProps) {
  const [email, setEmail] = useState('');

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && !isLoading) {
      onEmail(email);
    }
  };

  return (
    <>
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            placeholder="이메일 주소"
            className="h-12 w-full rounded-xl border border-cyan-100/50 bg-white/70 pl-11 pr-4 text-sm text-slate-800 outline-none backdrop-blur-sm transition-all placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white focus:ring-2 focus:ring-cyan-100 disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !email}
          className={`${glassButtonBaseClass} bg-slate-800! text-white! hover:bg-slate-700! hover:border-slate-600!`}
        >
          {loadingType === 'email' ? <Spinner /> : null}
          <span className="relative z-10 text-sm font-medium tracking-wide">
            이메일로 계속하기
          </span>
        </button>
      </form>

      {currentProvider !== 'guest' && (
        <div className="relative my-2 flex items-center gap-4">
          <div className="h-px w-full bg-cyan-200/55" />
          <span className="whitespace-nowrap text-xs font-medium text-cyan-100/80">
            소셜 로그인
          </span>
          <div className="h-px w-full bg-cyan-200/55" />
        </div>
      )}

      {currentProvider !== 'google' && (
        <button
          type="button"
          onClick={onGoogle}
          disabled={isLoading}
          aria-label="Google 계정으로 로그인"
          className={glassButtonBaseClass}
        >
          <span className={providerOverlayClass} />
          {loadingType === 'google' ? (
            <Spinner />
          ) : (
            <svg
              className="relative z-10 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
          )}
          <span className="relative z-10 text-sm font-medium tracking-wide">
            Google로 계속하기
          </span>
        </button>
      )}

      {currentProvider !== 'github' && (
        <button
          type="button"
          onClick={onGitHub}
          disabled={isLoading}
          aria-label="GitHub 계정으로 로그인"
          className={glassButtonBaseClass}
        >
          <span className={providerOverlayClass} />
          {loadingType === 'github' ? (
            <Spinner />
          ) : (
            <svg
              className="relative z-10 h-5 w-5 text-slate-800"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          )}
          <span className="relative z-10 text-sm font-medium tracking-wide">
            GitHub로 계속하기
          </span>
        </button>
      )}

      {currentProvider !== 'guest' && (
        <div className="relative my-2 flex items-center gap-4">
          <div className="h-px w-full bg-cyan-200/55" />
          <span className="whitespace-nowrap text-xs font-medium text-cyan-100/80">
            체험하기
          </span>
          <div className="h-px w-full bg-cyan-200/55" />
        </div>
      )}

      {isLoading && (
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-full items-center justify-center rounded-lg border border-cyan-100/80 bg-white/85 text-sm text-slate-700 transition-colors hover:bg-white"
        >
          취소
        </button>
      )}

      {currentProvider !== 'guest' && (
        <button
          type="button"
          onClick={onGuest}
          disabled={isLoading}
          aria-label="게스트 모드로 체험하기"
          className={glassButtonBaseClass}
        >
          <span className={guestOverlayClass} />
          {loadingType === 'guest' ? (
            <Spinner />
          ) : (
            <User className="relative z-10 h-4 w-4 text-slate-600 transition-colors group-hover:text-slate-900" />
          )}
          <span className="relative z-10 text-sm font-medium tracking-wide">
            게스트로 체험하기
          </span>
        </button>
      )}
    </>
  );
}
