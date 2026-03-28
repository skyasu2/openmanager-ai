'use client';

import * as Sentry from '@sentry/nextjs';
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
    Sentry.captureException(error, {
      tags: { boundary: 'login', digest: error.digest },
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
        background: '#0f172a',
        color: 'white',
      }}
    >
      <h1>로그인 페이지 오류</h1>
      <p style={{ color: '#9ca3af', marginBottom: '24px' }}>
        로그인 처리 중 예기치 않은 문제가 발생했습니다.
      </p>
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
