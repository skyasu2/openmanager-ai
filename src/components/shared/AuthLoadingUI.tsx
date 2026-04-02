/**
 * AuthLoadingUI - 인증 로딩 상태 표시 컴포넌트
 *
 * 메인 페이지와 대시보드에서 공통으로 사용하는 인증 로딩 UI
 * 로딩 메시지, 환경 정보, 에러 처리를 담당
 *
 * 추출 위치:
 * - src/app/main/page.tsx (lines 380-411)
 * - src/app/dashboard/DashboardClient.tsx (lines 872-884)
 */

'use client';

import { Loader2 } from 'lucide-react';
import FullScreenLayout from './FullScreenLayout';

interface AuthLoadingUIProps {
  /**
   * 로딩 메시지 (예: "인증 확인 중...", "사용자 정보 로드 중...")
   */
  loadingMessage: string;

  /**
   * 환경 레이블 (예: "Vercel", "Local")
   * @default "Local"
   */
  envLabel?: string;

  /**
   * 인증 에러 메시지
   */
  authError?: string | null;

  /**
   * 재시도 버튼 클릭 핸들러
   */
  onRetry?: () => void;

  /**
   * 로딩 카피를 표시할지 여부
   * 랜딩 첫 페인트처럼 중립 skeleton만 필요한 경우 false
   * @default true
   */
  showCopy?: boolean;
}

export default function AuthLoadingUI({
  loadingMessage,
  envLabel = 'Local',
  authError,
  onRetry,
  showCopy = true,
}: AuthLoadingUIProps) {
  const visibleAuthError =
    process.env.NODE_ENV === 'development'
      ? authError
      : authError
        ? '인증 확인 중 문제가 발생했습니다.'
        : null;

  return (
    <FullScreenLayout>
      <div className="text-center">
        <div>
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-white" />
        </div>
        <span className="sr-only" suppressHydrationWarning>
          {loadingMessage} ({envLabel} 환경)
        </span>
        {showCopy && (
          <p className="font-medium text-white/90" suppressHydrationWarning>
            {loadingMessage} ({envLabel} 환경)
          </p>
        )}
        {visibleAuthError && onRetry && (
          <div className="mx-auto mt-4 max-w-md">
            <p className="mb-2 text-sm text-red-400">
              인증 오류: {visibleAuthError}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
            >
              다시 시도
            </button>
          </div>
        )}
        {showCopy && (
          <div className="mt-2 text-xs text-white/90" suppressHydrationWarning>
            {envLabel} 서버에서 로딩 중...
          </div>
        )}
      </div>
    </FullScreenLayout>
  );
}
