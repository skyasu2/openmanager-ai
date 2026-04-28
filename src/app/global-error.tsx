'use client';

/**
 * 🚨 Global Error Handler for Next.js 15 App Router
 * 최상위 레벨 에러 처리 (500, unhandled errors)
 */

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { logger } from '@/lib/logging';
import debug from '@/utils/debug';

// 클라이언트 컴포넌트에서 안전하게 환경 감지
const getClientEnvironment = () => {
  // NEXT_PUBLIC_VERCEL_ENV는 클라이언트에서 접근 가능
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  const nodeEnv = process.env.NODE_ENV;

  return {
    isProduction: nodeEnv === 'production',
    isDevelopment: nodeEnv === 'development',
    isVercel: vercelEnv === 'production' || vercelEnv === 'preview',
    nodeEnv: nodeEnv || 'development',
  };
};

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const clientEnv = useMemo(() => getClientEnvironment(), []);

  useEffect(() => {
    if (clientEnv.isProduction) {
      Sentry.captureException(error, {
        tags: { boundary: 'global-error', digest: error.digest },
      });

      const platform = clientEnv.isVercel ? 'vercel' : 'local';

      debug.error('[GLOBAL_ERROR]', {
        error: error.message,
        digest: error.digest,
        environment: clientEnv.nodeEnv,
        platform: platform,
      });

      // 외부 리포팅 서비스 연동 지점
      logger.error('[GLOBAL_ERROR_REPORT]', {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        userAgent:
          typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
        url: typeof window !== 'undefined' ? window.location.href : 'Unknown',
        environment: clientEnv.nodeEnv,
        platform: platform,
      });
    }
  }, [error, clientEnv]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-red-900 via-gray-900 to-red-900">
      <div className="mx-auto max-w-md space-y-6 p-8 text-center">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600/20">
            <svg
              className="h-10 w-10 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white">500</h1>
          <h2 className="text-xl font-semibold text-red-300">서버 오류 발생</h2>
          <p className="text-sm text-gray-400">
            예상치 못한 오류가 발생했습니다. 문제가 자동으로 보고되었습니다.
          </p>
        </div>

        {clientEnv.isDevelopment && (
          <div className="rounded-lg bg-gray-800/50 p-4 text-left">
            <h3 className="mb-2 text-sm font-semibold text-red-400">
              개발 모드 에러 정보:
            </h3>
            <div className="space-y-1 text-xs text-gray-300">
              <p>
                <span className="text-red-400">메시지:</span> {error.message}
              </p>
              {error.digest && (
                <p>
                  <span className="text-red-400">Digest:</span> {error.digest}
                </p>
              )}
              <p>
                <span className="text-red-400">환경:</span> {clientEnv.nodeEnv}
              </p>
              <p>
                <span className="text-red-400">플랫폼:</span>{' '}
                {clientEnv.isVercel ? 'vercel' : 'local'}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg bg-red-600 px-6 py-3 font-medium text-white transition-colors hover:bg-red-700"
            >
              다시 시도
            </button>
            <Link
              href="/"
              className="inline-block rounded-lg bg-gray-600 px-6 py-3 text-center font-medium text-white transition-colors hover:bg-gray-700"
            >
              홈으로 돌아가기
            </Link>
          </div>

          <Link
            href="/"
            className="text-sm text-blue-400 transition-colors hover:text-blue-300"
          >
            메인으로 이동 →
          </Link>
        </div>

        <div className="space-y-1 text-xs text-gray-500">
          <p>문제가 지속되면 브라우저를 새로고침하거나</p>
          <p>잠시 후 다시 시도해주세요.</p>
          {clientEnv.isProduction && (
            <p className="text-gray-600">에러 ID: {error.digest || 'N/A'}</p>
          )}
        </div>
      </div>
    </div>
  );
}
