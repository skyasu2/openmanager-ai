'use client';

import { Bot, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { Server } from '@/types/server';
import type { AIAssistantFunction } from './AIAssistantIconPanel';
import { AI_WORKSPACE_FUNCTION_TABS } from './AIWorkspace.constants';
import { ArtifactWorkspacePanel } from './artifact-workspace/ArtifactWorkspacePanel';
import { ServerContextPanel } from './ServerContextPanel';
import SystemContextPanel from './SystemContextPanel';

type AIWorkspaceEmbeddedLayoutProps = {
  selectedFunction: AIAssistantFunction;
  isRightPanelOpen: boolean;
  assistantContent: ReactNode;
  finalModelId?: string;
  finalProvider?: string;
  artifactWorkspaceId: string;
  messages: ComponentProps<typeof ArtifactWorkspacePanel>['messages'];
  queryAsOfDataSlot?: JobDataSlot;
  serverContextMessages: EnhancedChatMessage[];
  serverContextServers?: Server[];
  onFunctionSelect: (func: AIAssistantFunction) => void;
  onToggleRightPanel: () => void;
};

export function AIWorkspaceEmbeddedLayout({
  selectedFunction,
  isRightPanelOpen,
  assistantContent,
  finalModelId,
  finalProvider,
  artifactWorkspaceId,
  messages,
  queryAsOfDataSlot,
  serverContextMessages,
  serverContextServers,
  onFunctionSelect,
  onToggleRightPanel,
}: AIWorkspaceEmbeddedLayoutProps) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-white text-gray-900">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex h-10 shrink-0 items-center gap-2 pr-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-slate-900">
                  AI 어시스턴트
                </h1>
                <p className="sr-only">
                  질의, Reporter, Analyst 기능을 한 화면에서 실행
                </p>
              </div>
            </div>

            {AI_WORKSPACE_FUNCTION_TABS.map((item) => {
              const Icon = item.icon;
              const active = selectedFunction === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onFunctionSelect(item.id)}
                  aria-label={`${item.label} ${item.description}`}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-lg border px-2.5 text-left transition-colors sm:px-3',
                    active
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight">
                      {item.label}
                    </span>
                    <span className="hidden text-xs leading-tight text-slate-500 sm:block">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedFunction === 'chat' && (
            <button
              type="button"
              onClick={onToggleRightPanel}
              className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 lg:inline-flex"
              aria-label={
                isRightPanelOpen
                  ? '시스템 컨텍스트 닫기'
                  : '시스템 컨텍스트 열기'
              }
              aria-pressed={isRightPanelOpen}
            >
              {isRightPanelOpen ? (
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              )}
              컨텍스트
            </button>
          )}
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {assistantContent}
        </div>
      </div>

      {selectedFunction === 'chat' && (
        <ServerContextPanel
          className="hidden lg:flex"
          messages={serverContextMessages}
          queryAsOfDataSlot={queryAsOfDataSlot}
          servers={serverContextServers}
        />
      )}

      {selectedFunction === 'chat' && isRightPanelOpen && (
        <SystemContextPanel
          className="hidden xl:flex"
          finalModelId={finalModelId}
          finalProvider={finalProvider}
        >
          <ArtifactWorkspacePanel
            messages={messages}
            workspaceId={artifactWorkspaceId}
          />
        </SystemContextPanel>
      )}
    </div>
  );
}
