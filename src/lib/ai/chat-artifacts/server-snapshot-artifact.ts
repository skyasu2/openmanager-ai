import type {
  ApiServerMetrics,
  SystemSummary,
} from '@/services/metrics/MetricsProvider';
import { metricsProvider } from '@/services/metrics/MetricsProvider';
import type { JobDataSlot } from '@/types/ai-jobs';
import type { ChatArtifactRequest, ServerSnapshotArtifact } from './types';

const SNAPSHOT_METRICS = ['cpu', 'memory', 'disk', 'network'] as const;

type SnapshotMetric = (typeof SNAPSHOT_METRICS)[number];

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatTimeLabel(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;

  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} KST`;
}

function createSlot(
  summary: SystemSummary,
  preferredSlot?: JobDataSlot
): JobDataSlot {
  if (preferredSlot) return preferredSlot;

  const minuteOfDay = summary.minuteOfDay;

  return {
    slotIndex: Math.floor(minuteOfDay / 10),
    minuteOfDay,
    timeLabel: formatTimeLabel(minuteOfDay),
  };
}

function readPrimaryRisk(server: ApiServerMetrics): SnapshotMetric {
  return SNAPSHOT_METRICS.reduce((selected, metric) =>
    server[metric] > server[selected] ? metric : selected
  );
}

function buildSummary(summary: SystemSummary): string {
  const riskServers = summary.criticalServers + summary.offlineServers;

  return `${summary.totalServers}대 서버 중 위험 ${riskServers}대, 주의 ${summary.warningServers}대, 정상 ${summary.onlineServers}대입니다.`;
}

function buildTopServers(
  servers: ApiServerMetrics[]
): ServerSnapshotArtifact['topServers'] {
  return [...servers]
    .sort(
      (left, right) =>
        right[readPrimaryRisk(right)] - left[readPrimaryRisk(left)]
    )
    .slice(0, 3)
    .map((server) => ({
      id: server.serverId,
      name: server.hostname || server.serverId,
      status: server.status,
      cpu: roundMetric(server.cpu),
      memory: roundMetric(server.memory),
      disk: roundMetric(server.disk),
      network: roundMetric(server.network),
      primaryRisk: readPrimaryRisk(server),
    }));
}

function buildAlerts(
  servers: ApiServerMetrics[]
): ServerSnapshotArtifact['alerts'] {
  return servers
    .filter(
      (server) => server.status === 'warning' || server.status === 'critical'
    )
    .map((server) => {
      const metric = readPrimaryRisk(server);
      const value = roundMetric(server[metric]);
      const severity: 'warning' | 'critical' =
        server.status === 'critical' ? 'critical' : 'warning';

      return {
        serverId: server.serverId,
        metric,
        value,
        severity,
        summary: `${server.serverId} ${metric.toUpperCase()} ${value}%`,
      };
    })
    .sort((left, right) => {
      const severityDelta =
        (right.severity === 'critical' ? 1 : 0) -
        (left.severity === 'critical' ? 1 : 0);
      if (severityDelta !== 0) return severityDelta;

      return right.value - left.value;
    });
}

export function readServerSnapshotTimeLabel(
  artifact: ServerSnapshotArtifact
): string {
  return (
    artifact.slot?.timeLabel || artifact.queryAsOfDataSlot?.timeLabel || '현재'
  );
}

export function readServerSnapshotTopServers(
  artifact: ServerSnapshotArtifact
): ServerSnapshotArtifact['topServers'] {
  return Array.isArray(artifact.topServers) ? artifact.topServers : [];
}

export function readServerSnapshotAlerts(
  artifact: ServerSnapshotArtifact
): ServerSnapshotArtifact['alerts'] {
  return Array.isArray(artifact.alerts) ? artifact.alerts : [];
}

export async function generateServerSnapshotArtifact({
  queryAsOfDataSlot,
  signal,
}: ChatArtifactRequest): Promise<ServerSnapshotArtifact> {
  signal?.throwIfAborted();

  const [servers, summary] = await Promise.all([
    metricsProvider.getAllServerMetrics(),
    metricsProvider.getSystemSummary(),
  ]);

  signal?.throwIfAborted();

  const slot = createSlot(summary, queryAsOfDataSlot);

  return {
    kind: 'server-snapshot',
    generatedAt: new Date().toISOString(),
    title: '현재 서버 상태 스냅샷',
    summary: buildSummary(summary),
    source: 'otel-static',
    queryAsOfDataSlot,
    slot,
    totals: {
      total: summary.totalServers,
      online: summary.onlineServers,
      warning: summary.warningServers,
      critical: summary.criticalServers,
      offline: summary.offlineServers,
    },
    averages: {
      cpu: summary.averageCpu,
      memory: summary.averageMemory,
      disk: summary.averageDisk,
      network: summary.averageNetwork,
    },
    topServers: buildTopServers(servers),
    alerts: buildAlerts(servers),
  };
}

export function buildServerSnapshotMarkdown(
  artifact: ServerSnapshotArtifact
): string {
  const topServerRows = readServerSnapshotTopServers(artifact);
  const alertRows = readServerSnapshotAlerts(artifact);
  const topServers = topServerRows.length
    ? topServerRows
        .map((server, index) => {
          const primaryRisk = server.primaryRisk ?? 'cpu';
          const primaryRiskLabel = primaryRisk.toUpperCase();
          return [
            `${index + 1}. ${server.name || server.id} (${server.status})`,
            `${primaryRiskLabel} ${server[primaryRisk]}%`,
          ].join(' - ');
        })
        .join('\n')
    : '위험 상위 서버 없음';
  const alerts = alertRows.length
    ? alertRows
        .map((alert) => `- [${alert.severity}] ${alert.summary}`)
        .join('\n')
    : '- 현재 표시할 경고 없음';

  return [
    `# ${artifact.title}`,
    '',
    `- 생성 시각: ${new Date(artifact.generatedAt).toLocaleString('ko-KR')}`,
    `- 기준 시각: ${readServerSnapshotTimeLabel(artifact)}`,
    `- 총 서버: ${artifact.totals.total}대`,
    `- 정상: ${artifact.totals.online}대`,
    `- 주의: ${artifact.totals.warning}대`,
    `- 위험: ${artifact.totals.critical}대`,
    `- 오프라인: ${artifact.totals.offline}대`,
    '',
    '## 평균 사용률',
    '',
    `- CPU: ${artifact.averages.cpu}%`,
    `- Memory: ${artifact.averages.memory}%`,
    `- Disk: ${artifact.averages.disk}%`,
    `- Network: ${artifact.averages.network}%`,
    '',
    '## 위험 상위 서버',
    '',
    topServers,
    '',
    '## 주요 알림',
    '',
    alerts,
    '',
    artifact.summary,
  ].join('\n');
}

export function buildServerSnapshotJson(
  artifact: ServerSnapshotArtifact
): string {
  return JSON.stringify(artifact, null, 2);
}
