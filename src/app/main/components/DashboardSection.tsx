/**
 * 📊 대시보드 섹션 컴포넌트
 *
 * 시스템이 이미 시작된 상태에서 대시보드로 이동하는 UI.
 * 공용 종료는 사용자 버튼이 아니라 Redis TTL로만 닫힌다.
 */

'use client';

import { BarChart3 } from 'lucide-react';

interface DashboardSectionProps {
  canAccessDashboard: boolean;
  onNavigateDashboard: () => void;
}

export function DashboardSection({
  canAccessDashboard,
  onNavigateDashboard,
}: DashboardSectionProps) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex flex-col items-center gap-4">
          {canAccessDashboard ? (
            <button
              type="button"
              onClick={onNavigateDashboard}
              className="flex h-16 w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-600 font-semibold text-white shadow-xl transition-all duration-200 hover:bg-emerald-700 sm:w-64"
            >
              <BarChart3 aria-hidden="true" className="h-5 w-5" />
              <span className="text-lg">대시보드 열기</span>
            </button>
          ) : (
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-400">
                시스템이 다른 사용자에 의해 실행 중입니다
              </p>
              <p className="text-xs text-slate-300">
                로그인 후 대시보드에 접근할 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-sm font-medium text-white/[0.82]">
        시스템이 활성화되어 있습니다. 대시보드에서 상세 모니터링을 확인하세요.
      </p>
    </div>
  );
}
