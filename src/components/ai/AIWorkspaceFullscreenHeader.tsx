'use client';

import {
  ArrowLeftFromLine,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { RealTimeDisplay } from '../dashboard/RealTimeDisplay';
import UnifiedProfileHeader from '../shared/UnifiedProfileHeader';
import type { AIAssistantFunction } from './AIAssistantIconPanel';

type AIWorkspaceFullscreenHeaderProps = {
  selectedFunction: AIAssistantFunction;
  isRightPanelOpen: boolean;
  onBackToDashboard: () => void;
  onToggleRightPanel: () => void;
};

export function AIWorkspaceFullscreenHeader({
  selectedFunction,
  isRightPanelOpen,
  onBackToDashboard,
  onToggleRightPanel,
}: AIWorkspaceFullscreenHeaderProps) {
  return (
    <header className="hidden md:flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-xs">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBackToDashboard}
          className="flex min-h-6 min-w-6 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
          title="대시보드로 돌아가기"
          aria-label="대시보드로 돌아가기"
        >
          <ArrowLeftFromLine className="h-4 w-4" />
          <span>대시보드</span>
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <span className="font-medium text-gray-900">AI Workspace</span>
          <span>/</span>
          <span className="text-blue-600 capitalize font-medium">
            {selectedFunction === 'chat'
              ? '대화'
              : selectedFunction === 'auto-report'
                ? '보고서'
                : '모니터링'}
          </span>
        </div>
      </div>

      <div className="hidden md:flex items-center">
        <RealTimeDisplay />
      </div>

      <div className="flex items-center gap-3">
        {selectedFunction === 'chat' && (
          <button
            type="button"
            onClick={onToggleRightPanel}
            className="hidden min-h-6 min-w-6 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 lg:flex"
            title="시스템 컨텍스트 패널 토글"
            aria-label={
              isRightPanelOpen ? '시스템 컨텍스트 닫기' : '시스템 컨텍스트 열기'
            }
            aria-pressed={isRightPanelOpen}
          >
            {isRightPanelOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <PanelRightOpen className="h-5 w-5" />
            )}
          </button>
        )}

        <UnifiedProfileHeader />
      </div>
    </header>
  );
}
