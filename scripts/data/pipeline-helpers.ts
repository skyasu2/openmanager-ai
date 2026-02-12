/**
 * Pre-compute Pipeline Helper Functions
 *
 * AlertManager, MetricsAggregator, HealthCalculator의 빌드타임 재현.
 * 런타임 클래스(src/services/monitoring/)와 동일 로직이며,
 * 스크립트에서 @/ path alias를 사용할 수 없으므로 별도 구현.
 *
 * SSOT: src/services/monitoring/ 클래스 수정 시 이 파일도 동기화 필요.
 *
 * @created 2026-02-04
 */

import type {
  AggregatedMetrics,
  Alert,
  AlertSeverity,
  HealthGrade,
  HealthReport,
  PrometheusTarget,
  ServerTypeStats,
  StatusCounts,
  TopServer,
} from './types';

// ============================================================================
// Shared Constants
// ============================================================================

export const THRESHOLDS: Record<string, { warning: number; critical: number }> = {
  cpu: { warning: 80, critical: 90 },
  memory: { warning: 80, critical: 90 },
  disk: { warning: 80, critical: 90 },
  network: { warning: 70, critical: 85 },
};

// ============================================================================
// Helpers
// ============================================================================

export function extractServerId(instance: string): string {
  return instance.replace(/:9100$/, '');
}

export function determineStatus(
  cpu: number,
  memory: number,
  disk: number,
  network: number
): 'online' | 'warning' | 'critical' | 'offline' {
  if (cpu >= 90 || memory >= 90 || disk >= 90 || network >= 85) return 'critical';
  if (cpu >= 80 || memory >= 80 || disk >= 80 || network >= 70) return 'warning';
  return 'online';
}

// ============================================================================
// Alert Evaluation (AlertManager.evaluate 로직 재현)
// ============================================================================

export function evaluateAlerts(
  targets: Record<string, PrometheusTarget>,
  hour: number,
  slotIndex: number
): Alert[] {
  const alerts: Alert[] = [];
  const timestamp = new Date(2026, 0, 1, hour, slotIndex * 10).toISOString();

  for (const [instanceKey, target] of Object.entries(targets)) {
    const serverId = extractServerId(instanceKey);
    const metricPairs: Array<{ key: string; value: number }> = [
      { key: 'cpu', value: target.metrics.node_cpu_usage_percent },
      { key: 'memory', value: target.metrics.node_memory_usage_percent },
      { key: 'disk', value: target.metrics.node_filesystem_usage_percent },
      { key: 'network', value: target.metrics.node_network_transmit_bytes_rate },
    ];

    for (const { key, value } of metricPairs) {
      const threshold = THRESHOLDS[key];
      if (!threshold) continue;

      let severity: AlertSeverity | null = null;
      let thresholdValue = 0;

      if (value >= threshold.critical) {
        severity = 'critical';
        thresholdValue = threshold.critical;
      } else if (value >= threshold.warning) {
        severity = 'warning';
        thresholdValue = threshold.warning;
      }

      if (severity) {
        alerts.push({
          id: `${serverId}-${key}`,
          serverId,
          instance: instanceKey,
          labels: {
            server_type: target.labels.server_type,
            datacenter: target.labels.datacenter,
          },
          metric: key,
          value,
          threshold: thresholdValue,
          severity,
          state: 'firing',
          firedAt: timestamp,
          duration: 0,
        });
      }
    }
  }

  return alerts;
}

// ============================================================================
// Metrics Aggregation (MetricsAggregator.aggregate 로직 재현)
// ============================================================================

export type SimpleMetric = {
  serverId: string;
  serverType: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  status: 'online' | 'warning' | 'critical' | 'offline';
};

