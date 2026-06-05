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
  buttonConfig: ButtonConfig;
  statusInfo: StatusInfo;
  onSystemToggle: () => void;
}

export function SystemStartSection({
  isMounted,
  systemStartCountdown,
  buttonConfig,
  statusInfo,
  onSystemToggle,
}: SystemStartSectionProps) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="mb-6 flex flex-col items-center space-y-4">
        {/* 시스템 시작 버튼 */}
        <button
          type="button"
          data-spotlight-anchor="system-start"
          onClick={onSystemToggle}
          disabled={buttonConfig.disabled}
          className={`relative flex h-16 w-full max-w-xs items-center justify-center gap-3 overflow-hidden rounded-xl border font-semibold shadow-xl ring-1 ring-white/10 transition-all duration-300 hover:ring-white/25 hover:shadow-2xl sm:w-64 ${buttonConfig.className}`}
        >
          {/* 카운트다운 오버레이 */}
          {systemStartCountdown > 0 && (
            <div className="absolute inset-0 origin-left overflow-hidden rounded-xl">
              <div className="h-full bg-linear-to-r from-red-600/40 via-red-500/40 to-red-400/40" />
              <div className="absolute inset-0 h-full w-full bg-linear-to-r from-transparent via-white/10 to-transparent" />
            </div>
          )}
          <div className="relative z-10 flex items-center gap-3">
            {buttonConfig.icon && (
              <span aria-hidden="true" className="flex shrink-0">
                {buttonConfig.icon}
              </span>
            )}
            <span className="text-lg">{buttonConfig.text}</span>
          </div>
        </button>

        {/* 상태 메시지 */}
        <div className="mt-2 flex flex-col items-center gap-1">
          <span
            className={`text-sm font-semibold transition-all duration-300 ${statusInfo.color}`}
          >
            {statusInfo.message}
          </span>
          {statusInfo.showEscHint && (
            <span className="text-xs text-white/75">
              또는 ESC 키를 눌러 취소
            </span>
          )}
        </div>
      </div>

      {/* AI 어시스턴트 안내 */}
      <div className="flex justify-center text-sm">
        <div className="max-w-xl rounded-[1.75rem] border border-white/[0.16] bg-linear-to-br from-slate-900/90 via-slate-900/[0.78] to-cyan-950/[0.48] p-4 shadow-[0_24px_60px_rgba(8,15,30,0.46)] sm:p-5">
          <div className="mb-3 flex items-center justify-center gap-2 text-cyan-100">
            {isMounted && (
              <MessageSquareQuote
                aria-hidden="true"
                className="h-4 w-4 text-cyan-300"
              />
            )}
            <span className="font-semibold">
              시작 후 사용할 수 있는 예시 질문
            </span>
          </div>
          <ul
            className="grid gap-2 text-left sm:grid-cols-2"
            aria-label="시스템 시작 후 사용할 수 있는 예시 질문"
          >
            {START_EXAMPLES.map((example) => (
              <li
                key={example}
                className="cursor-default select-text rounded-2xl border border-white/[0.16] bg-white/[0.085] px-3 py-3 text-sm leading-relaxed text-white/[0.92]"
              >
                <span className="text-cyan-300">Q.</span> {example}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
