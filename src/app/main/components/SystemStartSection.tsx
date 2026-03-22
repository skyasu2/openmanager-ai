/**
 * 🚀 시스템 시작 섹션 컴포넌트
 *
 * 시스템 시작 버튼, 카운트다운, 상태 표시를 담당
 */

'use client';

import { Bot } from 'lucide-react';
import Link from 'next/link';
import type { ButtonConfig, StatusInfo } from '../hooks/useSystemStart';

const PRODUCTION_QA_STATUS_PATH = '/reports/qa/QA_STATUS.md';
const PRODUCTION_QA_PROOF_RUN_PATH =
  '/reports/qa/runs/2026/qa-run-QA-20260322-0160.json';
const PRODUCTION_QA_CI_RUN_URL =
  'https://github.com/skyasu2/openmanager-ai/actions/runs/23398040200';

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
          className={`flex h-16 w-full max-w-xs items-center justify-center gap-3 rounded-xl border font-semibold shadow-xl transition-all duration-300 sm:w-64 ${buttonConfig.className}`}
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
        <div className="max-w-md rounded-lg bg-gradient-to-br from-purple-600/10 to-blue-600/10 border border-white/10 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-center gap-2">
            {isMounted && <Bot className="h-4 w-4 text-purple-400" />}
            <span className="font-semibold">AI 어시스턴트</span>
          </div>
          <p className="text-center text-white/90">
            시스템 시작 후 현재 메트릭을 바탕으로 질문, 분석, 조치안을 바로
            확인할 수 있습니다
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-xs text-purple-300">
              장애 분석
            </span>
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-300">
              성능 예측
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
              보고서 생성
            </span>
          </div>
          <div className="mt-3 border-t border-white/10 pt-3 text-xs text-white/75">
            <p className="text-center">실환경 검증 기준 · 2026-03-22</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <Link
                href={PRODUCTION_QA_STATUS_PATH}
                className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-cyan-200 transition hover:bg-cyan-400/15"
              >
                QA 현황
              </Link>
              <Link
                href={PRODUCTION_QA_PROOF_RUN_PATH}
                className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-emerald-200 transition hover:bg-emerald-400/15"
              >
                증거 run
              </Link>
              <a
                href={PRODUCTION_QA_CI_RUN_URL}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-purple-400/25 bg-purple-400/10 px-2.5 py-1 text-purple-200 transition hover:bg-purple-400/15"
              >
                CI artifact
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SystemStartSection;
