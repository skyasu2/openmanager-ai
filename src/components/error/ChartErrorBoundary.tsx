'use client';

/**
 * Chart Error Boundary Component
 *
 * @description
 * - 차트 컴포넌트의 렌더링 에러를 캐치
 * - 사용자 친화적 폴백 UI 제공
 * - 재시도 기능
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/lib/logging';

interface ChartErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  height?: number;
  chartName?: string;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  private static readonly isDevelopment = process.env.NODE_ENV !== 'production';

  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ChartErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('[ChartErrorBoundary] 차트 렌더링 오류:', error);
    logger.error(
      '[ChartErrorBoundary] 컴포넌트 스택:',
      errorInfo.componentStack
    );
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, height = 200, chartName } = this.props;
    const isDevelopment = ChartErrorBoundary.isDevelopment;

    if (!hasError) {
      return children;
    }

    if (fallback) {
      return fallback;
    }

    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50/50"
        style={{ height }}
      >
        <AlertTriangle className="mb-2 h-8 w-8 text-amber-500" />
        <p className="mb-1 text-sm font-medium text-amber-700">
          {chartName ? `${chartName} ` : ''}차트 로드 실패
        </p>
        <p className="mb-3 text-xs text-amber-600">
          {isDevelopment
            ? error?.message || '데이터 렌더링 중 오류가 발생했습니다'
            : '차트 데이터를 불러오는 중 문제가 발생했습니다'}
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50"
        >
          <RefreshCw className="h-3 w-3" />
          다시 시도
        </button>
      </div>
    );
  }
}
