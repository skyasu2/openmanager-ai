'use client';

import * as Sentry from '@sentry/nextjs';
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
    Sentry.captureException(error, {
      tags: { boundary: 'auth', digest: error.digest },
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
      <h1>인증 오류가 발생했습니다</h1>
      <p>
        로그인 처리 중 문제가 발생했습니다. 다시 시도하거나 로그인 페이지로
        이동하세요.
      </p>
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
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
        <a
          href="/login"
          style={{
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          로그인으로
        </a>
      </div>
    </div>
  );
}
