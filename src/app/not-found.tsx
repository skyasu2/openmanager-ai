/**
 * 🚨 Custom 404 Not Found Page
 *
 * Html import 에러를 우회하기 위한 커스텀 404 페이지
 * 서버 사이드 렌더링으로 작동 (SSG 비활성화)
 */

import type { Metadata } from 'next';

// 정적 생성 활성화 - 404 페이지 최적화
export const dynamic = 'force-static';

import { AlertCircle, Home, Search } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '404 - Page Not Found',
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="mx-auto max-w-md space-y-8 p-8 text-center">
        {/* 404 아이콘 */}
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600/20">
            <AlertCircle className="h-12 w-12 text-red-400" />
          </div>
        </div>

        {/* 404 메시지 */}
        <div className="space-y-4">
          <h1 className="text-6xl font-bold text-white">404</h1>
          <h2 className="text-xl font-semibold text-blue-300">
            페이지를 찾을 수 없습니다
          </h2>
          <p className="text-gray-400">
            요청하신 페이지가 존재하지 않거나 이동되었습니다.
          </p>
        </div>

        {/* 액션 버튼들 */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Home className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-lg bg-gray-600 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
            >
              <Search className="mr-2 h-4 w-4" />
              대시보드
            </Link>
          </div>

          {/* 검색 섹션 */}
          <div className="mt-6 rounded-lg bg-gray-800/50 p-4">
            <div className="flex items-center text-gray-300">
              <Search className="mr-2 h-4 w-4" />
              <span className="text-sm">찾고 계신 페이지가 있나요?</span>
            </div>
            <div className="mt-2 space-y-2 text-sm text-gray-400">
              <Link href="/" className="block hover:text-blue-400">
                • 메인 대시보드
              </Link>
              <Link href="/dashboard" className="block hover:text-blue-400">
                • 서버 대시보드
              </Link>
              <Link href="/auth/login" className="block hover:text-blue-400">
                • 로그인
              </Link>
            </div>
          </div>

          {/* 추가 도움말 */}
          <div className="text-xs text-gray-500">
            <p>문제가 지속되면 브라우저를 새로고침하거나</p>
            <p>잠시 후 다시 시도해주세요.</p>
          </div>
        </div>

        {/* 시스템 정보 */}
        <div className="border-t border-gray-700 pt-4 text-xs text-gray-600">
          <p>OpenManager AI v8</p>
          <p>Error ID: NOT_FOUND_404</p>
        </div>
      </div>
    </div>
  );
}
