import { useQuery } from '@tanstack/react-query';
import { getServersAction } from '@/actions/server-actions';
import type { EnhancedServerMetrics, Server } from '@/types/server';
import { mapServerToEnhanced } from '@/utils/serverUtils';

const fetchServers = async (): Promise<EnhancedServerMetrics[]> => {
  const result = await getServersAction();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch server data');
  }

  return result.data;
};

type UseServerQueryOptions = {
  /** Pre-fetched servers from Server Component (Phase 2: SSR) */
  initialData?: Server[];
  /** Allows lightweight consumers to defer polling until their surface is visible. */
  enabled?: boolean;
};

export function useServerQuery(options: UseServerQueryOptions = {}) {
  const { enabled = true, initialData } = options;

  // Transform initial data to EnhancedServerMetrics format
  const transformedInitialData = initialData
    ? initialData.map(mapServerToEnhanced)
    : undefined;

  return useQuery({
    queryKey: ['servers'],
    queryFn: fetchServers,
    initialData: transformedInitialData,
    initialDataUpdatedAt: transformedInitialData ? Date.now() : undefined,
    enabled,
    staleTime: Infinity, // 접속 시각 슬롯 고정 — 세션 내 갱신 없음
    gcTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}
