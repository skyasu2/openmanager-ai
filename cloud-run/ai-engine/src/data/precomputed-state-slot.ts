import type { OTelLogRecord } from '../types/otel-metrics';
import { generateLogs, type GeneratedLog } from './log-generator';
import type {
  ActivePattern,
  PrecomputedSlot,
  ServerAlert,
  ServerSnapshot,
  ServerStatus,
  SystemRulesThresholds,
  TrendDirection,
} from './precomputed-state.types';

export interface RawServerData {
  id: string;
  name: string;
  type: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  status?: string;
  load1?: number;
  load5?: number;
  bootTimeSeconds?: number;
  responseTimeMs?: number;
  cpuCores?: number;
}

/** Log severity priority for sorting (lower = higher priority) */
export const LOG_PRIORITY_ORDER: Readonly<Record<string, number>> = {
  error: 0,
  warn: 1,
  info: 2,
};

function determineStatus(
  server: RawServerData,
  thresholds: SystemRulesThresholds
): ServerStatus {
  const { cpu, memory, disk, network, responseTimeMs } = server;

  // 🎯 대시보드(MetricsProvider)와 동일한 Offline 판정 기준 적용:
  // CPU, Memory, Disk 메트릭이 모두 0이면 오프라인으로 간주.
  if (cpu === 0 && memory === 0 && disk === 0) {
    return 'offline';
  }

  // 각 지표별 상태 판정
  const isCritical = (val: number, threshold: number) => val >= threshold;
  const isWarning = (val: number, threshold: number) => val >= threshold;

  const statuses: Record<string, 'online' | 'warning' | 'critical'> = {
    cpu: isCritical(cpu, thresholds.cpu.critical)
      ? 'critical'
      : isWarning(cpu, thresholds.cpu.warning)
        ? 'warning'
        : 'online',
    memory: isCritical(memory, thresholds.memory.critical)
      ? 'critical'
      : isWarning(memory, thresholds.memory.warning)
        ? 'warning'
        : 'online',
    disk: isCritical(disk, thresholds.disk.critical)
      ? 'critical'
      : isWarning(disk, thresholds.disk.warning)
        ? 'warning'
        : 'online',
    network: isCritical(network, thresholds.network.critical)
      ? 'critical'
      : isWarning(network, thresholds.network.warning)
        ? 'warning'
        : 'online',
  };

  // 응답 시간 판정 (있을 경우)
  if (responseTimeMs !== undefined) {
    // 응답 시간 임계값은 system-rules.json 기준으로 warning 2000, critical 5000 (하드코딩 폴백 방지 위해 명시적 처리 권장)
    statuses.responseTime =
      responseTimeMs >= 5000
        ? 'critical'
        : responseTimeMs >= 2000
          ? 'warning'
          : 'online';
  }

  const values = Object.values(statuses);
  const criticalCount = values.filter((v) => v === 'critical').length;
  const warningCount = values.filter((v) => v === 'warning').length;

  // 🎯 system-rules.json 우선순위 기반 판정
  // P1: CPU >= critical AND Memory >= critical
  if (statuses.cpu === 'critical' && statuses.memory === 'critical') {
    return 'critical';
  }
  // P2: ANY metric >= critical
  if (criticalCount > 0) return 'critical';
  // P3: 2+ metrics >= warning
  if (warningCount >= 2) return 'warning';
  // P4: ANY metric >= warning
  if (warningCount > 0) return 'warning';

  return 'online';
}

function calculateTrend(
  current: number,
  previous: number | undefined
): TrendDirection {
  if (previous === undefined) return 'stable';
  const diff = current - previous;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
}

function generateAlerts(
  server: RawServerData,
  previousServer: RawServerData | undefined,
  thresholds: SystemRulesThresholds
): ServerAlert[] {
  const alerts: ServerAlert[] = [];
  const metrics = ['cpu', 'memory', 'disk', 'network'] as const;

  for (const metric of metrics) {
    const value = server[metric];
    const threshold = thresholds[metric];
    const prevValue = previousServer?.[metric];

    if (value >= threshold.critical) {
      alerts.push({
        serverId: server.id,
        serverName: server.name,
        serverType: server.type,
        metric,
        value,
        threshold: threshold.critical,
        trend: calculateTrend(value, prevValue),
        severity: 'critical',
      });
    } else if (value >= threshold.warning) {
      alerts.push({
        serverId: server.id,
        serverName: server.name,
        serverType: server.type,
        metric,
        value,
        threshold: threshold.warning,
        trend: calculateTrend(value, prevValue),
        severity: 'warning',
      });
    }
  }

  return alerts;
}

