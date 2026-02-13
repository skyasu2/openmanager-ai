import { useMemo, useRef } from 'react';
import type { EnhancedServerData } from '@/types/dashboard/server-dashboard.types';

/**
 * 🛡️ useServerDataCache Hook
 *
 * 데이터 캐싱 정책:
 * - 성공 응답의 빈 배열은 실제 상태로 반영
 * - 네트워크 오류 시에만 이전 캐시 유지 (옵션)
 */
export function useServerDataCache(
  rawServers: EnhancedServerData[],
  options?: { keepPreviousOnError?: boolean }
) {
  const previousServersRef = useRef<EnhancedServerData[]>([]);
  const keepPreviousOnError = options?.keepPreviousOnError ?? false;

  const cachedServers = useMemo(() => {
    // 유효하지 않은 데이터인 경우 이전 캐시 반환
    if (!rawServers || !Array.isArray(rawServers)) {
      return previousServersRef.current;
    }

    // 성공 응답에서 빈 배열은 실제 상태로 간주하여 그대로 반영
    if (rawServers.length === 0) {
      if (keepPreviousOnError && previousServersRef.current.length > 0) {
        return previousServersRef.current;
      }
      previousServersRef.current = [];
      return [];
    }

    // 유효한 데이터인 경우 캐시 업데이트
    previousServersRef.current = rawServers;
    return rawServers;
  }, [rawServers, keepPreviousOnError]);

  return { cachedServers };
}
