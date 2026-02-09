import { useQuery } from '@tanstack/react-query';
import type { EnhancedServerMetrics, Server } from '@/types/server';
import { mapServerToEnhanced } from '@/utils/serverUtils';

const fetchServers = async (): Promise<EnhancedServerMetrics[]> => {
  const response = await fetch('/api/servers-unified?limit=50');
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.message || 'Failed to fetch data');
  }
  return result.data.map(mapServerToEnhanced);
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
    refetchInterval: 10 * 60 * 1000, // 10분 폴링 (JSON 데이터 10분 간격에 맞춤)
    staleTime: 9 * 60 * 1000, // 9분간 fresh 유지 (다음 갱신 직전까지)
    gcTime: 15 * 60 * 1000, // 15분 미사용 데이터 보관
    refetchOnWindowFocus: false, // 탭 포커스 시 중복 refetch 방지
    refetchOnReconnect: false, // 네트워크 재연결 시 중복 refetch 방지
  });
}
