import type { DomainSnapshot } from '../../core/assistant-runtime';
import type { get24hTrendSummaries } from '../../tools-ai-sdk/server-metrics/data';
import type { SupportedMetric } from './current-metrics-evidence-request';

type SnapshotServer = {
  id: string;
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

function formatMetricPercent(value: number): string {
  return `${round1(value)}%`;
}

function formatTrendDirection(delta: number): string {
  if (delta > 1) return '상승';
  if (delta < -1) return '하락';
  return '안정';
}

function buildNumberedServerSection(title: string, rows: string[]): string[] {
  return [``, `**${title}**`, ...rows.map((row, index) => `${index + 1}. ${row}`)];
}

export function buildMultiMetricTrendAnswer(params: {
  metrics: Array<Exclude<SupportedMetric, 'network'>>;
  servers: SnapshotServer[];
  targetLabel: string;
  snapshot: DomainSnapshot;
  trendMap: Map<string, ReturnType<typeof get24hTrendSummaries>[number]>;
}): string | null {
  const rows = params.servers
    .map((server) => {
      const trend = params.trendMap.get(server.id);
      if (!trend) return null;

      const metricRows = params.metrics
        .map((metric) => {
          const current = getMetricValue(server, metric);
          const metricTrend = trend[metric];
          if (current === null || !metricTrend) return null;
          const delta = round1(current - metricTrend.avg);
          return {
            metric,
            current,
            avg24h: metricTrend.avg,
            delta,
            direction: formatTrendDirection(delta),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
      if (metricRows.length === 0) return null;

      const maxDelta = Math.max(
        ...metricRows.map((row) => Math.abs(row.delta))
      );
      return { server, metricRows, maxDelta };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.maxDelta - left.maxDelta);
  if (rows.length === 0) return null;

  const directionCounts = rows
    .flatMap((row) => row.metricRows)
    .reduce<Record<string, number>>((acc, row) => {
      acc[row.direction] = (acc[row.direction] ?? 0) + 1;
      return acc;
    }, {});
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const metricLabels = params.metrics.map(getMetricLabel).join(' · ');
  const topRows = rows.slice(0, 5);

  return [
    `📈 **${params.targetLabel} 메트릭 추이**`,
    `• 대상: ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
    `• 기준: ${metricLabels} 현재값과 24h 평균 비교`,
    `• 추세 분포: 상승 ${directionCounts['상승'] ?? 0}건, 안정 ${directionCounts['안정'] ?? 0}건, 하락 ${directionCounts['하락'] ?? 0}건`,
    ...buildNumberedServerSection(
      '서버별 24h 추세',
      topRows.map((row) => {
        const metricText = row.metricRows
          .map(
            (metricRow) =>
              `${getMetricLabel(metricRow.metric)} 현재 ${formatMetricPercent(metricRow.current)} (24h 평균 ${formatMetricPercent(metricRow.avg24h)}, ${metricRow.direction} ${metricRow.delta >= 0 ? '+' : ''}${metricRow.delta}%p)`
          )
          .join(', ');
        return `**${row.server.id}**: ${metricText}`;
      })
    ),
  ].join('\n');
}
