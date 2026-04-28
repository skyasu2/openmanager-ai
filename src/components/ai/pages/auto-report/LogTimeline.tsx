'use client';

import { useEffect, useMemo, useState } from 'react';
import { getOTelHourlyData } from '@/data/otel-data';

interface LogTimelineProps {
  timestamp: Date;
  affectedServerIds: string[];
}

interface TimelineLogItem {
  id: string;
  body: string;
  resource: string;
  severityText: string;
  timeUnixNano: number;
}

function getSeverityBadgeClass(severity: string): string {
  const normalized = severity.toUpperCase();

  if (normalized.includes('ERROR') || normalized.includes('FATAL')) {
    return 'bg-red-100 text-red-700';
  }

  if (normalized.includes('WARN')) {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-slate-100 text-slate-700';
}

function formatLogTime(timeUnixNano: number): string {
  return new Date(timeUnixNano / 1_000_000).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function LogTimeline({
  timestamp,
  affectedServerIds,
}: LogTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<TimelineLogItem[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;

    let mounted = true;

    const loadLogs = async () => {
      setIsLoading(true);
      setError(null);

      const hourlyData = await getOTelHourlyData(timestamp.getHours());
      if (!mounted) return;

      if (!hourlyData) {
        setLogs([]);
        setError('로그 데이터를 불러오지 못했습니다.');
        setIsLoading(false);
        return;
      }

      const allowedResources =
        affectedServerIds.length > 0 ? new Set(affectedServerIds) : null;
      const nextLogs = hourlyData.slots
        .flatMap((slot) => slot.logs)
        .filter((log) =>
          allowedResources ? allowedResources.has(log.resource) : true
        )
        .sort((a, b) => a.timeUnixNano - b.timeUnixNano)
        .map((log) => ({
          id: `${log.resource}-${log.timeUnixNano}-${log.severityText}`,
          body: log.body,
          resource: log.resource,
          severityText: log.severityText,
          timeUnixNano: log.timeUnixNano,
        }));

      setLogs(nextLogs);
      setIsLoading(false);
    };

    void loadLogs();

    return () => {
      mounted = false;
    };
  }, [affectedServerIds, expanded, timestamp]);

  const serverOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.resource)));
  }, [logs]);

  useEffect(() => {
    if (selectedServer === 'all') return;
    if (serverOptions.includes(selectedServer)) return;
    setSelectedServer(serverOptions[0] ?? 'all');
  }, [selectedServer, serverOptions]);

  const filteredLogs = useMemo(() => {
    if (selectedServer === 'all') return logs;
    return logs.filter((log) => log.resource === selectedServer);
  }, [logs, selectedServer]);

  return (
    <section className="rounded-lg bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-700">
            로그 타임라인
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            인시던트 발생 시간대의 OTel 로그를 서버 기준으로 확인합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-label={expanded ? '로그 타임라인 숨기기' : '로그 타임라인 보기'}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          {expanded ? '로그 타임라인 숨기기' : '로그 타임라인 보기'}
          <span className="text-xs text-slate-500">
            {expanded ? '접기' : '열기'}
          </span>
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="report-log-server-filter"
              className="text-xs text-slate-600"
            >
              서버 필터
            </label>
            <select
              id="report-log-server-filter"
              value={selectedServer}
              onChange={(event) => setSelectedServer(event.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
            >
              <option value="all">전체 서버</option>
              {serverOptions.map((serverId) => (
                <option key={serverId} value={serverId}>
                  {serverId}
                </option>
              ))}
            </select>
          </div>

          {isLoading && (
            <div className="rounded-md bg-white px-3 py-2 text-xs text-slate-500">
              로그를 불러오는 중입니다.
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}

          {!isLoading && !error && filteredLogs.length === 0 && (
            <div className="rounded-md bg-white px-3 py-2 text-xs text-slate-500">
              표시할 로그가 없습니다.
            </div>
          )}

          {!isLoading && !error && filteredLogs.length > 0 && (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const isOpen = expandedLogId === log.id;

                return (
                  <article
                    key={log.id}
                    className="rounded-md border border-slate-200 bg-white"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLogId((prev) =>
                          prev === log.id ? null : log.id
                        )
                      }
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-700">
                            {formatLogTime(log.timeUnixNano)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getSeverityBadgeClass(log.severityText)}`}
                          >
                            {log.severityText.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500">
                            {log.resource}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-600">
                          {log.body}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs text-slate-400">
                        {isOpen ? '접기' : '열기'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 px-3 py-2">
                        <p className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">
                          {log.body}
                        </p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
