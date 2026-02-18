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
    refetchInterval: () => {
      // 다음 10분 슬롯 경계까지 남은 ms 계산 (KST :00/:10/:20/:30/:40/:50 정렬)
      const now = new Date();
      const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
      const kst = new Date(kstMs);
      const minuteInSlot = kst.getUTCMinutes() % 10;
      const secondsInSlot = kst.getUTCSeconds();
      const remainingMs =
        ((10 - minuteInSlot) * 60 - secondsInSlot) * 1000 -
        kst.getUTCMilliseconds();
      return Math.max(remainingMs + 2000, 5000); // 2초 버퍼, 최소 5초
    },
    staleTime: 9 * 60 * 1000, // 540초간 fresh 유지
    gcTime: 5 * 60 * 1000, // 5분 미사용 데이터 보관
    refetchOnWindowFocus: false, // 탭 포커스 시 중복 refetch 방지
    refetchOnReconnect: true, // 네트워크 복구 시 최신 상태 동기화
    retry: 2, // 최대 2회 재시도
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000), // exponential backoff (1s, 2s, 4s... max 10s)
  });
}
