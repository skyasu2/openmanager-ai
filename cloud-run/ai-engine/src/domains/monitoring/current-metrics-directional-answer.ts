import type { DomainSnapshot } from '../../core/assistant-runtime';
import { normalizeServerType } from '../../tools-ai-sdk/server-metrics/data';
import type { QueryOperator } from '../../services/ai-sdk/agents/orchestrator-query-intent';
import type {
  MetricCondition,
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
} from './current-metrics-evidence-request';

type SnapshotServer = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readSnapshotTimeLabel(snapshot: DomainSnapshot): string | undefined {
  return isRecord(snapshot.data) ? readString(snapshot.data.timeLabel) : undefined;
}

function readSnapshotServers(snapshot: DomainSnapshot): SnapshotServer[] {
  const servers = isRecord(snapshot.data) ? snapshot.data.servers : undefined;
  if (!Array.isArray(servers)) return [];

  return servers.filter((server): server is SnapshotServer => {
    return isRecord(server) && typeof server.id === 'string';
  });
}

function getMetricLabel(metric: SupportedMetric): string {
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

function getMetricValue(
  server: SnapshotServer,
  metric: SupportedMetric
): number | null {
  const value = server[metric];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatMetricPercent(value: number): string {
  return `${Math.round(value * 10) / 10}%`;
}

function formatServerStatus(server: SnapshotServer): string {
  return server.status ?? 'unknown';
}

function compareMetricValue(
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

function getThresholdOperatorSymbol(
  operator: QueryOperator | undefined
): string {
  return operator ?? '>=';
}

function getServerTypeKoreanLabel(type: string): string {
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

function inferTargetType(targets: string[]): string | null {
  for (const target of targets) {
    const normalized = normalizeServerType(target);
    if (normalized !== 'unknown') return normalized;
  }
  return null;
}

function filterSnapshotServers(
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

function buildNumberedServerSection(title: string, rows: string[]): string[] {
  return ['', `📌 **${title}**`, ...rows.map((row, index) => `${index + 1}. ${row}`)];
}

function scoreDirectionalCondition(
  condition: MetricCondition,
  value: number
): number {
  return condition.operator === '<' || condition.operator === '<='
    ? 100 - value
    : value;
}

function formatMetricCondition(condition: MetricCondition): string {
  return `${getMetricLabel(condition.metric)} ${getThresholdOperatorSymbol(condition.operator)} ${condition.threshold}%`;
}

export function buildDirectionalMultiMetricFilterAnswer(params: {
  metricConditions: MetricCondition[];
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const rows = servers
    .map((server) => {
      const values = params.metricConditions.map((condition) => ({
        condition,
        value: getMetricValue(server, condition.metric),
      }));
      if (values.some((entry) => entry.value === null)) return null;

      const numericValues = values as Array<{
        condition: MetricCondition;
        value: number;
      }>;
      const matches = numericValues.every((entry) =>
        compareMetricValue(
          entry.value,
          entry.condition.operator,
          entry.condition.threshold
        )
      );
      if (!matches) return null;

      return {
        server,
        values: numericValues,
        score: numericValues.reduce(
          (sum, entry) =>
            sum + scoreDirectionalCondition(entry.condition, entry.value),
          0
        ),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.score - left.score);

  const conditionJoiner = params.parsed.filterOperator === 'OR' ? ' OR ' : ' AND ';
  const conditionText = params.metricConditions
    .map(formatMetricCondition)
    .join(conditionJoiner);
  const metricLabels = params.metricConditions
    .map((condition) => getMetricLabel(condition.metric))
    .join(' + ');
  const timeLabel = readSnapshotTimeLabel(params.snapshot);

  if (rows.length === 0) {
    return [
      `📊 **${metricLabels} 조건 서버**`,
      `• 조건: ${conditionText}`,
      `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      '• 결과: 현재 조건을 동시에 만족하는 서버는 없습니다.',
    ].join('\n');
  }

  return [
    `📊 **${metricLabels} 조건 서버**`,
    `• 조건: ${conditionText}`,
    `• 대상: ${targetLabel} 중 ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    ...buildNumberedServerSection(
      '서버별 현황',
      rows.map((row) => {
        const metricText = row.values
          .map(
            (entry) =>
              `${getMetricLabel(entry.condition.metric)} ${formatMetricPercent(entry.value)}`
          )
          .join(', ');
        return `**${row.server.id}**: ${metricText} (상태 ${formatServerStatus(row.server)})`;
      })
    ),
  ].join('\n');
}
