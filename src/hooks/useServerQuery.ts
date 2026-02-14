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
    refetchInterval: 60 * 1000, // 60초 폴링 (모니터링 보고서와 시점 차이 축소)
    staleTime: 45 * 1000, // 45초간 fresh 유지
    gcTime: 5 * 60 * 1000, // 5분 미사용 데이터 보관
    refetchOnWindowFocus: false, // 탭 포커스 시 중복 refetch 방지
    refetchOnReconnect: true, // 네트워크 복구 시 최신 상태 동기화
  });
}
