/**
 * Dashboard Server Data Functions
 *
 * Server-side data fetching for Dashboard page.
 * Used by page.tsx Server Component to pre-fetch data.
 *
 * @created 2026-01-28
 * @updated 2026-02-15 - OTel direct consumption 추가
 */

import { logger } from '@/lib/logging';
import { loadCurrentOTelServers } from '@/services/metrics/otel-direct-transform';
import type { EnhancedServerMetrics } from '@/services/server-data/server-data-types';
import type {
  Server,
  ServerEnvironment,
  ServerRole,
  Service,
} from '@/types/server';
import type { ServerStatus } from '@/types/server-enums';

const STATUS_PRIORITY: Record<string, number> = {
  critical: 0,
  offline: 0,
  warning: 1,
  online: 2,
};

export type DashboardStats = {
  total: number;
  online: number;
  warning: number;
  critical: number;
  offline: number;
};

// ============================================================================
// EnhancedServerMetrics → Server 변환
// ============================================================================

function toServer(em: EnhancedServerMetrics): Server {
  const status: ServerStatus =
    em.status === 'maintenance' || em.status === 'unknown'
      ? 'offline'
      : em.status;

  return {
    id: em.id,
    name: em.name,
    hostname: em.hostname,
    status,
    cpu: em.cpu,
    memory: em.memory,
    disk: em.disk,
    network: em.network,
    responseTime: em.responseTime,
    uptime: em.uptime,
    location: em.location,
    alerts: [],
    ip: em.ip,
    os: em.os,
    type: em.type as ServerRole,
    role: em.role as ServerRole,
    environment: em.environment as ServerEnvironment,
    provider: em.provider,
    specs: em.specs,
    lastUpdate: new Date(em.lastUpdate),
    services: em.services as Service[],
    systemInfo: em.systemInfo,
    networkInfo: em.networkInfo,
    structuredLogs: em.structuredLogs,
  };
}

// ============================================================================
// OTel Direct Dashboard Data
// ============================================================================

export type OTelDashboardData = {
  servers: Server[];
  stats: DashboardStats;
  timeInfo: { hour: number; slotIndex: number; minuteOfDay: number };
};

/**
 * OTel processed 데이터에서 직접 대시보드 데이터를 생성 (5단계 → 1단계)
 */
export async function getOTelDashboardData(): Promise<OTelDashboardData> {
  try {
    const { servers, hour, slotIndex, minuteOfDay } =
      await loadCurrentOTelServers();

    // EnhancedServerMetrics → Server 변환 + 상태 우선순위 정렬
    const converted = servers.map(toServer);
    const sortedServers = converted.sort((a, b) => {
      const priorityA = STATUS_PRIORITY[a.status] ?? 3;
      const priorityB = STATUS_PRIORITY[b.status] ?? 3;
      return priorityA - priorityB;
    });

    const stats: DashboardStats = {
      total: converted.length,
      online: converted.filter((s) => s.status === 'online').length,
      warning: converted.filter((s) => s.status === 'warning').length,
      critical: converted.filter((s) => s.status === 'critical').length,
      offline: converted.filter((s) => s.status === 'offline').length,
    };

    return {
      servers: sortedServers,
      stats,
      timeInfo: { hour, slotIndex, minuteOfDay },
    };
  } catch (error) {
    logger.error('[server-data] OTel dashboard data load failed:', error);
    return {
      servers: [],
      stats: { total: 0, online: 0, warning: 0, critical: 0, offline: 0 },
      timeInfo: { hour: 0, slotIndex: 0, minuteOfDay: 0 },
    };
  }
}
