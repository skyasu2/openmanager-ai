'use client';

import { AlertTriangle, LogIn, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { logger } from '@/lib/logging';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center font-sans text-white"
      data-testid="auth-error-boundary"
      role="alert"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold">인증 오류가 발생했습니다</h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        로그인 처리 중 문제가 발생했습니다. 다시 시도하거나 로그인 페이지로
        이동하세요.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          다시 시도
        </button>
        <a
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          로그인으로
        </a>
      </div>
    </div>
  );
}
