import type {
  CompactContext,
  PrecomputedSlot,
  ServerAlert,
  SystemRulesThresholds,
} from './precomputed-state.types';
import type { GeneratedLog } from './log-generator';

type RelativeState = PrecomputedSlot & {
  fullTimestamp: string;
  dateLabel: string;
  isYesterday: boolean;
};

let trendCache: { result: string; timestamp: number } | null = null;
const TREND_CACHE_TTL_MS = 60_000;

export function buildCompactContext(
  state: RelativeState,
  thresholds: SystemRulesThresholds
): CompactContext {
  const critical = state.alerts
    .filter((alert) => alert.severity === 'critical')
    .slice(0, 3)
    .map((alert) => ({
      server: alert.serverId,
      issue: `${alert.metric.toUpperCase()} ${alert.value}%${
        alert.trend === 'up' ? '↑' : alert.trend === 'down' ? '↓' : ''
      }`,
    }));

  const warning = state.alerts
    .filter((alert) => alert.severity === 'warning')
    .slice(0, 3)
    .map((alert) => ({
      server: alert.serverId,
      issue: `${alert.metric.toUpperCase()} ${alert.value}%`,
    }));

  const patterns = state.activePatterns.map(
    (pattern) =>
      `${pattern.metric.toUpperCase()} ${pattern.pattern} (${pattern.severity})`
  );

  const serverRoles = state.servers.map((server) => ({
    id: server.id,
    name: server.name,
    type: server.type,
  }));

  return {
    date: state.dateLabel,
    time: state.timeLabel,
    timestamp: state.fullTimestamp,
    summary: `${state.summary.total}서버: ${state.summary.healthy} healthy, ${state.summary.warning} warning, ${state.summary.critical} critical${
      state.summary.offline ? `, ${state.summary.offline} offline` : ''
    }`,
    critical,
    warning,
    patterns,
    thresholds: {
      cpu: {
        warning: thresholds.cpu.warning,
        critical: thresholds.cpu.critical,
      },
      memory: {
        warning: thresholds.memory.warning,
        critical: thresholds.memory.critical,
      },
      disk: {
        warning: thresholds.disk.warning,
        critical: thresholds.disk.critical,
      },
      network: {
        warning: thresholds.network.warning,
        critical: thresholds.network.critical,
      },
    },
    serverRoles,
  };
}

export function formatTextSummary(ctx: CompactContext): string {
  let text = `[${ctx.date} ${ctx.time}] ${ctx.summary}`;

  if (ctx.critical.length > 0) {
    text += `\nCritical: ${ctx.critical
      .map((critical) => `${critical.server}(${critical.issue})`)
      .join(', ')}`;
  }
  if (ctx.warning.length > 0) {
    text += `\nWarning: ${ctx.warning
      .map((warning) => `${warning.server}(${warning.issue})`)
      .join(', ')}`;
  }

  return text;
}

export function buildTrendLLMContext(slots: PrecomputedSlot[]): string {
  if (slots.length === 0) return '';

  const now = Date.now();
  if (trendCache && now - trendCache.timestamp < TREND_CACHE_TTL_MS) {
    return trendCache.result;
  }

  const serverTrends = new Map<
    string,
    { type: string; cpu: number[]; memory: number[]; disk: number[] }
  >();
  for (const slot of slots) {
    for (const server of slot.servers) {
      if (!serverTrends.has(server.id)) {
        serverTrends.set(server.id, {
          type: server.type,
          cpu: [],
          memory: [],
          disk: [],
        });
      }
      const trend = serverTrends.get(server.id);
      if (!trend) continue;
      trend.cpu.push(server.cpu);
      trend.memory.push(server.memory);
      trend.disk.push(server.disk);
    }
  }

  const avg = (values: number[]) =>
    values.length
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) /
        10
      : 0;
  const max = (values: number[]) =>
    values.length ? Math.round(Math.max(...values) * 10) / 10 : 0;

  let context = '## 24시간 서버 트렌드 요약\n';
  for (const [serverId, metrics] of serverTrends) {
    context += `- ${serverId} (${metrics.type}): CPU avg ${avg(
      metrics.cpu
    )}%/max ${max(metrics.cpu)}%, Mem avg ${avg(metrics.memory)}%/max ${max(
      metrics.memory
    )}%, Disk avg ${avg(metrics.disk)}%/max ${max(metrics.disk)}%\n`;
  }

  trendCache = { result: context, timestamp: now };
  return context;
}

