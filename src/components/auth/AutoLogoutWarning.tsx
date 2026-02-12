'use client';

import { AlertTriangle, Clock, RotateCcw } from 'lucide-react';

/**
 * 자동 로그아웃 경고 컴포넌트 v1.0
 * OpenManager AI - 베르셀 사용량 최적화
 */

interface AutoLogoutWarningProps {
  remainingTime: number;
  isWarning: boolean;
  onExtendSession: () => void;
  onLogoutNow: () => void;
}

export function AutoLogoutWarning({
  remainingTime,
  isWarning,
  onExtendSession,
  onLogoutNow,
}: AutoLogoutWarningProps) {
  if (!isWarning) return null;

  const minutes = Math.floor(remainingTime / 60);
  const seconds = remainingTime % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="animate-in w-full max-w-md rounded-xl bg-white p-6 shadow-2xl duration-300 zoom-in-95 dark:bg-gray-800">
        {/* 헤더 */}
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              자동 로그아웃 경고
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              베르셀 사용량 최적화를 위한 자동 로그아웃
            </p>
          </div>
        </div>

        {/* 시간 표시 */}
        <div className="mb-6 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <span className="font-mono text-lg font-bold text-amber-700 dark:text-amber-300">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
          <p className="text-center text-sm text-amber-700 dark:text-amber-300">
            위 시간 후 자동으로 로그아웃됩니다
          </p>
        </div>

        {/* 설명 */}
        <div className="mb-6 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <strong>사용자 비활성 상태가 감지되었습니다.</strong>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            베르셀 서버리스 사용량을 줄이기 위해 비활성 상태에서는 자동으로
            로그아웃됩니다. 계속 사용하시려면 &quot;세션 연장&quot;을 클릭하거나
            화면을 클릭하세요.
          </p>
        </div>

        {/* 버튼들 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onExtendSession}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700"
          >
            <RotateCcw className="h-4 w-4" />
            세션 연장
          </button>
          <button
            type="button"
            onClick={onLogoutNow}
            className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            지금 로그아웃
          </button>
        </div>

        {/* 추가 정보 */}
        <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            💡 베르셀 무료티어 보호를 위한 자동 시스템입니다
          </p>
        </div>
      </div>
    </div>
  );
}
