'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { logger } from '@/lib/logging';

// biome-ignore lint/suspicious/noShadowRestrictedNames: Next.js error page convention requires 'error' prop name
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      logger.error(error);
    }
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center font-sans text-white"
      data-testid="app-error-boundary"
      role="alert"
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300">
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-semibold">오류가 발생했습니다</h1>
      <p className="mt-3 max-w-md text-sm text-slate-400">
        시스템에 일시적인 문제가 발생했습니다.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        다시 시도
      </button>
    </div>
  );
}
