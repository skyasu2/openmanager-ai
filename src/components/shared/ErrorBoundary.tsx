'use client';

import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { logger } from '@/lib/logging';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  // 🎯 오류 타입 분석
  const isDataError =
    error.message.includes('filter') ||
    error.message.includes('배열') ||
    error.message.includes('서버 데이터');
  const isNetworkError =
    error.message.includes('fetch') ||
    error.message.includes('network') ||
    error.message.includes('HTTP');

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="mx-4 w-full max-w-md">
        <div className="rounded-lg border border-red-200 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center">
            <div className="shrink-0">
              <svg
                className="h-8 w-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-red-800">
                {isDataError
                  ? '서버 데이터 오류'
                  : isNetworkError
                    ? '네트워크 연결 오류'
                    : '대시보드 로딩 오류'}
              </h3>
            </div>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-sm text-red-600">
              {isDataError
                ? '서버 데이터 형식 문제로 인한 일시적 오류입니다. 데이터가 안전하게 복구됩니다.'
                : isNetworkError
                  ? '네트워크 연결 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
                  : 'Redis 연결 문제로 인한 일시적 오류입니다.'}
            </p>
            <details className="text-xs text-gray-600">
              <summary className="cursor-pointer hover:text-gray-800">
                기술적 상세정보
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-xs">
                {error.message}
              </pre>
            </details>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={() => (window.location.href = '/')}
              className="flex-1 rounded-md bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700 focus:outline-hidden focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              홈으로 이동
            </button>
          </div>

          {isDataError && (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-700">
                💡 <strong>자동 복구:</strong> 시스템이 안전한 기본 데이터로
                자동 전환됩니다.
              </p>
            </div>
          )}

          <div className="mt-4 text-center text-xs text-gray-500">
            문제가 지속되면 개발팀에 문의해주세요.
          </div>
        </div>
      </div>
    </div>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ComponentType<ErrorFallbackProps>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    // 에러 리포팅 서비스에 전송 (선택사항)
    if (typeof window !== 'undefined') {
      try {
        // 에러 로깅
        localStorage.setItem(
          'lastError',
          JSON.stringify({
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
          })
        );
      } catch (e) {
        logger.warn('Failed to log error to localStorage:', e);
      }
    }
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || ErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          resetErrorBoundary={this.resetErrorBoundary}
        />
      );
    }

    return this.props.children;
  }
}

// Hook 기반 에러 바운더리 (함수형 컴포넌트용)
export function withErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  fallbackComponent?: ComponentType<ErrorFallbackProps>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallbackComponent}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