function detectPatterns(
  servers: ServerSnapshot[],
  thresholds: SystemRulesThresholds
): ActivePattern[] {
  const patterns: ActivePattern[] = [];
  const metrics = ['cpu', 'memory', 'disk', 'network'] as const;

  for (const metric of metrics) {
    const values = servers.map((server) => server[metric]);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);

    if (max >= thresholds[metric].critical) {
      patterns.push({
        metric,
        pattern: max - avg > 30 ? 'spike' : 'sustained',
        severity: 'critical',
      });
    } else if (max >= thresholds[metric].warning) {
      patterns.push({
        metric,
        pattern: 'gradual',
        severity: 'warning',
      });
    }
  }

  return patterns;
}

function otelLogToGeneratedLog(log: OTelLogRecord): GeneratedLog {
  return {
    level: log.severityText.toLowerCase() as GeneratedLog['level'],
    source: String(log.attributes['log.source'] ?? 'syslog'),
    message: log.body,
  };
}

export function buildSlot(
  rawServers: Record<string, RawServerData>,
  previousServers: Record<string, RawServerData>,
  slotIndex: number,
  hour: number,
  slotInHour: number,
  thresholds: SystemRulesThresholds,
  scenario: string = '',
  otelLogs?: OTelLogRecord[]
): PrecomputedSlot {
  const minuteOfDay = slotIndex * 10;
  const timeLabel = `${hour.toString().padStart(2, '0')}:${(slotInHour * 10)
    .toString()
    .padStart(2, '0')}`;

  const servers: ServerSnapshot[] = Object.values(rawServers).map((server) => ({
    id: server.id,
    name: server.name,
    type: server.type,
    status: determineStatus(server, thresholds),
    cpu: server.cpu,
    memory: server.memory,
    disk: server.disk,
    network: server.network,
    load1: server.load1,
    load5: server.load5,
    bootTimeSeconds: server.bootTimeSeconds,
    responseTimeMs: server.responseTimeMs,
    cpuCores: server.cpuCores,
  }));

  const summary = {
    total: servers.length,
    online: servers.filter((server) => server.status === 'online').length,
    warning: servers.filter((server) => server.status === 'warning').length,
    critical: servers.filter((server) => server.status === 'critical').length,
    offline: servers.filter((server) => server.status === 'offline').length,
  };

  const alerts: ServerAlert[] = [];
  for (const rawServer of Object.values(rawServers)) {
    const prevServer = previousServers[rawServer.id];
    alerts.push(...generateAlerts(rawServer, prevServer, thresholds));
  }

  const activePatterns = detectPatterns(servers, thresholds);
  const serverLogs: Record<string, GeneratedLog[]> = {};

  if (otelLogs && otelLogs.length > 0) {
    for (const log of otelLogs) {
      const serverId = log.resource;
      if (!rawServers[serverId]) continue;
      if (!serverLogs[serverId]) serverLogs[serverId] = [];
      serverLogs[serverId].push(otelLogToGeneratedLog(log));
    }

    for (const [sid, logs] of Object.entries(serverLogs)) {
      logs.sort(
        (a, b) => (LOG_PRIORITY_ORDER[a.level] ?? 2) - (LOG_PRIORITY_ORDER[b.level] ?? 2)
      );
      serverLogs[sid] = logs.slice(0, 5);
    }

    for (const raw of Object.values(rawServers)) {
      if (!serverLogs[raw.id]) serverLogs[raw.id] = [];
    }
  } else {
    for (const raw of Object.values(rawServers)) {
      const logs = generateLogs(
        { cpu: raw.cpu, memory: raw.memory, disk: raw.disk, network: raw.network },
        raw.id,
        raw.type,
        scenario
      );
      logs.sort(
        (a, b) => (LOG_PRIORITY_ORDER[a.level] ?? 2) - (LOG_PRIORITY_ORDER[b.level] ?? 2)
      );
      serverLogs[raw.id] = logs.slice(0, 5);
    }
  }

  return {
    slotIndex,
    timeLabel,
    minuteOfDay,
    summary,
    alerts,
    activePatterns,
    servers,
    serverLogs,
  };
}
