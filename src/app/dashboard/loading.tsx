/**
 * Dashboard Loading Component
 *
 * 대시보드 페이지 로딩 시 표시되는 스켈레톤 UI
 * Next.js App Router의 Streaming SSR을 위한 로딩 컴포넌트
 */

import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* 헤더 스켈레톤 */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-slate-200" />
      </header>

      {/* 메인 콘텐츠 스켈레톤 */}
      <main className="flex-1 p-6">
        {/* 상단 통계 카드 */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="mb-2 h-4 w-20 rounded bg-slate-200" />
              <div className="h-8 w-16 rounded bg-slate-300" />
            </div>
          ))}
        </div>

        {/* 중앙 로딩 인디케이터 */}
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-500" />
            <p className="text-slate-500">대시보드 로딩 중...</p>
          </div>
        </div>

        {/* 차트 영역 스켈레톤 */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
            >
              <div className="mb-4 h-6 w-32 rounded bg-slate-200" />
              <div className="h-48 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
