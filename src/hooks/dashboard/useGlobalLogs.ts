'use client';

import { useQuery } from '@tanstack/react-query';

export type GlobalLogEntry = {
  timestamp: string;
  level: string;
  message: string;
  source: string;
  serverId: string;
};

export type GlobalLogFilter = {
  level?: 'info' | 'warn' | 'error';
  source?: string;
  keyword?: string;
  serverId?: string;
};

export type GlobalLogsResult = {
  logs: GlobalLogEntry[];
  stats: {
    total: number;
    info: number;
    warn: number;
    error: number;
  };
  sources: string[];
  serverIds: string[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  retry: () => void;
  windowStart: string | null;
  windowEnd: string | null;
};

type LogApiResponse = {
  success?: boolean;
  error?: string;
  data?: Array<{
    timestamp: string;
    level: string;
    message: string;
    source: string;
    serverId: string;
  }>;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
  metadata?: {
    logWindow?: { start?: string | null; end?: string | null };
    availableSources?: string[];
    availableServers?: string[];
    cacheAgeMs?: number | null;
    builtAt?: string | null;
  };
};

type LogQueryData = {
  logs: GlobalLogEntry[];
  total: number;
  sources: string[];
  serverIds: string[];
  windowStart: string | null;
  windowEnd: string | null;
};

async function fetchLogs(filter: GlobalLogFilter): Promise<LogQueryData> {
  const params = new URLSearchParams();
  params.set('action', 'logs');
  params.set('limit', '100');
  params.set('sortOrder', 'desc');

  if (filter.level) params.set('level', filter.level);
  if (filter.source) params.set('logSource', filter.source);
  if (filter.serverId) params.set('search', filter.serverId);
  if (filter.keyword) params.set('logKeyword', filter.keyword);

  const response = await fetch(`/api/servers-unified?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`log api request failed (${response.status})`);
  }

  const payload = (await response.json()) as LogApiResponse;

  if (!payload.success) {
    throw new Error(payload.error || 'log api responded with failure');
  }

  const logs: GlobalLogEntry[] = (payload.data ?? []).map((item) => ({
    timestamp: item.timestamp,
    level: item.level,
    message: item.message,
    source: item.source,
    serverId: item.serverId,
  }));

  return {
    logs,
    total: payload.pagination?.total ?? logs.length,
    sources: payload.metadata?.availableSources ?? [],
    serverIds: payload.metadata?.availableServers ?? [],
    windowStart: payload.metadata?.logWindow?.start ?? null,
    windowEnd: payload.metadata?.logWindow?.end ?? null,
  };
}

export function useGlobalLogs(filter: GlobalLogFilter = {}): GlobalLogsResult {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      'global-logs',
      {
        level: filter.level || '',
        source: filter.source || '',
        serverId: filter.serverId || '',
        keyword: filter.keyword || '',
      },
    ],
    queryFn: () => fetchLogs(filter),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const logs = data?.logs ?? [];

  const stats = {
    total: data?.total ?? 0,
    info: logs.filter((l) => l.level === 'info').length,
    warn: logs.filter((l) => l.level === 'warn').length,
    error: logs.filter((l) => l.level === 'error').length,
  };

  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : '로그를 불러오지 못했습니다.'
    : null;

  return {
    logs,
    stats,
    sources: data?.sources ?? [],
    serverIds: data?.serverIds ?? [],
    isLoading,
    isError,
    errorMessage,
    retry: () => {
      void refetch();
    },
    windowStart: data?.windowStart ?? null,
    windowEnd: data?.windowEnd ?? null,
  };
}
