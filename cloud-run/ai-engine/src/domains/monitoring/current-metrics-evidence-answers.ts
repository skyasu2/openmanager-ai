import type { DomainSnapshot } from '../../core/assistant-runtime';
import {
  get24hTrendSummaries,
  normalizeServerType,
} from '../../tools-ai-sdk/server-metrics/data';
import type { QueryOperator } from '../../services/ai-sdk/agents/orchestrator-query-intent';
import type {
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
} from './current-metrics-evidence-provider';
import { buildMultiMetricTrendAnswer } from './current-metrics-multi-trend-answer';

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

function getThresholdOperatorLabel(
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

function getThresholdOperatorSymbol(
  operator: QueryOperator | undefined
): string {
  return operator ?? '>=';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
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

function readSnapshotServers(snapshot: DomainSnapshot): SnapshotServer[] {
  const servers = isRecord(snapshot.data) ? snapshot.data.servers : undefined;
  if (!Array.isArray(servers)) return [];

  return servers.filter((server): server is SnapshotServer => {
    return isRecord(server) && typeof server.id === 'string';
  });
}

function inferTargetType(targets: string[]): string | null {
  for (const target of targets) {
    const normalized = normalizeServerType(target);
    if (normalized !== 'unknown') return normalized;
  }
  return null;
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

  // ID substring 폴백: 'backup' 같이 server.type 매핑이 없는 경우 server.id 포함 여부로 필터
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

function removeTargetCountSuffix(label: string): string {
  return label.replace(/\s+\d+대$/, '');
}

function formatMetricPercent(value: number): string {
  return `${round1(value)}%`;
}

function formatServerStatus(server: SnapshotServer): string {
  return server.status ?? 'unknown';
}

function buildNumberedServerSection(title: string, rows: string[]): string[] {
  return ['', `📌 **${title}**`, ...rows.map((row, index) => `${index + 1}. ${row}`)];
}

function formatServerMetricLine(
  server: SnapshotServer,
  metricLabel: string,
  value: number
): string {
  return `**${server.id}**: ${metricLabel} ${formatMetricPercent(value)} (상태 ${formatServerStatus(server)})`;
}

function formatTrendDirection(delta: number): string {
  if (delta > 3) return '상승';
  if (delta < -3) return '하락';
  return '안정';
}

function normalizeRankCount(value: number | undefined): number {
  return value !== undefined && Number.isInteger(value) && value > 0
    ? Math.min(value, 10)
    : 3;
}

export function buildMetricCurrentAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.groupTargets && params.parsed.groupTargets.length >= 2) {
    return buildGroupMetricCompareAnswer(params);
  }

  if (params.parsed.metrics && params.parsed.metrics.length > 0) {
    return buildMultiMetricFilterAnswer(params);
  }

  const metric = params.parsed.metric;
  if (!metric) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const rawRows = servers
    .map((server) => ({
      server,
      value: getMetricValue(server, metric),
    }))
    .filter(
      (row): row is { server: SnapshotServer; value: number } =>
        row.value !== null
    );
  if (rawRows.length === 0) return null;

  if (params.parsed.threshold !== undefined) {
    const threshold = params.parsed.threshold;
    const operator = params.parsed.thresholdOperator;
    const rows = rawRows
      .filter((row) => compareMetricValue(row.value, operator, threshold))
      .sort((left, right) =>
        operator === '<' || operator === '<='
          ? left.value - right.value
          : right.value - left.value
      );
    const metricLabel = getMetricLabel(metric);
    const operatorLabel = getThresholdOperatorLabel(operator);
    const operatorSymbol = getThresholdOperatorSymbol(operator);
    const timeLabel = readSnapshotTimeLabel(params.snapshot);
    const title = `${removeTargetCountSuffix(targetLabel)} ${metricLabel} ${threshold}% ${operatorLabel} 서버`;

    if (rows.length === 0) {
      return [
        `📊 **${title}**`,
        `• 조건: ${metricLabel} ${operatorSymbol} ${threshold}%`,
        `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
        '• 결과: 현재 조건을 만족하는 서버는 없습니다.',
      ].join('\n');
    }

    return [
      `📊 **${title}**`,
      `• 조건: ${metricLabel} ${operatorSymbol} ${threshold}%`,
      `• 대상: ${targetLabel} 중 ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      ...buildNumberedServerSection(
        '서버별 현황',
        rows.map((row) => formatServerMetricLine(row.server, metricLabel, row.value))
      ),
    ].join('\n');
  }

  const rows = rawRows.sort((left, right) => right.value - left.value);
  if (rows.length === 0) return null;

  const values = rows.map((row) => row.value);
  const avg = round1(
    values.reduce((sum, value) => sum + value, 0) / values.length
  );
  const max = rows[0];
  const min = rows[rows.length - 1];
  const metricLabel = getMetricLabel(metric);
  const timeLabel = readSnapshotTimeLabel(params.snapshot);

  return [
    `📊 **${targetLabel} ${metricLabel} 현황**`,
    `• 대상: ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 평균 ${metricLabel}: ${formatMetricPercent(avg)} · 최고 ${max.server.id} ${formatMetricPercent(max.value)} · 최저 ${min.server.id} ${formatMetricPercent(min.value)}`,
    ...buildNumberedServerSection(
      '서버별 현황',
      rows.map((row) => formatServerMetricLine(row.server, metricLabel, row.value))
    ),
  ].join('\n');
}

function getCompositeLoadScore(server: SnapshotServer): number | null {
  const cpu = getMetricValue(server, 'cpu');
  const memory = getMetricValue(server, 'memory');
  const disk = getMetricValue(server, 'disk');
  if (cpu === null || memory === null || disk === null) return null;
  return round1(cpu * 0.4 + memory * 0.4 + disk * 0.2);
}

export function buildCompositeLoadRankingAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.rankBasis !== 'composite-load') return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const rankOrder = params.parsed.rankOrder ?? 'asc';
  const rankCount = normalizeRankCount(params.parsed.rankCount);
  const rows = servers
    .filter((server) => server.status !== 'offline')
    .map((server) => {
      const score = getCompositeLoadScore(server);
      if (score === null) return null;
      return {
        server,
        score,
        cpu: getMetricValue(server, 'cpu') ?? 0,
        memory: getMetricValue(server, 'memory') ?? 0,
        disk: getMetricValue(server, 'disk') ?? 0,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) =>
      rankOrder === 'asc' ? left.score - right.score : right.score - left.score
    )
    .slice(0, rankCount);
  if (rows.length === 0) return null;

  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const orderLabel = rankOrder === 'asc' ? '하위' : '상위';

  return [
    `📊 **${targetLabel} 복합 부하 ${orderLabel} ${rankCount}대**`,
    `• 기준: CPU 40% + 메모리 40% + 디스크 20% 가중 점수${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    ...rows.map(
      (row, index) =>
        `${index + 1}. ${row.server.id}: 복합 부하 ${row.score}점 (CPU ${formatMetricPercent(row.cpu)}, 메모리 ${formatMetricPercent(row.memory)}, 디스크 ${formatMetricPercent(row.disk)}, 상태 ${row.server.status ?? 'unknown'})`
    ),
    '',
    '💡 **확인 항목**',
    ...rows.map(
      (row, index) =>
        `${index + 1}. ${row.server.id}: 낮은 부하 서버는 배치/트래픽 이동 후보입니다. 배포 전 역할, AZ, 의존 서비스, 최근 에러 로그를 함께 확인하세요.`
    ),
  ].join('\n');
}

export function buildGroupServerHealthAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.sourceIntent !== 'group-server-list') return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const rows = [...servers].sort((left, right) => left.id.localeCompare(right.id));
  const statusCounts = rows.reduce<Record<string, number>>((acc, server) => {
    const status = formatServerStatus(server);
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const timeLabel = readSnapshotTimeLabel(params.snapshot);

  return [
    `📋 **${removeTargetCountSuffix(targetLabel)} 현황**`,
    `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 상태: online ${statusCounts.online ?? 0}대 · warning ${statusCounts.warning ?? 0}대 · critical ${statusCounts.critical ?? 0}대 · offline ${statusCounts.offline ?? 0}대`,
    ...buildNumberedServerSection(
      '서버별 현황',
      rows.map(
        (server) =>
          `**${server.id}**: 상태 ${formatServerStatus(server)}, CPU ${formatMetricPercent(getMetricValue(server, 'cpu') ?? 0)}, 메모리 ${formatMetricPercent(getMetricValue(server, 'memory') ?? 0)}, 디스크 ${formatMetricPercent(getMetricValue(server, 'disk') ?? 0)}`
      )
    ),
  ].join('\n');
}

function isHealthyServer(server: SnapshotServer): boolean {
  return (
    server.status === 'online' &&
    (getMetricValue(server, 'cpu') ?? Number.POSITIVE_INFINITY) < 80 &&
    (getMetricValue(server, 'memory') ?? Number.POSITIVE_INFINITY) < 90 &&
    (getMetricValue(server, 'disk') ?? Number.POSITIVE_INFINITY) < 85
  );
}

export function buildHealthyOnlyServerAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.statusFilter !== 'healthy-only') return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const rows = servers.filter(isHealthyServer).sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const header = [
    '📋 **정상 범위 서버 목록**',
    '• 기준: 상태 online, CPU < 80%, 메모리 < 90%, 디스크 < 85%',
    `• 대상: ${targetLabel} 중 ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
  ];

  if (rows.length === 0) {
    return [
      ...header,
      '• 결과: 현재 정상 범위 조건을 모두 만족하는 서버는 없습니다.',
    ].join('\n');
  }

  return [
    ...header,
    ...buildNumberedServerSection(
      '서버별 현황',
      rows.map(
        (server) =>
          `**${server.id}**: CPU ${formatMetricPercent(getMetricValue(server, 'cpu') ?? 0)}, 메모리 ${formatMetricPercent(getMetricValue(server, 'memory') ?? 0)}, 디스크 ${formatMetricPercent(getMetricValue(server, 'disk') ?? 0)}`
      )
    ),
  ].join('\n');
}

function buildGroupMetricCompareAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  const metric = params.parsed.metric;
  const groupTargets = params.parsed.groupTargets ?? [];
  if (!metric || groupTargets.length < 2) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const summaries = groupTargets
    .map((target) => {
      const targetType = normalizeServerType(target);
      const { servers } = filterSnapshotServers(allServers, [target]);
      const rows = servers
        .map((server) => ({
          server,
          value: getMetricValue(server, metric),
        }))
        .filter(
          (row): row is { server: SnapshotServer; value: number } =>
            row.value !== null
        )
        .sort((left, right) => right.value - left.value);
      if (rows.length === 0) return null;

      const values = rows.map((row) => row.value);
      const avg = round1(
        values.reduce((sum, value) => sum + value, 0) / values.length
      );
      const max = rows[0];
      const min = rows[rows.length - 1];
      if (!max || !min) return null;

      return {
        targetType,
        label: getServerTypeKoreanLabel(targetType),
        rows,
        avg,
        max,
        min,
      };
    })
    .filter((summary): summary is NonNullable<typeof summary> => summary !== null);
  if (summaries.length === 0) return null;
  if (summaries.length === 1) {
    const only = summaries[0];
    if (!only) return null;
    const metricLabel = getMetricLabel(metric);
    const timeLabel = readSnapshotTimeLabel(params.snapshot);
    return [
      `📊 **${only.label} ${metricLabel} 현황** (비교 대상 그룹 데이터 없음)`,
      `• 대상: ${only.rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      `• 평균 ${metricLabel}: ${formatMetricPercent(only.avg)} · 최고 ${only.max.server.id} ${formatMetricPercent(only.max.value)}`,
      ...buildNumberedServerSection(
        '서버별 현황',
        only.rows.map((row) =>
          formatServerMetricLine(row.server, metricLabel, row.value)
        )
      ),
    ].join('\n');
  }

  const sortedByAverage = [...summaries].sort(
    (left, right) => right.avg - left.avg
  );
  const leader = sortedByAverage[0];
  const follower = sortedByAverage[1];
  if (!leader || !follower) return null;

  const metricLabel = getMetricLabel(metric);
  const diff = round1(leader.avg - follower.avg);
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const conclusion =
    diff === 0
      ? `두 그룹의 평균 ${metricLabel}가 동일합니다.`
      : `${leader.label}가 ${follower.label}보다 평균 ${metricLabel} ${diff}%p 높습니다.`;

  return [
    `📊 **${summaries.map((summary) => summary.label).join(' vs ')} ${metricLabel} 비교**`,
    `• 대상: ${summaries
      .map((summary) => `${summary.label} ${summary.rows.length}대`)
      .join(' · ')}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 평균: ${summaries
      .map((summary) => `${summary.label} ${formatMetricPercent(summary.avg)}`)
      .join(' · ')}`,
    `• 결론: ${conclusion}`,
    ...buildNumberedServerSection(
      '그룹별 서버 현황',
      summaries.flatMap((summary) =>
        summary.rows.map(
          (row) =>
            `${summary.label} / **${row.server.id}**: ${metricLabel} ${formatMetricPercent(row.value)} (상태 ${formatServerStatus(row.server)})`
        )
      )
    ),
  ].join('\n');
}

function buildMultiMetricFilterAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  const metrics = params.parsed.metrics ?? [];
  const threshold = params.parsed.threshold;
  if (metrics.length === 0) return null;

  if (threshold === undefined) {
    const allServers = readSnapshotServers(params.snapshot);
    const { servers, targetLabel } = filterSnapshotServers(
      allServers,
      params.parsed.targets
    );
    if (servers.length === 0) return null;

    const rows = servers
      .map((server) => {
        const values = metrics.map((metric) => ({
          metric,
          value: getMetricValue(server, metric),
        }));
        if (values.some((entry) => entry.value === null)) return null;
        const numericValues = values as Array<{
          metric: SupportedMetric;
          value: number;
        }>;
        return {
          server,
          values: numericValues,
          score: numericValues.reduce((sum, entry) => sum + entry.value, 0),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => right.score - left.score)
      .slice(0, 5);

    if (rows.length === 0) return null;

    const metricLabels = metrics.map(getMetricLabel).join(' + ');
    const timeLabel = readSnapshotTimeLabel(params.snapshot);
    const isServerCompare = params.parsed.sourceIntent === 'server-compare';
    return [
      `📊 **${targetLabel} ${metricLabels} ${isServerCompare ? '비교' : '복합 부하 상위'}**`,
      `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      ...buildNumberedServerSection(
        `${metricLabels} ${isServerCompare ? '서버별 비교' : '합산 내림차순'}`,
        rows.map((row) => {
          const metricText = row.values
            .map(
              (entry) =>
                `${getMetricLabel(entry.metric)} ${formatMetricPercent(entry.value)}`
            )
            .join(', ');
          return `**${row.server.id}**: ${metricText} (상태 ${formatServerStatus(row.server)})`;
        })
      ),
    ].join('\n');
  }

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const rows = servers
    .map((server) => {
      const values = metrics.map((metric) => ({
        metric,
        value: getMetricValue(server, metric),
      }));
      if (values.some((entry) => entry.value === null)) return null;

      const numericValues = values as Array<{
        metric: SupportedMetric;
        value: number;
      }>;
      const matches =
        params.parsed.filterOperator === 'OR'
          ? numericValues.some((entry) =>
              compareMetricValue(
                entry.value,
                params.parsed.thresholdOperator,
                threshold
              )
            )
          : numericValues.every((entry) =>
              compareMetricValue(
                entry.value,
                params.parsed.thresholdOperator,
                threshold
              )
            );
      if (!matches) return null;

      return {
        server,
        values: numericValues,
        score: numericValues.reduce((sum, entry) => sum + entry.value, 0),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.score - left.score);

  const metricLabels = metrics.map(getMetricLabel);
  const conditionJoiner = params.parsed.filterOperator === 'OR' ? ' OR ' : ' AND ';
  const operatorLabel = getThresholdOperatorLabel(
    params.parsed.thresholdOperator
  );
  const operatorSymbol = getThresholdOperatorSymbol(
    params.parsed.thresholdOperator
  );
  const condition = metrics
    .map((metric) => `${getMetricLabel(metric)} ${operatorSymbol} ${threshold}%`)
    .join(conditionJoiner);
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const title = `${metricLabels.join(' + ')} ${threshold}% ${operatorLabel} 서버`;

  if (rows.length === 0) {
    return [
      `📊 **${title}**`,
      `• 조건: ${condition}`,
      `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      '• 결과: 현재 조건을 동시에 만족하는 서버는 없습니다.',
    ].join('\n');
  }

  return [
    `📊 **${title}**`,
    `• 조건: ${condition}`,
    `• 대상: ${targetLabel} 중 ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    ...buildNumberedServerSection(
      '서버별 현황',
      rows.map((row) => {
        const metricText = row.values
          .map(
            (entry) =>
              `${getMetricLabel(entry.metric)} ${formatMetricPercent(entry.value)}`
          )
          .join(', ');
        return `**${row.server.id}**: ${metricText} (상태 ${formatServerStatus(row.server)})`;
      })
    ),
  ].join('\n');
}

export function buildMetricTrendAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  const metrics = params.parsed.metric && params.parsed.metric !== 'network'
    ? [params.parsed.metric]
    : (params.parsed.metrics ?? []).filter(
        (metric): metric is Exclude<SupportedMetric, 'network'> =>
          metric !== 'network'
      );
  if (metrics.length === 0) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const trendMap = new Map(
    get24hTrendSummaries().map((trend) => [trend.serverId, trend])
  );
  if (metrics.length > 1) {
    return buildMultiMetricTrendAnswer({
      metrics,
      servers,
      targetLabel,
      snapshot: params.snapshot,
      trendMap,
    });
  }

  const metric = metrics[0];
  const rows = servers
    .map((server) => {
      const current = getMetricValue(server, metric);
      const trend = trendMap.get(server.id)?.[metric];
      if (current === null || !trend) return null;
      const delta = round1(current - trend.avg);
      return {
        server,
        current,
        avg24h: trend.avg,
        max24h: trend.max,
        min24h: trend.min,
        delta,
        direction: formatTrendDirection(delta),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.current - left.current);
  if (rows.length === 0) return null;

  const metricLabel = getMetricLabel(metric);
  const avgCurrent = round1(
    rows.reduce((sum, row) => sum + row.current, 0) / rows.length
  );
  const avg24h = round1(
    rows.reduce((sum, row) => sum + row.avg24h, 0) / rows.length
  );
  const directionCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.direction] = (acc[row.direction] ?? 0) + 1;
    return acc;
  }, {});
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const topRows = rows.slice(0, 5);

  return [
    `📈 **${targetLabel} ${metricLabel} 추이**`,
    `• 대상: ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 현재 평균 ${metricLabel}: ${formatMetricPercent(avgCurrent)} · 24h 평균 ${formatMetricPercent(avg24h)} · 전체 ${formatTrendDirection(avgCurrent - avg24h)}`,
    `• 추세 분포: 상승 ${directionCounts['상승'] ?? 0}대, 안정 ${directionCounts['안정'] ?? 0}대, 하락 ${directionCounts['하락'] ?? 0}대`,
    ...buildNumberedServerSection(
      `현재 ${metricLabel} 상위`,
      topRows.map(
        (row) =>
          `**${row.server.id}**: 현재 ${metricLabel} ${formatMetricPercent(row.current)} (24h 평균 ${formatMetricPercent(row.avg24h)}, ${row.direction} ${row.delta >= 0 ? '+' : ''}${row.delta}%p)`
      )
    ),
  ].join('\n');
}
