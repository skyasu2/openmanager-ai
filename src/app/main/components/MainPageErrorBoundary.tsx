/**
 * 🛡️ 메인 페이지 에러 바운더리
 *
 * React Error Boundary 패턴으로 컴포넌트 레벨 에러 처리
 */

'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ReactNode } from 'react';
import { logger } from '@/lib/logging';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MainPageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('🚨 MainPage Error Boundary caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage } = this.props;
      const showErrorDetails = process.env.NODE_ENV !== 'production';

      return (
        <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
          <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-red-400" />
            <h2 className="mb-2 text-xl font-bold text-white">
              {fallbackTitle || '문제가 발생했습니다'}
            </h2>
            <p className="mb-4 text-sm text-gray-300">
              {fallbackMessage ||
                '페이지 로딩 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'}
            </p>
            {showErrorDetails && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300">
                  오류 세부 정보
                </summary>
                <pre className="mt-2 overflow-auto rounded bg-black/30 p-2 text-xs text-red-300">
                  {this.state.error.message}
                </pre>
              </details>
            )}
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              다시 시도
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
