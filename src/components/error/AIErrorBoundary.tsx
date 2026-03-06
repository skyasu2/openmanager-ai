/**
 * AI Error Boundary Component
 *
 * @description
 * - AI 관련 컴포넌트의 에러를 캐치하고 복구 UI 제공
 * - 에러 로깅 및 사용자 친화적 메시지 표시
 * - 재시도 기능 제공
 *
 * @created 2025-12-30
 */

'use client';

import { AlertTriangle, Copy, RefreshCw } from 'lucide-react';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/lib/logging';

// ============================================================================
// Types
// ============================================================================

interface AIErrorBoundaryProps {
  /** 자식 컴포넌트 */
  children: ReactNode;
  /** 커스텀 폴백 UI */
  fallback?: ReactNode;
  /** 에러 발생 시 콜백 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 리셋 시 콜백 */
  onReset?: () => void;
  /** 컴포넌트 이름 (로깅용) */
  componentName?: string;
}

interface AIErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

// ============================================================================
// Component
// ============================================================================

export class AIErrorBoundary extends Component<
  AIErrorBoundaryProps,
  AIErrorBoundaryState
> {
  private static readonly isDevelopment = process.env.NODE_ENV !== 'production';

  constructor(props: AIErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AIErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // 에러 로깅
    logger.error(
      `[AIErrorBoundary${this.props.componentName ? `:${this.props.componentName}` : ''}] Error caught:`,
      error,
      errorInfo
    );

    // 콜백 호출
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
    this.props.onReset?.();
  };

  handleCopyError = async (): Promise<void> => {
    const { error, errorInfo } = this.state;
    const errorText = `Error: ${error?.message}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}`;

    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      logger.warn('Failed to copy error to clipboard');
    }
  };

  render(): ReactNode {
    const { hasError, error, copied } = this.state;
    const { children, fallback } = this.props;
    const isDevelopment = AIErrorBoundary.isDevelopment;

    if (!hasError) {
      return children;
    }

    // 커스텀 폴백이 있으면 사용
    if (fallback) {
      return fallback;
    }

    // 기본 에러 UI
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-linear-to-br from-red-50 to-orange-50 p-6 shadow-sm">
          {/* 헤더 */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-800">
                AI 서비스 오류
              </h3>
              <p className="text-xs text-red-600">
                일시적인 문제가 발생했습니다
              </p>
            </div>
          </div>

          {/* 에러 메시지 */}
          <div className="mb-4 rounded-lg bg-white/60 p-3">
            <p className="text-sm text-gray-700">
              {isDevelopment
                ? error?.message || '알 수 없는 오류가 발생했습니다.'
                : 'AI 처리 중 일시적인 문제가 발생했습니다. 다시 시도해주세요.'}
            </p>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </button>
            {isDevelopment && (
              <button
                type="button"
                onClick={this.handleCopyError}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                title="오류 정보 복사"
              >
                <Copy className="h-4 w-4" />
                {copied ? '복사됨!' : '복사'}
              </button>
            )}
          </div>

          {/* 도움말 */}
          <p className="mt-4 text-center text-xs text-gray-500">
            문제가 지속되면 페이지를 새로고침해주세요
          </p>
        </div>
      </div>
    );
  }
}

// ============================================================================
// Functional Wrapper (for hooks support in future)
// ============================================================================

interface AIErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

/**
 * 간단한 에러 폴백 컴포넌트 (함수형)
 */
export function AIErrorFallback({
  error,
  resetError,
}: AIErrorFallbackProps): ReactNode {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-600" />
        <p className="mb-3 text-sm text-amber-800">{error.message}</p>
        <button
          type="button"
          onClick={resetError}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// HOC for wrapping components
// ============================================================================

/**
 * 컴포넌트를 Error Boundary로 래핑하는 HOC
 */
export function withAIErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  boundaryProps?: Omit<AIErrorBoundaryProps, 'children'>
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <AIErrorBoundary {...boundaryProps}>
      <WrappedComponent {...props} />
    </AIErrorBoundary>
  );

  WithErrorBoundary.displayName = `withAIErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithErrorBoundary;
}

export default AIErrorBoundary;
