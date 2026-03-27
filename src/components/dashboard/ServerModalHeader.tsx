'use client';

import { Pause, Play, Server as ServerIcon, X } from 'lucide-react';
import { memo } from 'react';
import type { ServerData } from './EnhancedServerModal.types';

interface ServerModalHeaderProps {
  server: ServerData;
  isRealtime: boolean;
  onToggleRealtime: () => void;
  onClose: () => void;
}

export const ServerModalHeader = memo(function ServerModalHeader({
  server,
  isRealtime,
  onToggleRealtime,
  onClose,
}: ServerModalHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      {/* 핵심 정보 */}
      <div className="flex items-center gap-2 sm:gap-4">
        <div
          className={`rounded-xl p-2 shadow-md sm:p-3 bg-white ${
            server.status === 'online'
              ? 'text-emerald-600'
              : server.status === 'warning'
                ? 'text-amber-600'
                : 'text-red-600'
          }`}
        >
          <ServerIcon className="h-5 w-5 sm:h-7 sm:w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="modal-title"
            className="text-lg font-bold sm:text-2xl text-gray-900"
          >
            <span className="truncate">{server.name}</span>
          </h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 sm:gap-3 sm:text-base">
            <span className="font-medium">{server.type}</span>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span className="hidden sm:inline">{server.location}</span>
          </div>
        </div>
      </div>

      {/* 핵심 액션 */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleRealtime}
          className={`flex items-center gap-1 rounded-xl px-2 py-2 text-sm font-medium transition-all duration-300 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-base ${
            isRealtime
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm'
              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
          }`}
        >
          {isRealtime ? (
            <>
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Live</span>
              <span className="animate-pulse text-emerald-500">●</span>
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" />
              <span className="hidden sm:inline">Paused</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-gray-100 p-2 transition-all duration-300 hover:rotate-90 hover:scale-110 hover:bg-gray-200 border border-gray-200 sm:p-2.5 text-gray-500 hover:text-gray-700"
          title="모달 닫기"
        >
          <X className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>
    </div>
  );
});
