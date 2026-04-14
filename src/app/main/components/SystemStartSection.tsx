/**
 * 🚀 시스템 시작 섹션 컴포넌트
 *
 * 시스템 시작 버튼, 카운트다운, 상태 표시를 담당
 */

'use client';

import { MessageSquareQuote } from 'lucide-react';
import type { ButtonConfig, StatusInfo } from '../hooks/useSystemStart';

const START_EXAMPLES = [
  '지금 CPU 사용률이 가장 위험한 서버가 어디야?',
  '지난 1시간 동안 장애 징후가 있었던 구간만 요약해줘',
] as const;

interface SystemStartSectionProps {
  isMounted: boolean;
  systemStartCountdown: number;
  isSystemStarting: boolean;
  isSystemStarted: boolean;
  isSystemRunning: boolean;
  buttonConfig: ButtonConfig;
  statusInfo: StatusInfo;
  onSystemToggle: () => void;
}

export function SystemStartSection({
  isMounted,
  systemStartCountdown,
  isSystemStarting,
  isSystemStarted,
  isSystemRunning,
  buttonConfig,
  statusInfo,
  onSystemToggle,
}: SystemStartSectionProps) {
  const showFingerPointer =
    !systemStartCountdown &&
    !isSystemStarting &&
    !isSystemRunning &&
    !isSystemStarted;

  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mb-6 flex flex-col items-center space-y-4">
        {/* 시스템 시작 버튼 */}
        <button
          type="button"
          onClick={onSystemToggle}
          disabled={buttonConfig.disabled}
          className={`relative overflow-hidden flex h-16 w-full max-w-xs items-center justify-center gap-3 rounded-xl border font-semibold shadow-xl transition-all duration-300 sm:w-64 ${buttonConfig.className}`}
        >
          {/* 카운트다운 오버레이 */}
          {systemStartCountdown > 0 && (
            <div className="absolute inset-0 origin-left overflow-hidden rounded-xl">
              <div className="h-full bg-linear-to-r from-red-600/40 via-red-500/40 to-red-400/40" />
              <div className="absolute inset-0 h-full w-full bg-linear-to-r from-transparent via-white/10 to-transparent" />
            </div>
          )}
          <div className="relative z-10 flex items-center gap-3">
            {buttonConfig.icon}
            <span className="text-lg">{buttonConfig.text}</span>
          </div>
        </button>

        {/* 상태 메시지 */}
        <div className="mt-2 flex flex-col items-center gap-1">
          <span
            className={`text-sm font-medium opacity-80 transition-all duration-300 ${statusInfo.color}`}
          >
            {statusInfo.message}
          </span>
          {statusInfo.showEscHint && (
            <span className="text-xs text-white/75">
              또는 ESC 키를 눌러 취소
            </span>
          )}
        </div>

        {/* 손가락 포인터 */}
        {showFingerPointer && (
          <div className="mt-2 flex justify-center">
            <span className="finger-pointer-primary">👆</span>
          </div>
        )}
      </div>

      {/* AI 어시스턴트 안내 */}
      <div className="flex justify-center text-sm">
        <div className="max-w-xl rounded-[1.75rem] border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-900/60 to-cyan-950/35 p-4 shadow-[0_24px_60px_rgba(8,15,30,0.4)] sm:p-5">
          <div className="mb-3 flex items-center justify-center gap-2 text-cyan-100">
            {isMounted && (
              <MessageSquareQuote className="h-4 w-4 text-cyan-300" />
            )}
            <span className="font-semibold">
              시작하면 이런 질문을 바로 할 수 있습니다
            </span>
          </div>
          <div className="grid gap-2 text-left sm:grid-cols-2">
            {START_EXAMPLES.map((example) => (
              <div
                key={example}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm leading-relaxed text-white/88"
              >
                <span className="text-cyan-300">Q.</span> {example}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
