'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logging';

export default function LoginError({
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-center font-sans text-white">
      <h1 className="text-2xl font-semibold">로그인 페이지 오류</h1>
      <p className="mb-6 mt-3 text-sm text-gray-400">
        로그인 처리 중 예기치 않은 문제가 발생했습니다.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
      >
        다시 시도
      </button>
    </div>
  );
}
