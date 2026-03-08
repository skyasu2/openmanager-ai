'use client';

import type { FC } from 'react';
import type { AIAssistantFunction } from '@/components/ai/AIAssistantIconPanel';
import AIAssistantIconPanel from '@/components/ai/AIAssistantIconPanel';
import AIContentArea from '@/components/ai/AIContentArea';

interface AIFunctionPagesProps {
  selectedFunction: AIAssistantFunction;
  onFunctionChange: (func: AIAssistantFunction) => void;
  className?: string;
}

export const AIFunctionPages: FC<AIFunctionPagesProps> = ({
  selectedFunction,
  onFunctionChange,
  className = '',
}: AIFunctionPagesProps) => {
  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* AI 기능 아이콘 패널 - 모바일에서만 표시 (데스크톱은 Sidebar 부모가 처리) */}
      <div
        className="block shrink-0 sm:hidden"
        data-testid="ai-function-navigation"
      >
        <AIAssistantIconPanel
          selectedFunction={selectedFunction}
          onFunctionChange={onFunctionChange}
          isMobile={true}
        />
      </div>

      {/* 선택된 기능 페이지 - 탭 전환 시 상태 유지를 위해 모든 페이지 동시 마운트 */}
      <div className="flex-1 overflow-y-auto" data-testid="ai-function-content">
        <div
          className="p-4 text-center text-white/70"
          data-testid="chat-page"
          style={{ display: selectedFunction === 'chat' ? 'block' : 'none' }}
        >
          💬 채팅 기능이 선택되었습니다.
          <br />
          <span className="text-sm">메인 채팅 인터페이스가 표시됩니다.</span>
        </div>
        <div style={{ display: selectedFunction !== 'chat' ? 'block' : 'none' }}>
          <AIContentArea selectedFunction={selectedFunction} />
        </div>
      </div>
    </div>
  );
};
