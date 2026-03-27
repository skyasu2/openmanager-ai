/**
 * 🛡️ Server Card Error Boundary
 *
 * 실시간 데이터 업데이트 중 발생할 수 있는 예외상황을 처리하여
 * 전체 앱 크래시를 방지하는 에러 바운더리 컴포넌트
 *
 * Codex 제안사항 반영: 프로덕션 환경에서의 안정성 확보
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/lib/logging';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  serverId?: string; // 디버깅 컨텍스트용 (Gemini 리뷰 반영)
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ServerCardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 🛡️ AI 교차검증: TypeError 특별 처리 - 30+ TypeError 원인 추적
    const isTypeError =
      error.message.includes('.length') ||
      error.message.includes('undefined') ||
      error.message.includes('Cannot read property') ||
      error.message.includes('Cannot read properties');

    if (isTypeError) {
      logger.error('🚨 ServerCard Race Condition TypeError 캐치됨:', {
        serverId: this.props.serverId || 'Unknown', // Gemini 리뷰 반영: 디버깅 컨텍스트 추가
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'),
        componentStack:
          errorInfo.componentStack?.split('\n').slice(0, 5).join('\n') ||
          'No component stack available',
        timestamp: new Date().toISOString(),
      });
    }

    // 에러 로깅 (콘솔 기반 - 외부 서비스 미연동)
    logger.error('ServerCard Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // 사용자 정의 fallback이 있으면 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 에러 UI - 서버 카드와 동일한 크기와 스타일
      return (
        <div className="relative cursor-pointer rounded-2xl border-2 w-full overflow-hidden text-left group p-5 min-h-[340px] bg-linear-to-br from-red-50/80 via-white/90 to-red-50/60 backdrop-blur-sm border-red-200/60">
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="rounded-lg p-3 bg-red-100/80 backdrop-blur-sm">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                서버 카드 오류
              </h3>
              <p className="text-sm text-gray-600 max-w-xs">
                {this.props.serverId ? `서버 (${this.props.serverId}) ` : ''}
                실시간 데이터 업데이트 중 문제가 발생했습니다.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-xs text-gray-500 mt-2">
                  <summary className="cursor-pointer">상세 오류 정보</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-left overflow-auto max-h-20">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>

            <button
              type="button"
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-red-500/20"
              aria-label="서버 카드 다시 로드"
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

export default ServerCardErrorBoundary;
