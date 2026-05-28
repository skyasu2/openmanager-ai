/**
 * 🎨 AI Sidebar Header - 반응형 접근성 적용
 *
 * ✅ 모바일/노트북/데스크톱 대응
 * ✅ 시맨틱 HTML 적용
 * ✅ 키보드 네비게이션 지원
 * ✅ 시스템 시작/중지와 Cloud Run 상태 연동
 */

'use client';

import {
  Brain,
  FileText,
  Maximize2,
  MessageSquare,
  Monitor,
  Plus,
  X,
} from 'lucide-react';
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

const AI_SIDEBAR_FUNCTION_TABS: Array<{
  id: AIAssistantFunction;
  label: string;
  icon: typeof MessageSquare;
}> = [
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'auto-report', label: '자동 보고서', icon: FileText },
  { id: 'intelligent-monitoring', label: '이상감지', icon: Monitor },
];

interface AISidebarHeaderProps {
  onClose: () => void;
  onNewSession?: () => void;
  onOpenFullscreen?: () => void;
  activeFunction?: AIAssistantFunction;
  onFunctionChange?: (func: AIAssistantFunction) => void;
}

export const AISidebarHeader: FC<AISidebarHeaderProps> = ({
  onClose,
  onNewSession,
  onOpenFullscreen,
  activeFunction = 'chat',
  onFunctionChange,
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
    <header className="flex flex-col border-b border-purple-100 bg-white">
      <div className="flex items-center justify-between gap-3 p-3 sm:p-4">
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
              <BasicTyping
                text="AI 어시스턴트"
                speed="fast"
                showCursor={false}
              />
            </h2>
            <div
              className="flex min-w-0 items-center gap-2 text-xs text-gray-600 sm:text-sm"
              data-testid="ai-sidebar-subtitle-row"
            >
              <span className="truncate">
                {AI_SIDEBAR_SUBTITLES[activeFunction]}
              </span>
              {/* AI Engine availability is independent from the simulated dashboard start state. */}
              <CloudRunStatusIndicator compact autoCheckInterval={300000} />
            </div>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-3"
          data-testid="ai-sidebar-header-actions"
        >
          {onOpenFullscreen && (
            <button
              onClick={onOpenFullscreen}
              className="hidden min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-2 text-purple-700 transition-colors hover:bg-purple-100 focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 sm:inline-flex"
              title="전체화면으로 보기"
              aria-label="전체화면으로 보기"
              type="button"
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
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
        </div>
      </div>

      {onFunctionChange && (
        <div
          aria-label="AI 기능"
          className="scrollbar-thin flex gap-1 overflow-x-auto px-3 pb-2 sm:px-4"
          role="tablist"
        >
          {AI_SIDEBAR_FUNCTION_TABS.map((item) => {
            const Icon = item.icon;
            const isSelected = activeFunction === item.id;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onFunctionChange(item.id)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                  isSelected
                    ? 'border-purple-600 bg-purple-50/70 text-purple-700'
                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
