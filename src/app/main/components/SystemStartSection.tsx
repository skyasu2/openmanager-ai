/**
 * 🚀 시스템 시작 섹션 컴포넌트
 *
 * 시스템 시작 버튼, 카운트다운, 상태 표시를 담당
 */

'use client';

import { MessageSquareQuote } from 'lucide-react';
import type { ButtonConfig, StatusInfo } from '../hooks/useSystemStart';

const START_EXAMPLES = [
  { q: 'CPU 사용률이 가장 높은 서버는?', icon: '⚡' },
  { q: '메모리 경고 서버 원인 분석해줘', icon: '🔍' },
  { q: '지난 1시간 이상 징후 구간 요약해줘', icon: '📊' },
  { q: '향후 장애 가능성 있는 서버 예측해줘', icon: '🔮' },
  { q: '전체 서버 상태를 한눈에 요약해줘', icon: '📋' },
  { q: 'CPU 알림 bash 스크립트 짜줘', icon: '🔧' },
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

      {/* AI 어시스턴트 예시 질문 */}
      <div className="w-full max-w-2xl mx-auto text-sm">
        <div className="mb-3 flex items-center justify-center gap-1.5 text-white/50">
          {isMounted && (
            <MessageSquareQuote
              aria-hidden="true"
              className="h-3.5 w-3.5 text-cyan-400/70"
            />
          )}
          <span className="text-xs font-medium tracking-wide text-white/50">
            시작 후 AI에게 바로 물어볼 수 있어요
          </span>
        </div>
        <ul
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          aria-label="시스템 시작 후 사용할 수 있는 예시 질문"
        >
          {START_EXAMPLES.map(({ q, icon }) => (
            <li key={q}>
              <div className="w-full rounded-xl border border-white/[0.14] bg-white/[0.07] px-3 py-2.5 text-left text-xs leading-snug text-white/70 cursor-default select-text">
                <span className="mr-1.5">{icon}</span>
                {q}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
