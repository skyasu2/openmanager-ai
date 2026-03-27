'use client';

import { memo } from 'react';
import type { TabId, TabInfo } from './EnhancedServerModal.types';

interface ServerModalTabNavProps {
  tabs: TabInfo[];
  selectedTab: TabId;
  onTabSelect: (tabId: TabId) => void;
}

export const ServerModalTabNav = memo(function ServerModalTabNav({
  tabs,
  selectedTab,
  onTabSelect,
}: ServerModalTabNavProps) {
  return (
    <div
      role="tablist"
      aria-label="서버 상세 정보 탭"
      className="mt-4 flex gap-1 overflow-x-auto pb-1 sm:mt-6 sm:gap-2 no-scrollbar"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = selectedTab === tab.id;

        return (
          <button
            type="button"
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabSelect(tab.id)}
            className={`relative flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300 sm:gap-2 sm:px-5 sm:py-2.5 sm:text-base ${
              isActive
                ? 'bg-white text-gray-900 shadow-md border border-gray-200'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
              aria-hidden="true"
            />
            <span>{tab.label}</span>

            {isActive && (
              <div
                className="absolute bottom-0 left-1/2 h-0.5 w-1/2 -translate-x-1/2 bg-blue-600"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
});
