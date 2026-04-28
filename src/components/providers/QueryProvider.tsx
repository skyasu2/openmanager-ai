/**
 * @fileoverview React Query Provider 컴포넌트
 *
 * React Query 클라이언트를 설정하고 전역적으로 제공합니다.
 * 캐싱, 재시도, 에러 처리 등의 설정을 포함합니다.
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { type ReactNode, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// React Query DevTools는 개발 환경에서만 클라이언트 렌더링으로 로드한다.
// React.lazy()는 기본적으로 프리렌더링되므로 hydration mismatch를 유발할 수 있다.
const ReactQueryDevtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () =>
          import('@tanstack/react-query-devtools').then(
            (module) => module.ReactQueryDevtools
          ),
        { ssr: false, loading: () => null }
      )
    : null;

// 공유 QueryClient 인스턴스
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 자동 재시도 설정
      retry: (failureCount, error: unknown) => {
        // 400번대 에러는 재시도하지 않음
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        // 최대 3번까지 재시도
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // 캐시 설정
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분 (cacheTime에서 gcTime으로 변경)

      // 백그라운드 리페치 설정
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      // 뮤테이션 재시도 설정
      retry: 2,
      retryDelay: 1000,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * 에러 바운더리 컴포넌트
 */
function QueryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-bold text-red-600">
              문제가 발생했습니다
            </h2>
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              다시 시도
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * React Query Provider 컴포넌트
 *
 * 애플리케이션 전체에 React Query 클라이언트를 제공하고,
 * 에러 바운더리로 안정성을 보장합니다.
 */
export default function QueryProvider({ children }: QueryProviderProps) {
  const [isDevtoolsMounted, setIsDevtoolsMounted] = useState(false);

  useEffect(() => {
    setIsDevtoolsMounted(true);
  }, []);

  return (
    <QueryErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
        {/* 개발 환경에서만 DevTools 동적 로드 (프로덕션 번들에서 제외) */}
        {isDevtoolsMounted && ReactQueryDevtools ? (
          <ReactQueryDevtools initialIsOpen={false} />
        ) : null}
      </QueryClientProvider>
    </QueryErrorBoundary>
  );
}
