/**
 * UnauthorizedAccessUI - 권한 없음 상태 표시 컴포넌트
 *
 * 대시보드 접근 권한이 없을 때 표시되는 UI
 * GitHub/Google/이메일 로그인 또는 PIN 인증 안내를 담당
 *
 * 추출 위치:
 * - src/app/dashboard/DashboardClient.tsx (lines 904-942)
 */

'use client';

import { Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LOGIN_POLICY_COPY } from '@/lib/auth/login-policy-copy';
import FullScreenLayout from './FullScreenLayout';

interface UnauthorizedAccessUIProps {
  /**
   * GitHub/Google/이메일 로그인이 필수인지 여부
   * @default true
   */
  requiresGitHub?: boolean;

  /**
   * 로그인 버튼 클릭 핸들러
   * 기본값: () => router.push('/login')
   */
  onLoginClick?: () => void;

  /**
   * 메인 페이지로 돌아가기 클릭 핸들러
   * 기본값: () => router.push('/')
   */
  onBackClick?: () => void;
}

export default function UnauthorizedAccessUI({
  requiresGitHub = true,
  onLoginClick,
  onBackClick,
}: UnauthorizedAccessUIProps) {
  const router = useRouter();

  const handleLoginClick = () => {
    if (onLoginClick) {
      onLoginClick();
    } else {
      router.push('/login');
    }
  };

  const handleBackClick = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      router.push('/');
    }
  };

  return (
    <FullScreenLayout>
      <div className="mx-auto max-w-md p-6 text-center">
        <div className="mb-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-linear-to-r from-blue-500 to-purple-600">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">접근 권한 필요</h2>
          <p className="mb-6 text-gray-300">
            {requiresGitHub
              ? LOGIN_POLICY_COPY.dashboardAccess
              : '대시보드 접근을 위해 인증이 필요합니다.'}
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleLoginClick}
            className="w-full rounded-lg bg-linear-to-r from-blue-500 to-blue-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:from-blue-600 hover:to-blue-700"
          >
            {requiresGitHub ? '로그인' : '로그인'}
          </button>

          <button
            type="button"
            onClick={handleBackClick}
            className="w-full rounded-lg bg-gray-700 px-6 py-3 font-medium text-gray-200 transition-all duration-200 hover:bg-gray-600"
          >
            메인 페이지로 돌아가기
          </button>
        </div>

        {requiresGitHub && (
          <p className="mt-4 text-xs text-gray-500">
            게스트 모드에서는 {LOGIN_POLICY_COPY.adminPinAuthText}로 대시보드
            접근이 가능합니다.
          </p>
        )}
      </div>
    </FullScreenLayout>
  );
}
