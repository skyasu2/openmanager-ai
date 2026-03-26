import { useMemo } from 'react';
import type { DashboardStats } from '@/components/dashboard/types/dashboard.types';
import type { Server } from '@/types/server';
import { debug } from '@/utils/debug';

/**
 * 서버 목록을 기반으로 대시보드 통계를 계산하는 훅
 *
 * @param servers - 페이지네이션된 서버 목록 (fallback)
 * @param allServers - 전체 서버 목록 (우선 사용)
 * @param isLoading - 데이터 로딩 상태
 */
export function useDashboardStats(
  servers: Server[],
  allServers?: Server[],
  isLoading: boolean = false
): DashboardStats {
  const stats = useMemo(() => {
    if (isLoading) {
      return {
        total: 0,
        online: 0,
        offline: 0,
        warning: 0,
        critical: 0,
        unknown: 0,
      };
    }

    // allServers(전체 서버)가 있으면 전체 기반으로 계산, 없으면 페이지네이션된 servers 사용
    const statsSource =
      allServers && allServers.length > 0 ? allServers : servers;

    if (!statsSource || statsSource.length === 0) {
      return {
        total: 0,
        online: 0,
        offline: 0,
        warning: 0,
        critical: 0,
        unknown: 0,
      };
    }

    const calculatedStats = statsSource.reduce(
      (acc, server) => {
        acc.total += 1;
        const normalizedStatus = server.status?.toLowerCase() || 'unknown';

        // 🎯 상호 배타적 카운팅: 각 서버는 정확히 하나의 상태에만 속함
        switch (normalizedStatus) {
          // 오프라인/비가용
          case 'offline':
          case 'down':
          case 'disconnected':
            acc.offline += 1;
            break;

          // 🚨 위험 상태 (critical 별도 분리)
          case 'critical':
          case 'error':
          case 'failed':
            acc.critical += 1;
            break;

          // ⚠️ 경고 상태
          case 'warning':
          case 'degraded':
          case 'unstable':
            acc.warning += 1;
            break;

          // Unknown/Maintenance
          case 'unknown':
          case 'maintenance':
            acc.unknown += 1;
            break;

          // 정상 온라인
          case 'online':
          case 'running':
          case 'active':
            acc.online += 1;
            break;

          // 정의되지 않은 상태
          default:
            acc.unknown += 1;
            break;
        }

        return acc;
      },
      { total: 0, online: 0, offline: 0, warning: 0, critical: 0, unknown: 0 }
    );

    debug.log('📊 서버 통계 계산 (Hook):', calculatedStats);
    return calculatedStats;
  }, [allServers, servers, isLoading]);

  return stats;
}
