interface CollectedToolResult {
  toolName: string;
  result: unknown;
}

interface ServerSnapshot {
  id: string;
  status: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  dailyTrend?: {
    cpu?: { avg?: number };
    memory?: { avg?: number };
    disk?: { avg?: number };
  };
}

interface AlertServerSnapshot {
  id: string;
  status: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  cpuTrend?: string;
  memoryTrend?: string;
  diskTrend?: string;
  dailyAvg?: {
    cpu?: number;
    memory?: number;
    disk?: number;
  };
}

interface MetricsToolPayload {
  servers: ServerSnapshot[];
  alertServers?: AlertServerSnapshot[];
}

import {
  get24hTrendSummaries,
  getCurrentState,
} from '../../../tools-ai-sdk/server-metrics/data';

const SUMMARY_QUERY_PATTERN =
  /(서버|인프라|시스템|server|system|monitoring).*(요약|현황|상태|간단히|핵심|summary|overview|tldr)|((모든|전체|all).*(서버|server))/i;

export function isDeterministicSummaryQuery(
  query: string,
  agentName: string
): boolean {
  return agentName === 'NLQ Agent' && SUMMARY_QUERY_PATTERN.test(query);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isServerSnapshot(value: unknown): value is ServerSnapshot {
  return isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string';
}

function isAlertServerSnapshot(value: unknown): value is AlertServerSnapshot {
  return isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string';
}

function getMetricsPayload(
  toolResults: CollectedToolResult[]
): MetricsToolPayload | null {
  const metricsEntry = toolResults.find(
    (entry) => entry.toolName === 'getServerMetrics' && isRecord(entry.result)
  );

  if (!metricsEntry || !isRecord(metricsEntry.result)) {
    return null;
  }

  const servers = Array.isArray(metricsEntry.result.servers)
    ? metricsEntry.result.servers.filter(isServerSnapshot)
    : [];
  const alertServers = Array.isArray(metricsEntry.result.alertServers)
    ? metricsEntry.result.alertServers.filter(isAlertServerSnapshot)
    : undefined;

  if (servers.length === 0) {
    return null;
  }

  return { servers, alertServers };
}

function roundPercent(value: number | null): string {
  return value === null ? 'N/A' : `${Math.round(value)}%`;
}

function average(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => value !== null);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function deriveAlertServers(payload: MetricsToolPayload): AlertServerSnapshot[] {
  if (payload.alertServers && payload.alertServers.length > 0) {
    return payload.alertServers;
  }

  return payload.servers
    .filter((server) =>
      ['warning', 'critical', 'offline'].includes(server.status)
    )
    .map((server) => ({
      id: server.id,
      status: server.status,
      cpu: server.cpu,
      memory: server.memory,
      disk: server.disk,
      dailyAvg: {
        cpu: toNumber(server.dailyTrend?.cpu?.avg ?? null) ?? undefined,
        memory: toNumber(server.dailyTrend?.memory?.avg ?? null) ?? undefined,
        disk: toNumber(server.dailyTrend?.disk?.avg ?? null) ?? undefined,
      },
    }));
}

function getDominantMetric(alertServer: AlertServerSnapshot): {
  metricKey: 'cpu' | 'memory' | 'disk' | 'status';
  metricLabel: string;
  metricValue: number | null;
  trendLabel: string;
} {
  const metrics = [
    { key: 'cpu', label: 'CPU', value: toNumber(alertServer.cpu) },
    { key: 'memory', label: '메모리', value: toNumber(alertServer.memory) },
    { key: 'disk', label: '디스크', value: toNumber(alertServer.disk) },
  ];

  const dominantMetric =
    metrics
      .filter(
        (
          metric
        ): metric is { key: string; label: string; value: number } =>
          metric.value !== null
      )
      .sort((left, right) => right.value - left.value)[0] ?? null;

  if (!dominantMetric) {
    return {
      metricKey: 'status',
      metricLabel: '상태',
      metricValue: null,
      trendLabel: 'stable',
    };
  }

  if (dominantMetric.key === 'cpu') {
    return {
      metricKey: 'cpu',
      metricLabel: dominantMetric.label,
      metricValue: dominantMetric.value,
      trendLabel: alertServer.cpuTrend ?? 'stable',
    };
  }

  if (dominantMetric.key === 'memory') {
    return {
      metricKey: 'memory',
      metricLabel: dominantMetric.label,
      metricValue: dominantMetric.value,
      trendLabel: alertServer.memoryTrend ?? 'stable',
    };
  }

  return {
    metricKey: 'disk',
    metricLabel: dominantMetric.label,
    metricValue: dominantMetric.value,
    trendLabel: alertServer.diskTrend ?? 'stable',
  };
}

function formatTrendLabel(trendLabel: string): string {
  if (trendLabel === 'rising') return '상승 추세 ↑';
  if (trendLabel === 'falling') return '하락 추세 ↓';
  return '안정 추세 →';
}

function buildRecommendation(alertServers: AlertServerSnapshot[]): string {
  const primaryAlert = alertServers.find((server) => server.status !== 'offline');

  if (alertServers.some((server) => server.status === 'offline')) {
    const offlineServer = alertServers.find((server) => server.status === 'offline');
    return `• ${offlineServer?.id ?? '오프라인 서버'}: 헬스체크, 최근 배포 이력, 애플리케이션 로그를 우선 확인하세요.`;
  }

  if (!primaryAlert) {
    return '• 현재 즉시 조치는 불필요하지만 CPU/메모리 상위 서버 1~2대를 계속 관찰하세요.';
  }

  const dominantMetric = getDominantMetric(primaryAlert);

  if (dominantMetric.metricLabel === 'CPU') {
    if (primaryAlert.status === 'critical') {
      return `• ${primaryAlert.id}: 최근 15분 상위 프로세스, 직전 배포/배치, LB 트래픽 급증 여부를 우선 확인하세요.`;
    }
    return `• ${primaryAlert.id}: 상위 프로세스와 예약 작업을 확인하고, 10분 이상 같은 추세가 이어지면 요청 분산을 검토하세요.`;
  }

  if (dominantMetric.metricLabel === '메모리') {
    return `• ${primaryAlert.id}: 메모리 상위 프로세스, OOM/GC 로그, cache eviction 또는 누수 징후를 우선 확인하세요.`;
  }

  if (dominantMetric.metricLabel === '디스크') {
    return `• ${primaryAlert.id}: 로그 적체, 백업 산출물, tmp 디렉터리 증가 경로를 우선 점검하세요.`;
  }

  return `• ${primaryAlert.id}: 최근 상태 변화 원인과 관련 로그를 점검하세요.`;
}

function buildTrendSummary(alertServers: AlertServerSnapshot[]): string {
  const notableTrendServers = alertServers
    .map((alertServer) => {
      const dominantMetric = getDominantMetric(alertServer);
      const dailyAvg =
        dominantMetric.metricKey === 'cpu'
          ? toNumber(alertServer.dailyAvg?.cpu ?? null)
          : dominantMetric.metricKey === 'memory'
            ? toNumber(alertServer.dailyAvg?.memory ?? null)
            : dominantMetric.metricKey === 'disk'
              ? toNumber(alertServer.dailyAvg?.disk ?? null)
              : null;

      return {
        id: alertServer.id,
        dominantMetric,
        dailyAvg,
      };
    })
    .filter(
      (entry) =>
        entry.dominantMetric.trendLabel !== 'stable' &&
        entry.dominantMetric.metricValue !== null
    )
    .sort((left, right) => {
      const leftDelta =
        left.dailyAvg === null || left.dominantMetric.metricValue === null
          ? 0
          : Math.abs(left.dominantMetric.metricValue - left.dailyAvg);
      const rightDelta =
        right.dailyAvg === null || right.dominantMetric.metricValue === null
          ? 0
          : Math.abs(right.dominantMetric.metricValue - right.dailyAvg);
      return rightDelta - leftDelta;
    })
    .slice(0, 2);

  if (notableTrendServers.length === 0) {
    return '• 전체 서버는 평균 대비 큰 변동 없이 안정적입니다.';
  }

  return notableTrendServers
    .map((entry) => {
      if (entry.dailyAvg === null || entry.dominantMetric.metricValue === null) {
        return `• ${entry.id}: ${entry.dominantMetric.metricLabel} ${roundPercent(entry.dominantMetric.metricValue)} (${formatTrendLabel(entry.dominantMetric.trendLabel)})`;
      }

      const delta = Math.round(entry.dominantMetric.metricValue - entry.dailyAvg);
      const signedDelta = delta > 0 ? `+${delta}` : `${delta}`;
      return `• ${entry.id}: ${entry.dominantMetric.metricLabel} 평균 ${roundPercent(entry.dailyAvg)} → 현재 ${roundPercent(entry.dominantMetric.metricValue)} (${signedDelta}%p, ${formatTrendLabel(entry.dominantMetric.trendLabel)})`;
    })
    .join('\n');
}

function buildSummaryFromPayload(payload: MetricsToolPayload): string {
  const totalServers = payload.servers.length;
  const onlineCount = payload.servers.filter(
    (server) => server.status === 'online'
  ).length;
  const warningCount = payload.servers.filter(
    (server) => server.status === 'warning'
  ).length;
  const criticalCount = payload.servers.filter(
    (server) => server.status === 'critical'
  ).length;
  const offlineCount = payload.servers.filter(
    (server) => server.status === 'offline'
  ).length;
  const activeServers = payload.servers.filter(
    (server) => server.status !== 'offline'
  );

  const averageCpu = average(
    activeServers.map((server) => toNumber(server.cpu))
  );
  const averageMemory = average(
    activeServers.map((server) => toNumber(server.memory))
  );
  const averageDisk = average(
    activeServers.map((server) => toNumber(server.disk))
  );

  const alertServers = deriveAlertServers(payload);
  const offlineServers = alertServers
    .filter((server) => server.status === 'offline')
    .slice(0, 2);
  const activeAlerts = alertServers
    .filter((server) => server.status !== 'offline')
    .sort((left, right) => {
      const leftPriority =
        left.status === 'critical' ? 0 : left.status === 'warning' ? 1 : 2;
      const rightPriority =
        right.status === 'critical' ? 0 : right.status === 'warning' ? 1 : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftMetric = getDominantMetric(left).metricValue ?? 0;
      const rightMetric = getDominantMetric(right).metricValue ?? 0;
      return rightMetric - leftMetric;
    })
    .slice(0, 3);

  const lines = [
    '📊 **서버 현황 요약**',
    `• 전체 ${totalServers}대: 정상 ${onlineCount}대, 경고 ${warningCount}대, 비상 ${criticalCount}대, 오프라인 ${offlineCount}대`,
    `• 평균 CPU: ${roundPercent(averageCpu)}, 메모리: ${roundPercent(averageMemory)}, 디스크: ${roundPercent(averageDisk)}`,
  ];

  if (offlineServers.length > 0) {
    lines.push('', '⛔ **오프라인 서버**');
    for (const offlineServer of offlineServers) {
      lines.push(`• ${offlineServer.id}: 헬스체크 실패 또는 서비스 중단 상태`);
    }
  }

  lines.push('', '⚠️ **주의 서버**');
  if (activeAlerts.length === 0) {
    lines.push('• 현재 warning/critical 서버는 없습니다.');
  } else {
    for (const alertServer of activeAlerts) {
      const dominantMetric = getDominantMetric(alertServer);
      lines.push(
        `• ${alertServer.id}: ${dominantMetric.metricLabel} ${roundPercent(dominantMetric.metricValue)} (${formatTrendLabel(dominantMetric.trendLabel)})`
      );
    }
  }

  lines.push('', '📈 **추세**', buildTrendSummary(alertServers), '', '💡 **권고**');
  lines.push(buildRecommendation(alertServers));

  return lines.join('\n');
}

function buildSummaryPayloadFromCurrentState(): MetricsToolPayload | null {
  const state = getCurrentState();
  if (!state?.servers || state.servers.length === 0) {
    return null;
  }

  const trendMap = new Map(
    get24hTrendSummaries().map((trend) => [trend.serverId, trend])
  );

  const servers: ServerSnapshot[] = state.servers.map((server) => {
    const trend = trendMap.get(server.id);
    return {
      id: server.id,
      status: server.status,
      cpu: server.cpu,
      memory: server.memory,
      disk: server.disk,
      ...(trend && {
        dailyTrend: {
          cpu: trend.cpu,
          memory: trend.memory,
          disk: trend.disk,
        },
      }),
    };
  });

  const alertServers: AlertServerSnapshot[] = servers
    .filter((server) =>
      ['warning', 'critical', 'offline'].includes(server.status)
    )
    .map((server) => {
      const trend = trendMap.get(server.id);
      const cpu = toNumber(server.cpu);
      const memory = toNumber(server.memory);

      const cpuTrend =
        cpu !== null && trend
          ? cpu > trend.cpu.avg * 1.1
            ? 'rising'
            : cpu < trend.cpu.avg * 0.9
              ? 'falling'
              : 'stable'
          : 'stable';

      const memoryTrend =
        memory !== null && trend
          ? memory > trend.memory.avg * 1.1
            ? 'rising'
            : memory < trend.memory.avg * 0.9
              ? 'falling'
            : 'stable'
          : 'stable';
      const disk = toNumber(server.disk);
      const diskTrend =
        disk !== null && trend
          ? disk > trend.disk.avg * 1.1
            ? 'rising'
            : disk < trend.disk.avg * 0.9
              ? 'falling'
              : 'stable'
          : 'stable';

      return {
        id: server.id,
        status: server.status,
        cpu: server.cpu,
        memory: server.memory,
        disk: server.disk,
        cpuTrend,
        memoryTrend,
        diskTrend,
        ...(trend && {
          dailyAvg: {
            cpu: trend.cpu.avg,
            memory: trend.memory.avg,
            disk: trend.disk.avg,
          },
        }),
      };
    });

  return {
    servers,
    ...(alertServers.length > 0 && { alertServers }),
  };
}

// Deterministic fallback avoids another LLM call when metrics data is already available.
export function buildDeterministicSummaryFallback(
  query: string,
  agentName: string,
  toolResults: CollectedToolResult[]
): string | null {
  if (!isDeterministicSummaryQuery(query, agentName)) {
    return null;
  }

  const payload = getMetricsPayload(toolResults);
  if (!payload) {
    return null;
  }

  return buildSummaryFromPayload(payload);
}

// Final fallback for summary prompts when model emits no text and skips all tool calls.
export function buildDeterministicSummaryFromCurrentState(
  query: string,
  agentName: string
): string | null {
  if (!isDeterministicSummaryQuery(query, agentName)) {
    return null;
  }

  const payload = buildSummaryPayloadFromCurrentState();
  if (!payload) {
    return null;
  }

  return buildSummaryFromPayload(payload);
}
