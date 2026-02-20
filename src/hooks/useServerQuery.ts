import { useQuery } from '@tanstack/react-query';
import { getServersAction } from '@/actions/server-actions';
import {
  getMsUntilNextServerDataSlot,
  SERVER_DATA_GC_TIME_MS,
  SERVER_DATA_STALE_TIME_MS,
} from '@/config/server-data-polling';
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
};

export function useServerQuery(options: UseServerQueryOptions = {}) {
  const { initialData } = options;

  // Transform initial data to EnhancedServerMetrics format
  const transformedInitialData = initialData
    ? initialData.map(mapServerToEnhanced)
    : undefined;

  return useQuery({
    queryKey: ['servers'],
    queryFn: fetchServers,
    initialData: transformedInitialData,
    initialDataUpdatedAt: transformedInitialData ? Date.now() : undefined,
    refetchInterval: () => getMsUntilNextServerDataSlot(),
    staleTime: SERVER_DATA_STALE_TIME_MS,
    gcTime: SERVER_DATA_GC_TIME_MS,
    refetchOnWindowFocus: false, // 탭 포커스 시 중복 refetch 방지
    refetchOnReconnect: true, // 네트워크 복구 시 최신 상태 동기화
    retry: 2, // 최대 2회 재시도
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // exponential backoff (1s, 2s, 4s... max 10s)
  });
}
