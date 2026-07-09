import type { MonitoringRoleGroupSummary } from '@/lib/ai/domains/monitoring/artifact-types';
import type { MonitoringBatchAnalysisResponse } from '@/types/intelligent-monitoring.types';
import type { OTelResourceCatalog } from '@/types/otel-metrics';

const ROLE_DISPLAY_ORDER = [
  'web',
  'application',
  'database',
  'cache',
  'storage',
  'loadbalancer',
  'monitoring',
  'batch',
  'worker',
  'unknown',
] as const;

const ROLE_ALIASES: Record<string, string> = {
  api: 'application',
  app: 'application',
  apps: 'application',
  was: 'application',
  db: 'database',
  mysql: 'database',
  postgres: 'database',
  postgresql: 'database',
  redis: 'cache',
  memcached: 'cache',
  lb: 'loadbalancer',
  load_balancer: 'loadbalancer',
};

function normalizeServerRole(value: string | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return 'unknown';
  return ROLE_ALIASES[normalized] ?? normalized;
}

function readCatalogServerRole(
  catalog: OTelResourceCatalog | null | undefined,
  serverId: string
): string | undefined {
  return catalog?.resources?.[serverId]?.['server.role'];
}

function roleSortIndex(role: string): number {
  const index = ROLE_DISPLAY_ORDER.indexOf(
    role as (typeof ROLE_DISPLAY_ORDER)[number]
  );
  return index === -1 ? ROLE_DISPLAY_ORDER.length : index;
}

function safeMetricValue(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function buildMonitoringRoleGroupSummary(
  analysis: MonitoringBatchAnalysisResponse,
  catalog?: OTelResourceCatalog | null
): MonitoringRoleGroupSummary[] {
  const groups = new Map<
    string,
    {
      count: number;
      warningCount: number;
      criticalCount: number;
      cpuTotal: number;
      memoryTotal: number;
      diskTotal: number;
    }
  >();

  for (const server of analysis.servers) {
    const role = normalizeServerRole(
      readCatalogServerRole(catalog, server.id) ?? server.type
    );
    const group = groups.get(role) ?? {
      count: 0,
      warningCount: 0,
      criticalCount: 0,
      cpuTotal: 0,
      memoryTotal: 0,
      diskTotal: 0,
    };

    group.count += 1;
    group.warningCount += server.status === 'warning' ? 1 : 0;
    group.criticalCount +=
      server.status === 'critical' || server.status === 'offline' ? 1 : 0;
    group.cpuTotal += safeMetricValue(server.cpu);
    group.memoryTotal += safeMetricValue(server.memory);
    group.diskTotal += safeMetricValue(server.disk);
    groups.set(role, group);
  }

  return Array.from(groups.entries())
    .sort(([roleA], [roleB]) => {
      const orderDiff = roleSortIndex(roleA) - roleSortIndex(roleB);
      return orderDiff !== 0 ? orderDiff : roleA.localeCompare(roleB);
    })
    .map(([role, group]) => ({
      role,
      count: group.count,
      warningCount: group.warningCount,
      criticalCount: group.criticalCount,
      avgCpu: Math.round(group.cpuTotal / group.count),
      avgMemory: Math.round(group.memoryTotal / group.count),
      avgDisk: Math.round(group.diskTotal / group.count),
    }));
}
