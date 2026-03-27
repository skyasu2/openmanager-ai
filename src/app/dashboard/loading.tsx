/**
 * Dashboard Loading Component
 *
 * 대시보드 페이지 로딩 시 표시되는 스켈레톤 UI
 * Next.js App Router의 Streaming SSR을 위한 로딩 컴포넌트
 */

import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* 헤더 스켈레톤 */}
      <header className="flex items-center justify-between border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-white/10" />
          <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
      </header>

      {/* 메인 콘텐츠 스켈레톤 */}
      <main className="flex-1 p-6">
        {/* 상단 통계 카드 */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white/5 p-4">
              <div className="mb-2 h-4 w-20 rounded bg-white/10" />
              <div className="h-8 w-16 rounded bg-white/20" />
            </div>
          ))}
        </div>

        {/* 중앙 로딩 인디케이터 */}
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
            <p className="text-white/70">대시보드 로딩 중...</p>
          </div>
        </div>

        {/* 차트 영역 스켈레톤 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-white/5 p-6">
              <div className="mb-4 h-6 w-32 rounded bg-white/10" />
              <div className="h-48 rounded-lg bg-white/10" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
