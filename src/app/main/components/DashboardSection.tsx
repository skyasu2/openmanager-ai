/**
 * 📊 대시보드 섹션 컴포넌트
 *
 * 시스템이 이미 시작된 상태에서 대시보드로 이동하는 UI
 */

'use client';

import { BarChart3 } from 'lucide-react';

interface DashboardSectionProps {
  canAccessDashboard: boolean;
  onNavigateDashboard: () => void;
  onStopSystem?: () => void;
}

export function DashboardSection({
  canAccessDashboard,
  onNavigateDashboard,
  onStopSystem,
}: DashboardSectionProps) {
  return (
    <div className="mx-auto max-w-4xl text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex flex-col items-center gap-4">
          {canAccessDashboard ? (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={onNavigateDashboard}
                className="flex h-16 w-full max-w-xs items-center justify-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-600 font-semibold text-white shadow-xl transition-all duration-200 hover:bg-emerald-700 sm:w-64"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="text-lg">📊 대시보드 열기</span>
              </button>

              {onStopSystem && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('시스템을 종료하시겠습니까?')) {
                      onStopSystem();
                    }
                  }}
                  className="text-sm text-red-400 hover:text-red-300 underline underline-offset-4 decoration-red-400/30 transition-colors"
                >
                  시스템 종료하기
                </button>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-2 text-sm text-gray-400">
                시스템이 다른 사용자에 의해 실행 중입니다
              </p>
              <p className="text-xs text-gray-500">
                GitHub 로그인 후 대시보드 접근이 가능합니다
              </p>
            </div>
          )}

          {canAccessDashboard && (
            <>
              <div className="mt-2 flex justify-center">
                <span className="finger-pointer-dashboard">👆</span>
              </div>
              <div className="mt-1 flex justify-center">
                <span className="text-xs text-white opacity-70">
                  클릭하세요
                </span>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-white/75">
        시스템이 활성화되어 있습니다. 대시보드에서 상세 모니터링을 확인하세요.
      </p>
    </div>
  );
}

export default DashboardSection;