export function buildLLMContext(
  state: RelativeState,
  slots: PrecomputedSlot[],
  thresholds: SystemRulesThresholds
): string {
  const { summary, alerts, dateLabel, timeLabel } = state;

  let context = `## 현재 서버 상태 [${dateLabel} ${timeLabel} KST]\n`;
  context += `총 ${summary.total}대: ✓${summary.healthy}정상 ⚠${summary.warning}경고 ✗${summary.critical}위험${
    summary.offline ? ` ⛔${summary.offline}오프라인` : ''
  }\n`;
  context += `임계값: CPU ${thresholds.cpu.warning}%/${thresholds.cpu.critical}%, Memory ${thresholds.memory.warning}%/${thresholds.memory.critical}%, Disk ${thresholds.disk.warning}%/${thresholds.disk.critical}%\n\n`;

  const typeGroups = new Map<
    string,
    { total: number; warning: number; critical: number; offline: number }
  >();
  for (const server of state.servers) {
    const group = typeGroups.get(server.type) ?? {
      total: 0,
      warning: 0,
      critical: 0,
      offline: 0,
    };
    group.total++;
    if (server.status === 'warning') group.warning++;
    if (server.status === 'critical') group.critical++;
    if (server.status === 'offline') group.offline++;
    typeGroups.set(server.type, group);
  }

  context += '### 서버 역할별 현황\n';
  for (const [type, group] of typeGroups) {
    const statusNote =
      group.offline > 0
        ? ` (⛔${group.offline})`
        : group.critical > 0
          ? ` (✗${group.critical})`
          : group.warning > 0
            ? ` (⚠${group.warning})`
            : '';
    context += `- ${type}: ${group.total}대${statusNote}\n`;
  }
  context += '\n';

  const criticalAlerts = alerts.filter((alert) => alert.severity === 'critical');
  if (criticalAlerts.length > 0) {
    context += '### Critical 알림\n';
    for (const alert of criticalAlerts.slice(0, 5)) {
      const trend =
        alert.trend === 'up' ? '↑' : alert.trend === 'down' ? '↓' : '';
      context += `- ${alert.serverId}: ${alert.metric.toUpperCase()} ${
        alert.value
      }%${trend}\n`;
    }
    context += '\n';
  }

  const warningAlerts = alerts.filter((alert) => alert.severity === 'warning');
  if (warningAlerts.length > 0) {
    context += '### Warning 알림\n';
    for (const alert of warningAlerts.slice(0, 5)) {
      context += `- ${alert.serverId}: ${alert.metric.toUpperCase()} ${alert.value}%\n`;
    }
    context += '\n';
  }

  if (state.serverLogs) {
    const errorLogs: Array<{ serverId: string; log: GeneratedLog }> = [];
    for (const [sid, logs] of Object.entries(state.serverLogs)) {
      for (const log of logs) {
        if (log.level === 'error') {
          errorLogs.push({ serverId: sid, log });
        }
      }
    }
    if (errorLogs.length > 0) {
      context += `### 에러 로그 (상위 ${Math.min(errorLogs.length, 5)}건)\n`;
      for (const entry of errorLogs.slice(0, 5)) {
        context += `- ${entry.serverId} [${entry.log.source}]: ${entry.log.message}\n`;
      }
      context += '\n';
    }
  }

  const highLoadServers = state.servers.filter(
    (server) =>
      server.load1 !== undefined &&
      server.cpuCores !== undefined &&
      server.load1 > server.cpuCores * 0.7
  );
  if (highLoadServers.length > 0) {
    context += '\n### Load Average (높은 부하)\n';
    for (const server of highLoadServers.slice(0, 5)) {
      const loadRatio = server.cpuCores
        ? ((server.load1! / server.cpuCores) * 100).toFixed(0)
        : '-';
      context += `- ${server.id}: ${server.load1?.toFixed(2)}/${server.cpuCores}cores (${loadRatio}%)\n`;
    }
  }

  const now = Date.now() / 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;
  const recentlyRestarted = state.servers.filter(
    (server) =>
      server.bootTimeSeconds !== undefined &&
      server.bootTimeSeconds > sevenDaysAgo
  );
  if (recentlyRestarted.length > 0) {
    context += '\n### 최근 재시작 (7일 이내)\n';
    for (const server of recentlyRestarted.slice(0, 5)) {
      const uptimeDays = ((now - server.bootTimeSeconds!) / 86400).toFixed(1);
      context += `- ${server.id}: ${uptimeDays}일 전 재시작\n`;
    }
  }

  const slowServers = state.servers.filter(
    (server) =>
      server.responseTimeMs !== undefined && server.responseTimeMs >= 2000
  );
  if (slowServers.length > 0) {
    context += '\n### 응답 지연 (≥2초)\n';
    for (const server of slowServers.slice(0, 5)) {
      const severity = server.responseTimeMs! >= 5000 ? '🔴' : '🟠';
      context += `- ${server.id}: ${(server.responseTimeMs! / 1000).toFixed(
        1
      )}초 ${severity}\n`;
    }
  }

  context += '\n' + buildTrendLLMContext(slots);
  return context;
}

