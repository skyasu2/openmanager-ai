'use client';

import { Bot, FileText, MessageSquare, Monitor, Plus } from 'lucide-react';
import { CloudRunStatusIndicator } from '@/components/ai-sidebar/CloudRunStatusIndicator';
import { APP_VERSION } from '@/config/app-meta';
import { OpenManagerLogo } from '../shared/OpenManagerLogo';
import type { AIAssistantFunction } from './AIAssistantIconPanel';

type AIWorkspaceNavigationSidebarProps = {
  selectedFunction: AIAssistantFunction;
  hasMessages: boolean;
  userQuestionCount: number;
  onNewSession: () => void;
  onFunctionSelect: (func: AIAssistantFunction) => void;
};

export function AIWorkspaceNavigationSidebar({
  selectedFunction,
  hasMessages,
  userQuestionCount,
  onNewSession,
  onFunctionSelect,
}: AIWorkspaceNavigationSidebarProps) {
  return (
    <div className="hidden md:flex w-[280px] flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <OpenManagerLogo variant="light" showSubtitle={false} href="/" />
      </div>

      <div className="flex-1 px-3 overflow-y-auto">
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              현재 세션
            </span>
            <button
              type="button"
              onClick={onNewSession}
              className="flex min-h-6 min-w-6 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              title="새 대화 시작"
            >
              <Plus className="h-3 w-3" />
              <span>새 대화</span>
            </button>
          </div>
          {hasMessages ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-700 border border-blue-100">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">진행 중인 대화</span>
                <span className="text-xs text-blue-500 shrink-0">
                  {userQuestionCount}개 질문
                </span>
              </div>
            </div>
          ) : (
            <div className="px-3 py-6 text-center">
              <Bot className="mx-auto mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-500">새 대화를 시작하세요</p>
              <p className="mt-1 text-xs text-gray-400">AI에게 질문해보세요!</p>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 px-3 py-3">
        <div className="mb-2 px-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          AI 기능
        </div>
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onFunctionSelect('chat')}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              selectedFunction === 'chat'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">AI Chat</div>
              <div className="text-xs text-gray-500 truncate">자연어 질의</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onFunctionSelect('auto-report')}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              selectedFunction === 'auto-report'
                ? 'bg-pink-50 text-pink-700 border border-pink-200'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">장애 보고서</div>
              <div className="text-xs text-gray-500 truncate">보고서 생성</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onFunctionSelect('intelligent-monitoring')}
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
              selectedFunction === 'intelligent-monitoring'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Monitor className="h-4 w-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">이상감지/추세</div>
              <div className="text-xs text-gray-500 truncate">
                이상 신호 분석
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-200 px-3 py-2.5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-medium text-gray-600">AI Engine</span>
            <CloudRunStatusIndicator autoCheckInterval={300000} />
          </div>
          <span className="text-gray-400">v{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}
