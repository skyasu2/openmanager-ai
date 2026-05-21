'use client';

import { Server as ServerIcon } from 'lucide-react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { EnhancedChatMessage } from '@/stores/useAISidebarStore';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { Server } from '@/types/server';

type ServerContextPanelProps = {
  className?: string;
  messages: EnhancedChatMessage[];
  queryAsOfDataSlot?: JobDataSlot;
  servers?: Server[];
};

function getServerTokens(server: Server): string[] {
  return [server.id, server.name, server.hostname, server.ip]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.toLowerCase());
}

function findMentionedServers(
  messages: EnhancedChatMessage[],
  servers: Server[] = []
): Server[] {
  const corpus = messages
    .map((message) => message.content)
    .join('\n')
    .toLowerCase();

  if (!corpus.trim() || servers.length === 0) {
    return [];
  }

  return servers
    .filter((server) =>
      getServerTokens(server).some((token) => token && corpus.includes(token))
    )
    .slice(0, 3);
}

function formatMetric(label: string, value: number): string {
  return `${label} ${Math.round(value)}%`;
}

function getStatusClass(status: Server['status']): string {
  switch (status) {
    case 'online':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'warning':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'critical':
    case 'offline':
      return 'bg-red-50 text-red-700 ring-red-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

export function ServerContextPanel({
  className,
  messages,
  queryAsOfDataSlot,
  servers = [],
}: ServerContextPanelProps) {
  const relatedServers = useMemo(
    () => findMentionedServers(messages, servers),
    [messages, servers]
  );

  return (
    <aside
      data-testid="server-context-panel"
      className={cn(
        'flex w-80 shrink-0 flex-col border-l border-slate-200 bg-slate-50/70',
        className
      )}
    >
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <ServerIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-900">
            서버 컨텍스트
          </h2>
        </div>
        {queryAsOfDataSlot?.timeLabel && (
          <p className="mt-1 text-xs text-slate-500">
            기준 {queryAsOfDataSlot.timeLabel}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {relatedServers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">
            대화 시작 후 관련 서버가 여기 표시됩니다
          </div>
        ) : (
          <div className="space-y-3">
            {relatedServers.map((server) => (
              <article
                key={server.id}
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {server.name}
                    </h3>
                    <p className="truncate text-xs text-slate-500">
                      {server.hostname ?? server.ip ?? server.location}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1',
                      getStatusClass(server.status)
                    )}
                  >
                    {server.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    {formatMetric('CPU', server.cpu)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {formatMetric('MEM', server.memory)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {formatMetric('DISK', server.disk)}
                  </span>
                </div>

                <a
                  href={`/dashboard/servers/${encodeURIComponent(server.id)}`}
                  className="mt-3 inline-flex text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  상세 보기
                </a>
              </article>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