export function targetsToSimpleMetrics(
  targets: Record<string, PrometheusTarget>
): SimpleMetric[] {
  return Object.entries(targets).map(([instanceKey, target]) => {
    const cpu = target.metrics.node_cpu_usage_percent;
    const memory = target.metrics.node_memory_usage_percent;
    const disk = target.metrics.node_filesystem_usage_percent;
    const network = target.metrics.node_network_transmit_bytes_rate;
    const status = target.metrics.up === 0
      ? ('offline' as const)
      : determineStatus(cpu, memory, disk, network);

    return {
      serverId: extractServerId(instanceKey),
      serverType: target.labels.server_type,
      cpu,
      memory,
      disk,
      network,
      status,
    };
  });
}

export function aggregateMetrics(allMetrics: SimpleMetric[]): AggregatedMetrics {
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

  const count = allMetrics.length || 1;
  const totalCpu = allMetrics.reduce((s, m) => s + m.cpu, 0);
  const totalMemory = allMetrics.reduce((s, m) => s + m.memory, 0);
  const totalDisk = allMetrics.reduce((s, m) => s + m.disk, 0);
  const totalNetwork = allMetrics.reduce((s, m) => s + m.network, 0);

  const typeMap = new Map<string, SimpleMetric[]>();
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

  const topCpu: TopServer[] = [...allMetrics]
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 5)
    .map((m) => ({
      serverId: m.serverId,
      instance: `${m.serverId}:9100`,
      serverType: m.serverType,
      value: m.cpu,
    }));

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

// ============================================================================
// Health Calculation (HealthCalculator.calculate 로직 재현)
// ============================================================================

function getGrade(score: number): HealthGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function calculateHealth(aggregated: AggregatedMetrics, firingAlerts: Alert[]): HealthReport {
  const criticalCount = firingAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = firingAlerts.filter((a) => a.severity === 'warning').length;

  const criticalPenalty = criticalCount * 15;
  const warningPenalty = warningCount * 5;
  const avgCpuPenalty = aggregated.avgCpu >= 70 ? Math.round((aggregated.avgCpu - 70) * 0.5) : 0;
  const longFiringPenalty = 0; // pre-compute에서는 duration 추적 불가

  const score = Math.max(0, Math.min(100, 100 - criticalPenalty - warningPenalty - avgCpuPenalty - longFiringPenalty));

  return {
    score,
    grade: getGrade(score),
    penalties: {
      criticalAlerts: criticalPenalty,
      warningAlerts: warningPenalty,
      highCpuAvg: avgCpuPenalty,
      longFiringAlerts: longFiringPenalty,
    },
  };
}

// ============================================================================
// AI Context Generation (MonitoringContext.getLLMContext 로직 재현)
// ============================================================================

export function buildAIContext(
  hour: number,
  health: HealthReport,
  aggregated: AggregatedMetrics,
  firingAlerts: Alert[]
): string {
  const timeStr = `${hour.toString().padStart(2, '0')}:00 KST`;

  let ctx = `[Monitoring Report - ${timeStr}]\n`;
  ctx += `System Health: ${health.score}/100 (${health.grade})\n`;
  ctx += `Scrape: node-exporter | ${aggregated.statusCounts.total} targets, ${aggregated.statusCounts.online} UP\n\n`;

  if (firingAlerts.length > 0) {
    ctx += `Active Alerts (${firingAlerts.length}):\n`;
    const sorted = [...firingAlerts].sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return b.value - a.value;
    });
    for (const alert of sorted.slice(0, 5)) {
      ctx += `- ${alert.instance} ${alert.metric}=${alert.value}% [${alert.severity.toUpperCase()}]\n`;
    }
    ctx += '\n';
  }

  ctx += 'By Type: ';
  ctx += aggregated.byServerType
    .map((t) => `${t.serverType}(${t.count}) avg CPU ${t.avgCpu}%`)
    .join(' | ');
  ctx += '\n';

  if (aggregated.topCpu.length > 0) {
    ctx += 'Top CPU: ';
    ctx += aggregated.topCpu
      .slice(0, 3)
      .map((t) => `${t.instance}(${t.value}%)`)
      .join(', ');
    ctx += '\n';
  }

  return ctx;
}
