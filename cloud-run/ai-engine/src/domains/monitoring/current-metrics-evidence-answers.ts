import type { DomainSnapshot } from '../../core/assistant-runtime';
import { get24hTrendSummaries, normalizeServerType } from '../../tools-ai-sdk/server-metrics/data';
import {
  buildNumberedServerSection,
  compareMetricValue,
  filterSnapshotServers,
  formatMetricPercent,
  formatServerStatus,
  formatTrendDirection,
  getMetricLabel,
  getMetricValue,
  getServerTypeKoreanLabel,
  getThresholdOperatorSymbol,
  matchesTrendDirection,
  normalizeRankCount,
  removeTargetCountSuffix,
  round1,
} from './current-metrics-answer-utils';
import type {
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
} from './current-metrics-evidence-request';
import { buildMultiMetricTrendAnswer } from './current-metrics-multi-trend-answer';
import {
  type SnapshotServer,
  readSnapshotTimeLabel,
  readSnapshotServers,
} from './snapshot-utils';

export { buildMetricCurrentAnswer } from './current-metrics-current-answer';

function getCompositeLoadScore(server: SnapshotServer): number | null {
  const cpu = getMetricValue(server, 'cpu');
  const memory = getMetricValue(server, 'memory');
  const disk = getMetricValue(server, 'disk');
  if (cpu === null || memory === null || disk === null) return null;
  return round1(cpu * 0.4 + memory * 0.4 + disk * 0.2);
}

function formatServerHealthRow(server: SnapshotServer): string {
  return `**${server.id}**: 상태 ${formatServerStatus(server)}, CPU ${formatMetricPercent(getMetricValue(server, 'cpu') ?? 0)}, 메모리 ${formatMetricPercent(getMetricValue(server, 'memory') ?? 0)}, 디스크 ${formatMetricPercent(getMetricValue(server, 'disk') ?? 0)}`;
}

export function buildCompositeLoadRankingAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.rankBasis !== 'composite-load') return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets,
    { preferExplicitLabel: params.parsed.contextualTargets === true }
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
  const isPressureRanking =
    params.parsed.sourceIntent === 'composite-pressure-ranking';
  const rankingLabel = isPressureRanking ? '리소스 압박' : '복합 부하';
  const basisLabel = isPressureRanking
    ? 'CPU 40% + 메모리 40% + 디스크 20% 가중 압박 점수'
    : 'CPU 40% + 메모리 40% + 디스크 20% 가중 점수';

  return [
    `📊 **${targetLabel} ${rankingLabel} ${orderLabel} ${rankCount}대**`,
    `• 기준: ${basisLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    ...rows.map(
      (row, index) =>
        `${index + 1}. ${row.server.id}: ${rankingLabel} ${row.score}점 (CPU ${formatMetricPercent(row.cpu)}, 메모리 ${formatMetricPercent(row.memory)}, 디스크 ${formatMetricPercent(row.disk)}, 상태 ${row.server.status ?? 'unknown'})`
    ),
    '',
    '💡 **확인 항목**',
    ...rows.map(
      (row, index) =>
        rankOrder === 'asc'
          ? `${index + 1}. ${row.server.id}: 안정적 수치의 낮은 부하 서버입니다. 현재 역할, AZ, 의존 서비스 기준선이 유지되는지 확인하세요.`
          : `${index + 1}. ${row.server.id}: 압박 점수가 높은 서버입니다. 지배 지표(CPU/메모리/디스크), 같은 계층 서버 편차, 최근 에러 로그를 우선 대조하세요.`
    ),
  ].join('\n');
}

function buildMetricRankingCheckItem(params: {
  metric: SupportedMetric;
  rankOrder: 'asc' | 'desc';
  server: SnapshotServer;
}): string {
  if (params.rankOrder === 'asc') {
    return `${params.server.id}: ${getMetricLabel(params.metric)}가 낮은 안정적 수치입니다. 현재 역할과 평소 기준선 범위에서 유지되는지 확인하세요.`;
  }
  return `${params.server.id}: 높은 ${getMetricLabel(params.metric)} 서버입니다. 같은 그룹 내 편차, 최근 배포/배치, 관련 로그를 우선 확인하세요.`;
}

type MetricRankingRow = {
  server: SnapshotServer;
  value: number;
};

function formatMetricRankingRow(params: {
  row: MetricRankingRow;
  metricLabel: string;
}): string {
  return `**${params.row.server.id}**: ${params.metricLabel} ${formatMetricPercent(params.row.value)} (상태 ${formatServerStatus(params.row.server)})`;
}

export function buildMetricRankingAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  const metric = params.parsed.metric;
  if (
    params.parsed.intent !== 'metric_ranking' ||
    !metric ||
    params.parsed.rankBasis === 'composite-load'
  ) {
    return null;
  }

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets,
    { preferExplicitLabel: params.parsed.contextualTargets === true }
  );
  if (servers.length === 0) return null;

  const rankOrder = params.parsed.rankOrder ?? 'desc';
  const rankCount = normalizeRankCount(params.parsed.rankCount);
  const sortableRows = servers
    .filter((server) => server.status !== 'offline')
    .map((server) => ({
      server,
      value: getMetricValue(server, metric),
    }))
    .filter(
      (row): row is { server: SnapshotServer; value: number } =>
        row.value !== null
    );
  if (sortableRows.length === 0) return null;

  const metricLabel = getMetricLabel(metric);
  const orderLabel = rankOrder === 'asc' ? '하위' : '상위';
  const titlePrefix =
    targetLabel === '전체 서버' ? '' : `${removeTargetCountSuffix(targetLabel)} `;
  const timeLabel = readSnapshotTimeLabel(params.snapshot);

  if (params.parsed.rankRange === 'top-bottom') {
    const topRows = [...sortableRows]
      .sort((left, right) => right.value - left.value)
      .slice(0, rankCount);
    const bottomRows = [...sortableRows]
      .sort((left, right) => left.value - right.value)
      .slice(0, rankCount);
    if (topRows.length === 0 || bottomRows.length === 0) return null;

    return [
      `📊 **${titlePrefix}${metricLabel} 사용률 상위 ${rankCount}대 + 하위 ${rankCount}대**`,
      `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      ...buildNumberedServerSection(
        `${metricLabel} 상위 ${rankCount}대`,
        topRows.map((row) => formatMetricRankingRow({ row, metricLabel }))
      ),
      ...buildNumberedServerSection(
        `${metricLabel} 하위 ${rankCount}대`,
        bottomRows.map((row) => formatMetricRankingRow({ row, metricLabel }))
      ),
      '',
      '💡 **서버별 확인 항목**',
      ...topRows.map(
        (row, index) =>
          `${index + 1}. ${buildMetricRankingCheckItem({
            metric,
            rankOrder: 'desc',
            server: row.server,
          })}`
      ),
      ...bottomRows.map(
        (row, index) =>
          `${topRows.length + index + 1}. ${buildMetricRankingCheckItem({
            metric,
            rankOrder: 'asc',
            server: row.server,
          })}`
      ),
    ].join('\n');
  }

  const rows = [...sortableRows]
    .sort((left, right) =>
      rankOrder === 'asc' ? left.value - right.value : right.value - left.value
    )
    .slice(0, rankCount);
  if (rows.length === 0) return null;

  return [
    `📊 **${titlePrefix}${metricLabel} 사용률 ${orderLabel} ${rankCount}대**`,
    `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    ...rows.map(
      (row, index) =>
        `${index + 1}. ${row.server.id}: ${metricLabel} ${formatMetricPercent(row.value)} (상태 ${formatServerStatus(row.server)})`
    ),
    '',
    '💡 **서버별 확인 항목**',
    ...rows.map((row, index) => {
      return `${index + 1}. ${buildMetricRankingCheckItem({
        metric,
        rankOrder,
        server: row.server,
      })}`;
    }),
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

function getStatusPenalty(server: SnapshotServer): number {
  switch (server.status) {
    case 'critical':
    case 'offline':
      return 40;
    case 'warning':
      return 20;
    default:
      return 0;
  }
}

function getServerInstabilityScore(server: SnapshotServer): number {
  const metricPressure = Math.max(
    getMetricValue(server, 'cpu') ?? 0,
    getMetricValue(server, 'memory') ?? 0,
    getMetricValue(server, 'disk') ?? 0
  );
  return round1(metricPressure + getStatusPenalty(server));
}

type ConcreteStatusFilter = Exclude<
  ParsedCurrentMetricsEvidenceRequest['statusFilter'],
  'healthy-only' | undefined
>;

function getConcreteStatusFilter(
  statusFilter: ParsedCurrentMetricsEvidenceRequest['statusFilter']
): ConcreteStatusFilter | null {
  return statusFilter && statusFilter !== 'healthy-only' ? statusFilter : null;
}

export function buildGroupHealthCompareAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.sourceIntent !== 'group-health-compare') return null;

  const groupTargets = params.parsed.groupTargets ?? [];
  if (groupTargets.length < 2) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const summaries = groupTargets
    .map((target) => {
      const targetType = normalizeServerType(target);
      const { servers } = filterSnapshotServers(allServers, [target]);
      if (servers.length === 0) return null;

      const rows = [...servers]
        .map((server) => ({
          server,
          score: getServerInstabilityScore(server),
        }))
        .sort((left, right) => right.score - left.score);
      const avgScore = round1(
        rows.reduce((sum, row) => sum + row.score, 0) / rows.length
      );
      const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
        const status = formatServerStatus(row.server);
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {});

      return {
        targetType,
        label: getServerTypeKoreanLabel(targetType),
        rows,
        avgScore,
        statusCounts,
      };
    })
    .filter((summary): summary is NonNullable<typeof summary> => summary !== null);
  if (summaries.length < 2) return null;

  const statusFilter = getConcreteStatusFilter(params.parsed.statusFilter);
  if (statusFilter) {
    const timeLabel = readSnapshotTimeLabel(params.snapshot);
    const sortedByCount = [...summaries].sort(
      (left, right) =>
        (right.statusCounts[statusFilter] ?? 0) -
        (left.statusCounts[statusFilter] ?? 0)
    );
    const leader = sortedByCount[0];
    const follower = sortedByCount[1];
    if (!leader || !follower) return null;

    const leaderCount = leader.statusCounts[statusFilter] ?? 0;
    const followerCount = follower.statusCounts[statusFilter] ?? 0;
    const diff = leaderCount - followerCount;
    const conclusion =
      diff === 0
        ? `두 그룹의 ${statusFilter} 상태 서버 수가 같습니다.`
        : `${leader.label}가 ${follower.label}보다 ${statusFilter} 상태 서버가 ${diff}대 더 많습니다.`;

    return [
      `📊 **${summaries.map((summary) => summary.label).join(' vs ')} ${statusFilter} 상태 서버 수 비교**`,
      `• 기준: ${statusFilter} 상태 서버 수`,
      `• 대상: ${summaries
        .map((summary) => `${summary.label} ${summary.rows.length}대`)
        .join(' · ')}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      `• 집계: ${summaries
        .map(
          (summary) =>
            `${summary.label} ${summary.statusCounts[statusFilter] ?? 0}대`
        )
        .join(' · ')}`,
      `• 결론: ${conclusion}`,
      ...buildNumberedServerSection(
        '그룹별 서버 현황',
        summaries.flatMap((summary) =>
          summary.rows.map(
            (row) => `${summary.label} / ${formatServerHealthRow(row.server)}`
          )
        )
      ),
    ].join('\n');
  }

  const sortedByScore = [...summaries].sort(
    (left, right) => right.avgScore - left.avgScore
  );
  const leader = sortedByScore[0];
  const follower = sortedByScore[1];
  if (!leader || !follower) return null;

  const diff = round1(leader.avgScore - follower.avgScore);
  const conclusion =
    diff === 0
      ? '두 그룹의 위험 신호 수준이 비슷합니다.'
      : `${leader.label}가 ${follower.label}보다 상대적으로 위험 신호가 더 큽니다.`;
  const timeLabel = readSnapshotTimeLabel(params.snapshot);

  return [
    `📊 **${summaries.map((summary) => summary.label).join(' vs ')} 안정성 비교**`,
    '• 기준: 상태와 CPU/메모리/디스크 사용률을 함께 반영',
    `• 대상: ${summaries
      .map((summary) => `${summary.label} ${summary.rows.length}대`)
      .join(' · ')}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 그룹 현황: ${summaries
      .map(
        (summary) =>
          `${summary.label} (online ${summary.statusCounts.online ?? 0}, warning ${summary.statusCounts.warning ?? 0}, critical ${summary.statusCounts.critical ?? 0}, offline ${summary.statusCounts.offline ?? 0})`
      )
      .join(' · ')}`,
    `• 결론: ${conclusion}`,
    ...buildNumberedServerSection(
      '그룹별 서버 현황',
      summaries.flatMap((summary) =>
        summary.rows.map(
          (row) => `${summary.label} / ${formatServerHealthRow(row.server)}`
        )
      )
    ),
  ].join('\n');
}

export function buildTopBottomServerHealthAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.sourceIntent !== 'top-bottom-health') return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets
  );
  if (servers.length === 0) return null;

  const scoredRows = servers
    .map((server) => ({
      server,
      score: getServerInstabilityScore(server),
    }))
    .sort((left, right) => right.score - left.score);
  if (scoredRows.length === 0) return null;

  const rankCount = normalizeRankCount(params.parsed.rankCount);
  const riskRows = scoredRows.slice(0, rankCount);
  const stableRows = [...scoredRows]
    .filter((row) => row.server.status !== 'offline')
    .sort((left, right) => left.score - right.score)
    .slice(0, rankCount);
  if (riskRows.length === 0 || stableRows.length === 0) return null;

  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const formatHealthRow = (row: (typeof scoredRows)[number]) =>
    formatServerHealthRow(row.server);

  return [
    `📊 **${targetLabel} 위험 서버 + 안정 서버 동시 비교**`,
    '• 기준: 상태와 CPU/메모리/디스크 사용률을 함께 반영',
    `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 결론: 가장 위험한 서버는 ${riskRows[0]?.server.id}, 가장 안정적인 서버는 ${stableRows[0]?.server.id}입니다.`,
    ...buildNumberedServerSection(
      `위험 서버 TOP ${rankCount}`,
      riskRows.map(formatHealthRow)
    ),
    ...buildNumberedServerSection(
      `안정 서버 TOP ${rankCount}`,
      stableRows.map(formatHealthRow)
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

  const allHealthy = servers.filter(isHealthyServer).sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  const rankCount = params.parsed.rankCount;
  const rows = rankCount ? allHealthy.slice(0, rankCount) : allHealthy;
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const listLabel = rankCount
    ? `정상 범위 서버 상위 ${rankCount}대`
    : '정상 범위 서버 목록';
  const header = [
    `📋 **${listLabel}**`,
    '• 기준: 상태 online, CPU < 80%, 메모리 < 90%, 디스크 < 85%',
    `• 대상: ${targetLabel} 중 ${rankCount ? `상위 ${rankCount}대 / 총 ${allHealthy.length}대` : `${rows.length}대`}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
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
  const rawRows = servers
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
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const threshold = params.parsed.threshold;
  const thresholdOperator = params.parsed.thresholdOperator;
  const thresholdMatchedRows = rawRows.filter((row) =>
    threshold === undefined
      ? true
      : compareMetricValue(row.current, thresholdOperator, threshold)
  );
  const trendMatchedRows = thresholdMatchedRows.filter((row) =>
    matchesTrendDirection(row.delta, params.parsed.trendDirection)
  );
  const shouldFallbackToDeltaRanking =
    trendMatchedRows.length === 0 &&
    thresholdMatchedRows.length > 0 &&
    params.parsed.trendRankBy === 'delta' &&
    params.parsed.trendDirection !== undefined;
  const rows = (
    shouldFallbackToDeltaRanking ? thresholdMatchedRows : trendMatchedRows
  ).sort((left, right) => {
    if (params.parsed.trendRankBy !== 'delta') {
      return right.current - left.current;
    }

    return params.parsed.trendDirection === 'decrease'
      ? left.delta - right.delta || right.current - left.current
      : right.delta - left.delta || right.current - left.current;
  });
  const metricLabel = getMetricLabel(metric);
  const rankCount =
    params.parsed.rankCount !== undefined
      ? normalizeRankCount(params.parsed.rankCount)
      : 5;
  const thresholdLines =
    threshold === undefined
      ? []
      : [
          `• 조건: ${metricLabel} ${getThresholdOperatorSymbol(
            thresholdOperator
          )} ${threshold}%`,
        ];
  const directionLines =
    params.parsed.trendDirection === undefined
      ? []
      : [
          `• 추세 조건: 24h 평균 대비 ${
            params.parsed.trendDirection === 'increase' ? '상승' : '하락'
          }`,
        ];
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const fallbackLines = shouldFallbackToDeltaRanking
    ? [
        `• 결과: 24h 평균 대비 ${
          params.parsed.trendDirection === 'increase' ? '상승' : '하락'
        } 조건을 만족하는 서버는 없습니다.`,
        '• 대체 기준: 조건 없음으로 끝내지 않고 24h 평균 대비 변화폭이 큰 순서로 표시합니다.',
      ]
    : [];

  if (rows.length === 0) {
    return [
      `📈 **${targetLabel} ${metricLabel} 추이**`,
      `• 대상: ${servers.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      ...thresholdLines,
      ...directionLines,
      '• 결과: 현재 조건과 추세 조건을 동시에 만족하는 서버는 없습니다.',
    ].join('\n');
  }

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
  const topRows = rows.slice(0, rankCount);
  const sectionTitle =
    params.parsed.trendRankBy === 'delta' ||
    params.parsed.trendDirection !== undefined
      ? `${metricLabel} ${
          params.parsed.trendDirection === 'decrease' ? '감소폭' : '증가폭'
        } 상위 ${rankCount}대`
      : `현재 ${metricLabel} 상위`;

  return [
    `📈 **${targetLabel} ${metricLabel} 추이**`,
    `• 대상: ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    ...thresholdLines,
    ...directionLines,
    ...fallbackLines,
    `• 현재 평균 ${metricLabel}: ${formatMetricPercent(avgCurrent)} · 24h 평균 ${formatMetricPercent(avg24h)} · 전체 ${formatTrendDirection(avgCurrent - avg24h)}`,
    `• 추세 분포: 상승 ${directionCounts['상승'] ?? 0}대, 안정 ${directionCounts['안정'] ?? 0}대, 하락 ${directionCounts['하락'] ?? 0}대`,
    ...buildNumberedServerSection(
      sectionTitle,
      topRows.map(
        (row) =>
          `**${row.server.id}**: 현재 ${metricLabel} ${formatMetricPercent(row.current)} (24h 평균 ${formatMetricPercent(row.avg24h)}, ${row.direction} ${row.delta >= 0 ? '+' : ''}${row.delta}%p)`
      )
    ),
  ].join('\n');
}
