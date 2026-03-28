'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { logger } from '@/lib/logging';

export default function AIAssistantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(error);
    Sentry.captureException(error, {
      tags: { boundary: 'ai-assistant', digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <p className="mb-2 text-2xl font-bold text-white">AI Assistant 오류</p>
        <p className="mb-6 text-sm text-gray-400">
          AI 응답 처리 중 문제가 발생했습니다. 다시 시도하거나 대시보드로
          돌아가세요.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            다시 시도
          </button>
          <a
            href="/dashboard"
            className="rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
          >
            대시보드로
          </a>
        </div>
      </div>
    </div>
  );
}
