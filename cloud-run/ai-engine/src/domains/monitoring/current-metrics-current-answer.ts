import { STATUS_THRESHOLDS } from '../../config/status-thresholds';
import type { DomainSnapshot } from '../../core/assistant-runtime';
import { normalizeServerType } from '../../tools-ai-sdk/server-metrics/data';
import {
  buildNumberedServerSection,
  compareMetricValue,
  filterSnapshotServers,
  formatMetricPercent,
  formatServerMetricLine,
  formatServerStatus,
  getMetricLabel,
  getMetricValue,
  getServerTypeKoreanLabel,
  getThresholdOperatorLabel,
  getThresholdOperatorSymbol,
  removeTargetCountSuffix,
  round1,
} from './current-metrics-answer-utils';
import type {
  ParsedCurrentMetricsEvidenceRequest,
  SupportedMetric,
} from './current-metrics-evidence-request';
import {
  type SnapshotServer,
  readSnapshotServers,
  readSnapshotTimeLabel,
} from './snapshot-utils';

type MetricStatusFilter = Exclude<
  ParsedCurrentMetricsEvidenceRequest['statusFilter'],
  'healthy-only' | undefined
>;

function getMetricStatusFilter(
  statusFilter: ParsedCurrentMetricsEvidenceRequest['statusFilter']
): MetricStatusFilter | null {
  return statusFilter && statusFilter !== 'healthy-only' ? statusFilter : null;
}

function applyMetricStatusFilter(params: {
  servers: SnapshotServer[];
  targetLabel: string;
  statusFilter: ParsedCurrentMetricsEvidenceRequest['statusFilter'];
}): { servers: SnapshotServer[]; targetLabel: string } {
  const statusFilter = getMetricStatusFilter(params.statusFilter);
  if (!statusFilter) {
    return { servers: params.servers, targetLabel: params.targetLabel };
  }

  const servers = params.servers.filter((server) => server.status === statusFilter);
  return {
    servers,
    targetLabel: `${removeTargetCountSuffix(params.targetLabel)} 중 ${statusFilter} 상태 ${servers.length}대`,
  };
}

function buildMetricRiskComparisonAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.sourceIntent !== 'metric-risk-compare') return null;

  const metrics = (params.parsed.metrics ?? []).filter(
    (metric, index, list) => list.indexOf(metric) === index
  );
  if (metrics.length < 2) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const { servers, targetLabel } = filterSnapshotServers(
    allServers,
    params.parsed.targets,
    { preferExplicitLabel: params.parsed.contextualTargets === true }
  );
  if (servers.length === 0) return null;

  const rows = metrics
    .map((metric) => {
      const values = servers
        .filter((server) => server.status !== 'offline')
        .map((server) => ({
          server,
          value: getMetricValue(server, metric),
        }))
        .filter(
          (row): row is { server: SnapshotServer; value: number } =>
            row.value !== null
        );
      if (values.length === 0) return null;

      const threshold = STATUS_THRESHOLDS[metric];
      const sorted = [...values].sort((left, right) => right.value - left.value);
      const max = sorted[0];
      const avg = round1(
        values.reduce((sum, row) => sum + row.value, 0) / values.length
      );
      const criticalCount = values.filter(
        (row) => row.value >= threshold.critical
      ).length;
      const warningCount = values.filter(
        (row) =>
          row.value >= threshold.warning && row.value < threshold.critical
      ).length;
      const score = round1(
        criticalCount * 10000 + warningCount * 1000 + max.value * 10 + avg
      );

      return {
        metric,
        metricLabel: getMetricLabel(metric),
        avg,
        max,
        warningCount,
        criticalCount,
        threshold,
        score,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.score - left.score);

  if (rows.length === 0) return null;

  const top = rows[0];
  const timeLabel = readSnapshotTimeLabel(params.snapshot);

  return [
    `📊 **${targetLabel} 메트릭 위험도 비교**`,
    `• 판정: 현재 가장 위험한 메트릭은 **${top.metricLabel}**입니다.${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    '• 기준: critical 서버 수 → warning 서버 수 → 최고 사용률 → 평균 사용률',
    ...rows.map(
      (row, index) =>
        `${index + 1}. ${row.metricLabel}: critical ${row.criticalCount}대 · warning ${row.warningCount}대 · 최고 ${row.max.server.id} ${formatMetricPercent(row.max.value)} · 평균 ${formatMetricPercent(row.avg)} (임계치 ${row.threshold.warning}/${row.threshold.critical}%)`
    ),
    '',
    '💡 **확인 항목**',
    `${top.metricLabel}가 1순위입니다. 해당 지표의 최고 서버(${top.max.server.id})와 같은 그룹 내 편차, 최근 배포/배치 작업, 관련 로그를 우선 확인하세요.`,
  ].join('\n');
}

export function buildMetricCurrentAnswer(params: {
  parsed: ParsedCurrentMetricsEvidenceRequest;
  snapshot: DomainSnapshot;
}): string | null {
  if (params.parsed.sourceIntent === 'metric-risk-compare') {
    return buildMetricRiskComparisonAnswer(params);
  }

  if (params.parsed.groupTargets && params.parsed.groupTargets.length >= 2) {
    return buildGroupMetricCompareAnswer(params);
  }

  if (params.parsed.metrics && params.parsed.metrics.length > 0) {
    return buildMultiMetricFilterAnswer(params);
  }

  const metric = params.parsed.metric;
  if (!metric) return null;

  const allServers = readSnapshotServers(params.snapshot);
  const target = filterSnapshotServers(
    allServers,
    params.parsed.targets,
    { preferExplicitLabel: params.parsed.contextualTargets === true }
  );
  const { servers, targetLabel } = applyMetricStatusFilter({
    ...target,
    statusFilter: params.parsed.statusFilter,
  });
  if (servers.length === 0) {
    const statusFilter = getMetricStatusFilter(params.parsed.statusFilter);
    if (statusFilter) {
      const timeLabel = readSnapshotTimeLabel(params.snapshot);
      return [
        `📊 **${targetLabel} ${getMetricLabel(metric)} 현황**`,
        `• 대상: ${targetLabel}${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
        '• 결과: 현재 조건을 만족하는 서버는 없습니다.',
      ].join('\n');
    }
    return null;
  }

  const rawRows = servers
    .map((server) => ({
      server,
      value: getMetricValue(server, metric),
    }))
    .filter(
      (row): row is { server: SnapshotServer; value: number } =>
        row.value !== null
    );
  if (rawRows.length === 0) {
    const statusFilter = getMetricStatusFilter(params.parsed.statusFilter);
    if (statusFilter) {
      return [
        `📊 **${targetLabel} ${getMetricLabel(metric)} 현황**`,
        `• 대상: ${targetLabel}${readSnapshotTimeLabel(params.snapshot) ? ` · 데이터 슬롯 ${readSnapshotTimeLabel(params.snapshot)} KST` : ''}`,
        '• 결과: 현재 조건을 만족하는 서버는 없습니다.',
      ].join('\n');
    }
    return null;
  }

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
        rows.map((row) =>
          formatServerMetricLine(row.server, metricLabel, row.value)
        )
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
      rows.map((row) =>
        formatServerMetricLine(row.server, metricLabel, row.value)
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
      params.parsed.targets,
      { preferExplicitLabel: params.parsed.contextualTargets === true }
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
    const isServerCompare =
      params.parsed.sourceIntent === 'server-compare' ||
      params.parsed.sourceIntent === 'server-detail-multi-metric';
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
    params.parsed.targets,
    { preferExplicitLabel: params.parsed.contextualTargets === true }
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
    .sort((left, right) =>
      params.parsed.thresholdOperator === '<' ||
      params.parsed.thresholdOperator === '<='
        ? left.score - right.score
        : right.score - left.score
    );

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
