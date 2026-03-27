'use client';

/**
 * DiagramErrorBoundary Component
 * @description React Flow 전용 에러 바운더리
 * - 다이어그램 렌더링 실패 시 전체 앱 크래시 방지
 * - 사용자 친화적 오류 메시지 표시
 */

import React, { Component, type ReactNode } from 'react';
import { logger } from '@/lib/logging';

interface DiagramErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  diagramTitle?: string;
}

interface DiagramErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class DiagramErrorBoundary extends Component<
  DiagramErrorBoundaryProps,
  DiagramErrorBoundaryState
> {
  constructor(props: DiagramErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): DiagramErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('[ReactFlowDiagram] 렌더링 오류:', error);
    logger.error('[ReactFlowDiagram] 컴포넌트 스택:', errorInfo.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-card-lg flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 p-8">
          <div className="mb-4 text-4xl">⚠️</div>
          <h3 className="mb-2 text-lg font-semibold text-red-400">
            다이어그램 로드 실패
          </h3>
          <p className="mb-4 text-center text-sm text-gray-400">
            {this.props.diagramTitle
              ? `"${this.props.diagramTitle}" 다이어그램을 표시할 수 없습니다.`
              : '다이어그램을 표시할 수 없습니다.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            다시 시도
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
