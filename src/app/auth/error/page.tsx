/**
 * 🚫 Auth Error Page
 *
 * GitHub / Google / 이메일 인증 오류 시 표시되는 페이지
 *
 * NOTE: Dynamic rendering은 layout.tsx에서 설정됨
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

// useSearchParams를 사용하는 컴포넌트를 별도로 분리
function AuthErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const errorParam = searchParams?.get('error');

    // 인증 에러 코드를 한국어로 변환
    const getErrorMessage = (errorCode: string | null): string => {
      switch (errorCode) {
        case 'Configuration':
          return '인증 설정 오류가 발생했습니다.';
        case 'AccessDenied':
          return '로그인 권한이 거부되었습니다.';
        case 'Verification':
          return '인증에 실패했습니다.';
        case 'Default':
          return '로그인 중 알 수 없는 오류가 발생했습니다.';
        case 'OAuthCallback':
          return 'OAuth 콜백 처리 중 오류가 발생했습니다.';
        case 'OAuthCreateAccount':
          return '계정 정보를 가져오는데 실패했습니다.';
        case 'EmailCreateAccount':
          return '이메일 정보를 가져오는데 실패했습니다.';
        case 'Callback':
          return '인증 콜백 처리에 실패했습니다.';
        case 'OAuthAccountNotLinked':
          return '해당 계정이 이미 다른 소셜/이메일 제공자와 연결되어 있습니다.';
        case 'EmailSignin':
          return '이메일 인증으로 로그인할 수 없습니다.';
        case 'CredentialsSignin':
          return '자격 증명 확인에 실패했습니다.';
        case 'SessionRequired':
          return '로그인 세션이 필요합니다.';
        default:
          return '로그인 중 오류가 발생했습니다.';
      }
    };

    setError(getErrorMessage(errorParam || null));
  }, [searchParams]); // searchParams 변화에 반응

  /**
   * 🔙 로그인 페이지로 돌아가기
   */
  const handleBackToLogin = () => {
    router.push('/login');
  };

  /**
   * 🔄 로그인 다시 시도
   */
  const handleTryAgain = () => {
    router.push('/login');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-red-50 via-white to-orange-50 p-4">
      <div className="w-full max-w-md">
        {/* 에러 아이콘 */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">로그인 실패</h1>
          <p className="text-gray-600">소셜/이메일 인증에 실패했습니다</p>
        </div>

        {/* 에러 메시지 */}
        <div className="mb-6 rounded-xl border border-red-200 bg-white p-6 shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-3 w-3 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-gray-900">오류 내용</h3>
              <p className="text-sm leading-relaxed text-gray-600">{error}</p>
            </div>
          </div>
        </div>

        {/* 해결 방법 */}
        <div className="mb-6 rounded-xl bg-blue-50 p-6">
          <h3 className="mb-3 font-semibold text-blue-900">해결 방법</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-start space-x-2">
              <span className="text-blue-600">1.</span>
              <span>로그인 상태를 확인하세요</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-600">2.</span>
              <span>브라우저 쿠키와 캐시를 지워보세요</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-600">3.</span>
              <span>다른 브라우저를 사용해보세요</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-600">4.</span>
              <span>문제가 계속되면 게스트 로그인을 사용하세요</span>
            </div>
          </div>
        </div>

        {/* 액션 버튼들 */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleTryAgain}
              className="rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700"
            >
              다시 시도
            </button>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              로그인 페이지로
            </button>
          </div>

          {/* 대안 인증 방법 */}
          <div className="text-center">
            <p className="mb-2 text-sm text-gray-500">
              또는 다른 방법으로 로그인
            </p>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full rounded bg-gray-50 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
            >
              게스트 모드로 시작하기
            </button>
          </div>
        </div>

        {/* 기술 정보 */}
        <div className="mt-8 text-center">
          <div className="space-y-1 text-xs text-gray-500">
            <p>🔐 GitHub/Google/이메일 기반 인증</p>
            <p>🛠️ 문제가 계속되면 관리자에게 문의하세요</p>
            <p>OpenManager AI v8.0.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 로딩 컴포넌트
function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-red-50 via-white to-orange-50 p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-red-200 border-t-red-600"></div>
        <p className="text-gray-600">로딩 중...</p>
      </div>
    </div>
  );
}

// 메인 컴포넌트 - Suspense로 감싸기
export default function AuthErrorPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthErrorContent />
    </Suspense>
  );
}
