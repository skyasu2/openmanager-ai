/**
 * 🎨 AI Sidebar Header - 반응형 접근성 적용
 *
 * ✅ 모바일/노트북/데스크톱 대응
 * ✅ 시맨틱 HTML 적용
 * ✅ 키보드 네비게이션 지원
 * ✅ 시스템 시작/중지와 Cloud Run 상태 연동
 */

'use client';

import { Brain, Maximize2, Plus, X } from 'lucide-react';
import type { FC } from 'react';
import type { AIAssistantFunction } from '@/components/ai/AIAssistantIconPanel';
import BasicTyping from '@/components/ui/BasicTyping';
import { useAISidebarStore } from '@/stores/useAISidebarStore';
import { CloudRunStatusIndicator } from './CloudRunStatusIndicator';

const AI_SIDEBAR_SUBTITLES: Record<AIAssistantFunction, string> = {
  chat: '서버 상태·로그·메트릭을 자연어로 질의',
  'auto-report': '장애·정기 보고서 자동 생성',
  'intelligent-monitoring': '이상감지·추세 분석 실행',
};

interface AISidebarHeaderProps {
  onClose: () => void;
  onNewSession?: () => void;
  onOpenFullscreen?: () => void;
  activeFunction?: AIAssistantFunction;
}

export const AISidebarHeader: FC<AISidebarHeaderProps> = ({
  onClose,
  onNewSession,
  onOpenFullscreen,
  activeFunction = 'chat',
}: AISidebarHeaderProps) => {
  const clearMessages = useAISidebarStore((state) => state.clearMessages);

  const handleNewChat = () => {
    if (onNewSession) {
      onNewSession();
    } else {
      clearMessages();
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-purple-100 bg-white p-3 sm:p-4">
      <div className="flex min-w-0 items-center space-x-2 sm:space-x-3">
        {/* AI 아이콘 - 반응형 크기 */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-r from-purple-500 to-blue-600 sm:h-10 sm:w-10">
          <Brain
            className="h-4 w-4 text-white sm:h-5 sm:w-5"
            aria-hidden="true"
          />
        </div>

        {/* 제목 및 설명 - 시맨틱 구조 */}
        <div className="min-w-0 flex-1">
          <h2
            id="ai-sidebar-v4-title"
            className="truncate text-base font-bold text-gray-800 sm:text-lg"
          >
            <BasicTyping text="AI 어시스턴트" speed="fast" showCursor={false} />
          </h2>
          <p className="truncate text-xs text-gray-600 sm:text-sm">
            {AI_SIDEBAR_SUBTITLES[activeFunction]}
          </p>
        </div>
      </div>

      {/* Cloud Run 상태 인디케이터 */}
      {/* AI Engine availability is independent from the simulated dashboard start state. */}
      <div className="mx-2 shrink-0">
        <CloudRunStatusIndicator compact autoCheckInterval={300000} />
      </div>

      {onOpenFullscreen && (
        <button
          onClick={onOpenFullscreen}
          className="hidden min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 sm:inline-flex"
          title="전체화면으로 보기"
          aria-label="전체화면으로 보기"
          type="button"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
          <span>전체화면</span>
        </button>
      )}

      {/* 새 대화 버튼 */}
      <button
        onClick={handleNewChat}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 transition-colors hover:bg-purple-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        title="새 대화 시작"
        aria-label="새 대화 시작"
        type="button"
      >
        <Plus className="h-5 w-5 text-purple-600" aria-hidden="true" />
      </button>

      {/* 닫기 버튼 - 접근성 강화 */}
      <button
        onClick={onClose}
        className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 transition-colors hover:bg-gray-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        title="AI 어시스턴트 닫기"
        aria-label="AI 어시스턴트 사이드바 닫기"
        type="button"
      >
        <X className="h-5 w-5 text-gray-500" aria-hidden="true" />
      </button>
    </header>
  );
};
