'use client';

import { AlertTriangle, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { useIncidentEvents } from '@/hooks/dashboard/useIncidentEvents';
import { cn } from '@/lib/utils';
import type { IncidentMetric, IncidentSeverity } from '@/types/incidents';
import {
  formatDashboardDateTime,
  formatRotatingTimestamp,
} from '@/utils/dashboard/rotating-timestamp';

type IncidentExplorerModalProps = {
  open: boolean;
  onClose: () => void;
  initialSeverity?: IncidentSeverity | 'all';
};

const SEVERITY_OPTIONS: Array<IncidentSeverity | 'all'> = [
  'all',
  'warning',
  'critical',
  'offline',
];
const METRIC_OPTIONS: Array<IncidentMetric | 'all'> = [
  'all',
  'cpu',
  'memory',
  'disk',
  'network',
  'composite',
];

const severityBadgeClass: Record<IncidentSeverity, string> = {
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  critical: 'bg-rose-100 text-rose-700 border-rose-200',
  offline: 'bg-slate-100 text-slate-700 border-slate-200',
};

function labelSeverity(value: IncidentSeverity | 'all'): string {
  if (value === 'all') return '전체';
  if (value === 'warning') return '경고';
  if (value === 'critical') return '위험';
  return '오프라인';
}

function labelMetric(value: IncidentMetric | 'all'): string {
  if (value === 'all') return '전체 메트릭';
  if (value === 'composite') return '복합';
  return value.toUpperCase();
}

export function IncidentExplorerModal({
  open,
  onClose,
  initialSeverity = 'all',
}: IncidentExplorerModalProps) {
  const [severity, setSeverity] = useState<IncidentSeverity | 'all'>('all');
  const [metric, setMetric] = useState<IncidentMetric | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const sessionAnchorRef = useRef(new Date());
  const [sessionAnchorLabel, setSessionAnchorLabel] = useState('');

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    sessionAnchorRef.current = now;
    setSessionAnchorLabel(formatDashboardDateTime(now));
    setSeverity(initialSeverity);
    setMetric('all');
    setPage(1);
  }, [open, initialSeverity]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, error } = useIncidentEvents({
    enabled: open,
    search: debouncedSearch,
    severity,
    metric,
    page,
    limit: 20,
    sortOrder: 'desc',
  });

  const incidents = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : '장애 이슈를 불러오지 못했습니다.'
    : null;

  const paginationRange = useMemo(() => {
    const maxVisible = 5;
    const current = Math.max(1, Math.min(page, totalPages));
    let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    return Array.from(
      { length: Math.max(0, endPage - startPage + 1) },
      (_, i) => startPage + i
    );
  }, [page, totalPages]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl flex flex-col gap-0 p-0">
        <DialogHeader className="border-b border-gray-100 px-5 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
              <AlertTriangle size={18} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                Incident Search
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                현재 상태와 무관하게 24시간 경고/위험 이벤트를 검색합니다
              </DialogDescription>
            </div>
            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              {total}건
            </span>
          </div>
        </DialogHeader>

        <div className="border-b border-gray-100 bg-white/95 px-5 py-3 backdrop-blur-sm">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <label className="relative block">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="서버ID/호스트/요약 검색"
                className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none"
              />
            </label>

            <select
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value as IncidentSeverity | 'all');
                setPage(1);
              }}
              aria-label="심각도 필터"
              className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
            >
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  심각도: {labelSeverity(option)}
                </option>
              ))}
            </select>

            <select
              value={metric}
              onChange={(event) => {
                setMetric(event.target.value as IncidentMetric | 'all');
                setPage(1);
              }}
              aria-label="메트릭 필터"
              className="rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none"
            >
              {METRIC_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  메트릭: {labelMetric(option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-b border-gray-100 bg-gray-50/80 px-5 py-2 text-[11px] text-gray-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
              Realtime Anchor
            </span>
            <span className="font-medium tabular-nums text-gray-700">
              {sessionAnchorLabel || '-'}
            </span>
            {data?.metadata.windowStart && data?.metadata.windowEnd && (
              <span className="text-gray-500">
                데이터 범위:{' '}
                {formatRotatingTimestamp(data.metadata.windowStart)}
                {' ~ '}
                {formatRotatingTimestamp(data.metadata.windowEnd)}
              </span>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {errorMessage && (
            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {errorMessage}
            </div>
          )}

          {isLoading && incidents.length === 0 ? (
            <div className="flex items-center justify-center py-14">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-rose-400 border-t-transparent" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <AlertTriangle size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">검색 결과가 없습니다</p>
              <p className="mt-1 text-xs text-gray-500">
                필터 또는 검색어를 조정해 주세요
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="rounded-lg border border-gray-100 bg-white px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase',
                          severityBadgeClass[incident.status]
                        )}
                      >
                        {incident.status}
                      </span>
                      <span className="truncate text-sm font-semibold text-gray-800">
                        {incident.serverId}
                      </span>
                      <span className="text-xs text-gray-500">
                        {incident.serverType}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-500 tabular-nums">
                      {formatRotatingTimestamp(incident.timestamp, {
                        anchorDate: sessionAnchorRef.current,
                      })}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-gray-700">
                    {incident.summary}
                  </p>

                  {incident.causes.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {incident.causes.map((cause) => (
                        <span
                          key={`${incident.id}-${cause.metric}`}
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                            cause.level === 'critical'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          )}
                        >
                          {cause.metric.toUpperCase()} {cause.value}% (W
                          {cause.warningThreshold}/C{cause.criticalThreshold})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="border-t border-gray-100 px-5 py-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                    className={
                      page <= 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>

                {paginationRange.map((pageNumber) => (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      href="#"
                      isActive={pageNumber === page}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage(pageNumber);
                      }}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                    className={
                      page >= totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
