'use client';

import { useQuery } from '@tanstack/react-query';
import type {
  IncidentEvent,
  IncidentMetric,
  IncidentQueryResult,
  IncidentSeverity,
} from '@/types/incidents';

export type IncidentEventsFilter = {
  search?: string;
  severity?: IncidentSeverity | 'all';
  metric?: IncidentMetric | 'all';
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
};

const EMPTY_RESULT: IncidentQueryResult = {
  items: [],
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 1,
  metadata: {
    builtAt: null,
    windowStart: null,
    windowEnd: null,
    cacheAgeMs: null,
  },
};

async function fetchIncidentEvents(
  filter: IncidentEventsFilter
): Promise<IncidentQueryResult> {
  const params = new URLSearchParams();

  params.set('action', 'incidents');
  params.set('page', String(filter.page ?? 1));
  params.set('limit', String(filter.limit ?? 20));
  params.set('sortOrder', filter.sortOrder ?? 'desc');

  if (filter.search?.trim()) params.set('search', filter.search.trim());
  if (filter.severity && filter.severity !== 'all')
    params.set('severity', filter.severity);
  if (filter.metric && filter.metric !== 'all')
    params.set('metric', filter.metric);
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);

  const response = await fetch(`/api/servers-unified?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`incident api request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    error?: string;
    data?: IncidentEvent[];
    pagination?: {
      page?: number;
      limit?: number;
      total?: number;
      totalPages?: number;
    };
    metadata?: {
      builtAt?: string | null;
      incidentWindow?: { start?: string | null; end?: string | null };
      cacheAgeMs?: number | null;
    };
  };

  if (!payload.success) {
    throw new Error(payload.error || 'incident api responded with failure');
  }

  return {
    items: payload.data ?? [],
    total: payload.pagination?.total ?? 0,
    page: payload.pagination?.page ?? 1,
    limit: payload.pagination?.limit ?? 20,
    totalPages: payload.pagination?.totalPages ?? 1,
    metadata: {
      builtAt: payload.metadata?.builtAt ?? null,
      windowStart: payload.metadata?.incidentWindow?.start ?? null,
      windowEnd: payload.metadata?.incidentWindow?.end ?? null,
      cacheAgeMs: payload.metadata?.cacheAgeMs ?? null,
    },
  };
}

export function useIncidentEvents(filter: IncidentEventsFilter) {
  const enabled = filter.enabled ?? true;

  return useQuery({
    queryKey: [
      'incident-events',
      {
        search: filter.search?.trim() || '',
        severity: filter.severity || 'all',
        metric: filter.metric || 'all',
        from: filter.from || '',
        to: filter.to || '',
        page: filter.page ?? 1,
        limit: filter.limit ?? 20,
        sortOrder: filter.sortOrder ?? 'desc',
      },
    ],
    queryFn: () => fetchIncidentEvents(filter),
    enabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: (previousData) => previousData ?? EMPTY_RESULT,
  });
}
