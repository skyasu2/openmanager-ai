/**
 * MetricsAggregator - 메트릭 집계/그룹화/Top-N
 *
 * 원본 메트릭 → server_type별 그룹 집계, Top-N, 상태별 카운트
 *
 * @created 2026-02-04
 */

import type { ServerMetrics } from '@/services/metrics/MetricsProvider';

export type ServerTypeStats = {
  serverType: string;
  count: number;
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  avgNetwork: number;
  maxCpu: number;
  maxMemory: number;
  onlineCount: number;
  warningCount: number;
  criticalCount: number;
};

export type StatusCounts = {
  total: number;
  online: number;
  warning: number;
  critical: number;
  offline: number;
};

export type TopServer = {
  serverId: string;
  instance: string;
  serverType: string;
  value: number;
};

export type AggregatedMetrics = {
  statusCounts: StatusCounts;
  byServerType: ServerTypeStats[];
  topCpu: TopServer[];
  topMemory: TopServer[];
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
  avgNetwork: number;
};

export class MetricsAggregator {
  aggregate(allMetrics: ServerMetrics[]): AggregatedMetrics {
    // 상태별 카운트
    const statusCounts: StatusCounts = {
      total: allMetrics.length,
      online: 0,
      warning: 0,
      critical: 0,
      offline: 0,
    };
    for (const m of allMetrics) {
      statusCounts[m.status]++;
    }

    // 전체 평균
    const totalCpu = allMetrics.reduce((s, m) => s + m.cpu, 0);
    const totalMemory = allMetrics.reduce((s, m) => s + m.memory, 0);
    const totalDisk = allMetrics.reduce((s, m) => s + m.disk, 0);
    const totalNetwork = allMetrics.reduce((s, m) => s + m.network, 0);
    const count = allMetrics.length || 1;

    // server_type별 그룹화
    const typeMap = new Map<string, ServerMetrics[]>();
    for (const m of allMetrics) {
      const list = typeMap.get(m.serverType) ?? [];
      list.push(m);
      typeMap.set(m.serverType, list);
    }

    const byServerType: ServerTypeStats[] = [];
    for (const [serverType, servers] of typeMap) {
      const n = servers.length;
      byServerType.push({
        serverType,
        count: n,
        avgCpu: Math.round(servers.reduce((s, m) => s + m.cpu, 0) / n),
        avgMemory: Math.round(servers.reduce((s, m) => s + m.memory, 0) / n),
        avgDisk: Math.round(servers.reduce((s, m) => s + m.disk, 0) / n),
        avgNetwork: Math.round(servers.reduce((s, m) => s + m.network, 0) / n),
        maxCpu: Math.max(...servers.map((m) => m.cpu)),
        maxMemory: Math.max(...servers.map((m) => m.memory)),
        onlineCount: servers.filter((m) => m.status === 'online').length,
        warningCount: servers.filter((m) => m.status === 'warning').length,
        criticalCount: servers.filter((m) => m.status === 'critical').length,
      });
    }

    // Top-5 CPU
    const topCpu: TopServer[] = [...allMetrics]
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 5)
      .map((m) => ({
        serverId: m.serverId,
        instance: `${m.serverId}:9100`,
        serverType: m.serverType,
        value: m.cpu,
      }));

    // Top-5 Memory
    const topMemory: TopServer[] = [...allMetrics]
      .sort((a, b) => b.memory - a.memory)
      .slice(0, 5)
      .map((m) => ({
        serverId: m.serverId,
        instance: `${m.serverId}:9100`,
        serverType: m.serverType,
        value: m.memory,
      }));

    return {
      statusCounts,
      byServerType,
      topCpu,
      topMemory,
      avgCpu: Math.round(totalCpu / count),
      avgMemory: Math.round(totalMemory / count),
      avgDisk: Math.round(totalDisk / count),
      avgNetwork: Math.round(totalNetwork / count),
    };
  }
}
