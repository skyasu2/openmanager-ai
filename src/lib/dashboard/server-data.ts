/**
 * Dashboard Server Data Functions
 *
 * Server-side data fetching for Dashboard page.
 * Used by page.tsx Server Component to pre-fetch data.
 *
 * @created 2026-01-28
 * @updated 2026-02-15 - OTel direct consumption 추가
 */

import { getServerMonitoringService } from '@/services/monitoring';
import { loadCurrentOTelServers } from '@/services/metrics/otel-direct-transform';
import type { EnhancedServerMetrics } from '@/services/server-data/server-data-types';
import type { Server } from '@/types/server';

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

export type DashboardInitialData = {
  servers: Server[];
  stats: DashboardStats;
};

/**
 * Fetch dashboard data on the server side.
 *
 * @returns Pre-sorted servers and calculated stats
 */
export async function getDashboardData(): Promise<DashboardInitialData> {
  const service = getServerMonitoringService();
  const servers = service.getAllAsServers();

  // Sort by status priority (critical/offline first)
  const sortedServers = [...servers].sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.status] ?? 3;
    const priorityB = STATUS_PRIORITY[b.status] ?? 3;
    return priorityA - priorityB;
  });

  const stats: DashboardStats = {
    total: servers.length,
    online: servers.filter((s) => s.status === 'online').length,
    warning: servers.filter((s) => s.status === 'warning').length,
    critical: servers.filter((s) => s.status === 'critical').length,
    offline: servers.filter((s) => s.status === 'offline').length,
  };

  return { servers: sortedServers, stats };
}

// ============================================================================
// OTel Direct Dashboard Data
// ============================================================================

export type OTelDashboardData = {
  servers: EnhancedServerMetrics[];
  stats: DashboardStats;
  timeInfo: { hour: number; slotIndex: number; minuteOfDay: number };
};

/**
 * OTel processed 데이터에서 직접 대시보드 데이터를 생성 (5단계 → 1단계)
 */
export async function getOTelDashboardData(): Promise<OTelDashboardData> {
  const { servers, hour, slotIndex, minuteOfDay } = loadCurrentOTelServers();

  // Sort by status priority (critical/offline first)
  const sortedServers = [...servers].sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.status] ?? 3;
    const priorityB = STATUS_PRIORITY[b.status] ?? 3;
    return priorityA - priorityB;
  });

  const stats: DashboardStats = {
    total: servers.length,
    online: servers.filter((s) => s.status === 'online').length,
    warning: servers.filter((s) => s.status === 'warning').length,
    critical: servers.filter((s) => s.status === 'critical').length,
    offline: servers.filter((s) => s.status === 'offline').length,
  };

  return {
    servers: sortedServers,
    stats,
    timeInfo: { hour, slotIndex, minuteOfDay },
  };
}
