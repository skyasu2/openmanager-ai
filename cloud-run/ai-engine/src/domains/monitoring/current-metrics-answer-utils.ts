import type { QueryOperator } from '../../services/ai-sdk/agents/orchestrator-query-intent';
import { normalizeServerType } from '../../tools-ai-sdk/server-metrics/data';
import type {
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
} from './current-metrics-evidence-request';
import type { SnapshotServer } from './snapshot-utils';

export function compareMetricValue(
  value: number,
  operator: QueryOperator | undefined,
  threshold: number
): boolean {
  switch (operator) {
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '<=':
      return value <= threshold;
    case '>=':
    case undefined:
      return value >= threshold;
    case '==':
      return value === threshold;
    case '!=':
      return value !== threshold;
  }
}

export function getThresholdOperatorLabel(
  operator: QueryOperator | undefined
): string {
  switch (operator) {
    case '>':
      return '초과';
    case '<':
      return '미만';
    case '<=':
      return '이하';
    case '==':
      return '동일';
    case '!=':
      return '제외';
    case '>=':
    case undefined:
      return '이상';
  }
}

export function getThresholdOperatorSymbol(
  operator: QueryOperator | undefined
): string {
  return operator ?? '>=';
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getMetricLabel(metric: SupportedMetric): string {
  switch (metric) {
    case 'cpu':
      return 'CPU';
    case 'memory':
      return '메모리';
    case 'disk':
      return '디스크';
    case 'network':
      return '네트워크';
  }
}

export function getMetricValue(
  server: SnapshotServer,
  metric: SupportedMetric
): number | null {
  const value = server[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function inferTargetType(targets: string[]): string | null {
  for (const target of targets) {
    const normalized = normalizeServerType(target);
    if (normalized !== 'unknown') return normalized;
  }
  return null;
}

export function getServerTypeKoreanLabel(type: string): string {
  switch (normalizeServerType(type)) {
    case 'cache':
      return '캐시 서버';
    case 'database':
      return 'DB 서버';
    case 'loadbalancer':
      return '로드밸런서';
    case 'storage':
      return '스토리지 서버';
    case 'web':
      return '웹 서버';
    case 'application':
      return '애플리케이션 서버';
    default:
      return '서버';
  }
}

export function filterSnapshotServers(
  servers: SnapshotServer[],
  targets: string[] | undefined
): { servers: SnapshotServer[]; targetLabel: string } {
  const normalizedTargets = targets ?? [];
  if (normalizedTargets.length === 0) {
    return { servers, targetLabel: '전체 서버' };
  }

  const targetIds = new Set(
    normalizedTargets.map((target) => target.toLowerCase())
  );
  const exactMatches = servers.filter((server) =>
    targetIds.has(server.id.toLowerCase())
  );
  if (exactMatches.length > 0) {
    const uniqueTypes = Array.from(
      new Set(
        exactMatches.map((server) => normalizeServerType(server.type ?? ''))
      )
    ).filter((type) => type !== 'unknown');
    return {
      servers: exactMatches,
      targetLabel:
        uniqueTypes.length === 1
          ? `${getServerTypeKoreanLabel(uniqueTypes[0])} ${exactMatches.length}대`
          : `지정 서버 ${exactMatches.length}대`,
    };
  }

  const targetType = inferTargetType(normalizedTargets);
  if (targetType) {
    const groupMatches = servers.filter(
      (server) => normalizeServerType(server.type ?? '') === targetType
    );
    if (groupMatches.length > 0) {
      return {
        servers: groupMatches,
        targetLabel: `${getServerTypeKoreanLabel(targetType)} ${groupMatches.length}대`,
      };
    }
  }

  const substringMatches = servers.filter((server) =>
    normalizedTargets.some((target) =>
      server.id.toLowerCase().includes(target.toLowerCase())
    )
  );
  if (substringMatches.length > 0) {
    return {
      servers: substringMatches,
      targetLabel: `${substringMatches.length}대`,
    };
  }

  return { servers: [], targetLabel: '지정 서버 0대' };
}

export function removeTargetCountSuffix(label: string): string {
  return label.replace(/\s+\d+대$/, '');
}

export function formatMetricPercent(value: number): string {
  return `${round1(value)}%`;
}

export function formatServerStatus(server: SnapshotServer): string {
  return server.status ?? 'unknown';
}

export function buildNumberedServerSection(
  title: string,
  rows: string[]
): string[] {
  return [
    '',
    `📌 **${title}**`,
    ...rows.map((row, index) => `${index + 1}. ${row}`),
  ];
}

export function formatServerMetricLine(
  server: SnapshotServer,
  metricLabel: string,
  value: number
): string {
  return `**${server.id}**: ${metricLabel} ${formatMetricPercent(value)} (상태 ${formatServerStatus(server)})`;
}

export function formatTrendDirection(delta: number): string {
  if (delta > 3) return '상승';
  if (delta < -3) return '하락';
  return '안정';
}

export function matchesTrendDirection(
  delta: number,
  direction: ParsedCurrentMetricsEvidenceRequest['trendDirection']
): boolean {
  if (direction === 'increase') return delta > 3;
  if (direction === 'decrease') return delta < -3;
  return true;
}

export function normalizeRankCount(value: number | undefined): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? Math.min(value, 10)
    : 3;
}