export function buildServerLLMContext(
  state: PrecomputedSlot,
  serverId: string
): string {
  const server = state.servers.find((item) => item.id === serverId);
  const alerts = state.alerts.filter((alert) => alert.serverId === serverId);

  if (!server) {
    return `서버 ${serverId}를 찾을 수 없습니다.`;
  }

  let context = `## ${server.name} (${server.id})\n`;
  context += `상태: ${server.status.toUpperCase()}\n`;
  context += `메트릭: CPU ${server.cpu}% | Memory ${server.memory}% | Disk ${server.disk}% | Network ${server.network}%\n`;

  const extendedMetrics: string[] = [];
  if (server.load1 !== undefined && server.cpuCores) {
    extendedMetrics.push(`Load: ${server.load1.toFixed(2)}/${server.cpuCores}cores`);
  }
  if (server.bootTimeSeconds !== undefined) {
    const uptimeDays = ((Date.now() / 1000 - server.bootTimeSeconds) / 86400).toFixed(
      1
    );
    extendedMetrics.push(`Uptime: ${uptimeDays}일`);
  }
  if (server.responseTimeMs !== undefined) {
    extendedMetrics.push(`Response: ${server.responseTimeMs}ms`);
  }
  if (extendedMetrics.length > 0) {
    context += `확장: ${extendedMetrics.join(' | ')}\n`;
  }

  if (alerts.length > 0) {
    context += '\n알림:\n';
    for (const alert of alerts) {
      const trend =
        alert.trend === 'up' ? '↑' : alert.trend === 'down' ? '↓' : '';
      context += `- ${alert.metric.toUpperCase()} ${alert.value}%${trend} (임계: ${alert.threshold}%)\n`;
    }
  }

  const logs = state.serverLogs?.[serverId];
  if (logs && logs.length > 0) {
    const errorCount = logs.filter((log) => log.level === 'error').length;
    const warnCount = logs.filter((log) => log.level === 'warn').length;
    context += '\n### 최근 로그\n';
    context += `에러: ${errorCount}건, 경고: ${warnCount}건\n`;
    for (const log of logs.slice(0, 3)) {
      context += `- [${log.level.toUpperCase()}] ${log.source}: ${log.message}\n`;
    }
  }

  return context;
}

export function buildJSONContext(state: RelativeState): {
  date: string;
  time: string;
  timestamp: string;
  summary: PrecomputedSlot['summary'];
  critical: ServerAlert[];
  warning: ServerAlert[];
} {
  return {
    date: state.dateLabel,
    time: state.timeLabel,
    timestamp: state.fullTimestamp,
    summary: state.summary,
    critical: state.alerts.filter((alert) => alert.severity === 'critical'),
    warning: state.alerts
      .filter((alert) => alert.severity === 'warning')
      .slice(0, 10),
  };
}

export function clearTrendCache(): void {
  trendCache = null;
}
