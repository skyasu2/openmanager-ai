/**
 * Root Loading Component
 *
 * Next.js App Router의 Streaming SSR을 위한 루트 레벨 로딩 컴포넌트
 * 페이지 전환 시 자동으로 표시됨
 */

import { Loader2 } from 'lucide-react';

export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-500" />
        <p className="text-sm text-white/70">로딩 중...</p>
      </div>
    </div>
  );
}
