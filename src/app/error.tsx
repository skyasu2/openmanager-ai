'use client';

import * as Sentry from '@sentry/nextjs';
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
    logger.error(error);
    Sentry.captureException(error, {
      tags: { boundary: 'global-error', digest: error.digest },
    });
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1>오류가 발생했습니다</h1>
      <p>시스템에 일시적인 문제가 발생했습니다.</p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: '10px 20px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
        }}
      >
        다시 시도
      </button>
    </div>
  );
}
