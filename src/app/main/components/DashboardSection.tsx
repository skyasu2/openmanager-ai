/**
 * 📊 대시보드 섹션 컴포넌트
 *
 * 시스템이 이미 시작된 상태에서 대시보드로 이동하는 UI
 */

'use client';

import { BarChart3, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAISidebarStore } from '@/stores/useAISidebarStore';

const EXAMPLE_QUESTIONS = [
  { q: 'CPU 사용률이 가장 높은 서버는?', icon: '⚡' },
  { q: '메모리 경고 서버 원인 분석해줘', icon: '🔍' },
  { q: '지난 1시간 이상 징후 구간 요약해줘', icon: '📊' },
  { q: '향후 장애 가능성 있는 서버 예측해줘', icon: '🔮' },
  { q: '전체 서버 상태를 한눈에 요약해줘', icon: '📋' },
  { q: '지금 당장 점검해야 할 서버는?', icon: '🚨' },
] as const;

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
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false);
  const openWithPrefill = useAISidebarStore((s) => s.openWithPrefill);

  const handleConfirmStop = () => {
    setIsStopDialogOpen(false);
    onStopSystem?.();
  };

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
                <BarChart3 aria-hidden="true" className="h-5 w-5" />
                <span className="text-lg">대시보드 열기</span>
              </button>

              {onStopSystem && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsStopDialogOpen(true)}
                    className="text-sm text-red-400 hover:text-red-300 underline underline-offset-4 decoration-red-400/30 transition-colors"
                  >
                    시스템 종료하기
                  </button>

                  <Dialog
                    open={isStopDialogOpen}
                    onOpenChange={setIsStopDialogOpen}
                  >
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>시스템 종료</DialogTitle>
                        <DialogDescription>
                          시스템을 종료하시겠습니까? 종료 후 메인 페이지에서
                          다시 시작할 수 있습니다.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsStopDialogOpen(false)}
                        >
                          취소
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={handleConfirmStop}
                        >
                          종료 확인
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
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

      {/* 예시 질문 카드 */}
      <div className="mt-8 w-full max-w-2xl mx-auto">
        <div className="mb-3 flex items-center justify-center gap-1.5 text-white/50">
          <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="text-xs font-medium tracking-wide">
            AI에게 바로 물어보기
          </span>
        </div>
        <ul
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          aria-label="AI 예시 질문"
        >
          {EXAMPLE_QUESTIONS.map(({ q, icon }) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => openWithPrefill(q)}
                className="group w-full rounded-xl border border-white/[0.14] bg-white/[0.07] px-3 py-2.5 text-left text-xs leading-snug text-white/80 transition-all duration-150 hover:border-white/25 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <span className="mr-1.5">{icon}</span>
                {q}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
