import type {
  DomainEvidenceProvider,
  DomainEvidenceRequest,
  DomainSnapshot,
} from '../../core/assistant-runtime';
import {
  getAllServerEntries,
  getTimeRangeData,
  normalizeServerType,
} from '../../tools-ai-sdk/server-metrics/data';
import {
  MONITORING_CAPACITY_FORECAST_CAPABILITY_ID,
  MONITORING_LOCATION_LOAD_BALANCE_CAPABILITY_ID,
} from './constants';

type PercentMetric = 'cpu' | 'memory' | 'disk' | 'network';

interface SnapshotServer {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
  location?: string;
}

interface LocationSummary {
  location: string;
  serverCount: number;
  metrics: Record<`${PercentMetric}_avg`, number>;
  statusCounts: Record<string, number>;
  serverIds: string[];
}

interface CapacityRiskRow {
  server: SnapshotServer;
  metric: PercentMetric;
  current: number;
  threshold: number;
  margin: number;
  slopePerHour: number;
  etaHours: number | null;
}

const LOCATION_LOAD_BALANCE_PATTERN =
  /(?:az\d*|dc\d+-?az\d+|가용\s*영역|availability\s*zone|구역|영역|zone|location|위치).{0,32}(?:부하|로드|load|균형|balance|비교|분산)|(?:부하|로드|load|균형|balance|비교|분산).{0,32}(?:az\d*|dc\d+-?az\d+|가용\s*영역|availability\s*zone|구역|영역|zone|location|위치)/i;
const CAPACITY_FORECAST_PATTERN =
  /(?:언제.{0,24}\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파)|\d{1,3}\s*%?.{0,24}(?:넘|초과|도달|돌파).{0,24}(?:언제|시점|예측)|(?:when|how\s+soon).{0,40}(?:exceed|reach|hit|breach).{0,16}\d{1,3}\s*%?|용량\s*(?:예측|계획|부족|고갈)|capacity\s*(?:forecast|plan|planning|projection)|임계(?:치|값)?.{0,24}(?:도달|초과|넘|시점)|고갈|포화|saturat(?:e|ion)|run\s*out|full\s*capacity)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number): string {
  return `${round1(value)}%`;
}

function formatSignedPercentPoints(value: number): string {
  return `${value >= 0 ? '+' : ''}${round1(value)}%p`;
}

function readSnapshotServers(snapshot: DomainSnapshot): SnapshotServer[] {
  const servers = isRecord(snapshot.data) ? snapshot.data.servers : undefined;
  if (!Array.isArray(servers)) return [];

  return servers
    .filter((server): server is Record<string, unknown> => isRecord(server))
    .map((server) => ({
      id: readString(server.id) ?? '',
      name: readString(server.name),
      type: readString(server.type),
      status: readString(server.status),
      cpu: readFiniteNumber(server.cpu),
      memory: readFiniteNumber(server.memory),
      disk: readFiniteNumber(server.disk),
      network: readFiniteNumber(server.network),
      location: readString(server.location),
    }))
    .filter((server) => server.id.length > 0);
}

function readSnapshotTimeLabel(snapshot: DomainSnapshot): string | undefined {
  return isRecord(snapshot.data) ? readString(snapshot.data.timeLabel) : undefined;
}

function getLocationMap(): Map<string, string> {
  return new Map(
    getAllServerEntries().map((entry) => [entry.serverId, entry.location])
  );
}

function enrichLocations(servers: SnapshotServer[]): SnapshotServer[] {
  const locationMap = getLocationMap();
  return servers.map((server) => ({
    ...server,
    location:
      server.location ??
      locationMap.get(server.id) ??
      (server.id.includes('dc1') ? 'DC1-unknown' : 'unknown'),
  }));
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildLocationSummaries(servers: SnapshotServer[]): LocationSummary[] {
  const groups = new Map<string, SnapshotServer[]>();
  for (const server of servers) {
    const location = server.location ?? 'unknown';
    groups.set(location, [...(groups.get(location) ?? []), server]);
  }

  return Array.from(groups.entries())
    .map(([location, groupServers]) => {
      const metrics: LocationSummary['metrics'] = {
        cpu_avg: average(
          groupServers
            .map((server) => server.cpu)
            .filter((value): value is number => value !== undefined)
        ) ?? 0,
        memory_avg: average(
          groupServers
            .map((server) => server.memory)
            .filter((value): value is number => value !== undefined)
        ) ?? 0,
        disk_avg: average(
          groupServers
            .map((server) => server.disk)
            .filter((value): value is number => value !== undefined)
        ) ?? 0,
        network_avg: average(
          groupServers
            .map((server) => server.network)
            .filter((value): value is number => value !== undefined)
        ) ?? 0,
      };
      const statusCounts = groupServers.reduce<Record<string, number>>(
        (acc, server) => {
          const status = server.status ?? 'unknown';
          acc[status] = (acc[status] ?? 0) + 1;
          return acc;
        },
        {}
      );

      return {
        location,
        serverCount: groupServers.length,
        metrics,
        statusCounts,
        serverIds: groupServers
          .map((server) => server.id)
          .sort((left, right) => left.localeCompare(right)),
      };
    })
    .sort((left, right) => left.location.localeCompare(right.location));
}

function spread(
  summaries: LocationSummary[],
  metric: keyof LocationSummary['metrics']
): number {
  const values = summaries.map((summary) => summary.metrics[metric]);
  return round1(Math.max(...values) - Math.min(...values));
}

function getHighestSummary(
  summaries: LocationSummary[],
  metric: keyof LocationSummary['metrics']
): LocationSummary | null {
  return summaries.reduce<LocationSummary | null>((best, current) => {
    if (!best || current.metrics[metric] > best.metrics[metric]) return current;
    return best;
  }, null);
}

function buildLocationLoadBalanceAnswer(
  snapshot: DomainSnapshot
): string | null {
  const servers = enrichLocations(readSnapshotServers(snapshot));
  if (servers.length === 0) return null;

  const summaries = buildLocationSummaries(servers);
  if (summaries.length === 0) return null;

  const countValues = summaries.map((summary) => summary.serverCount);
  const countSpread = Math.max(...countValues) - Math.min(...countValues);
  const cpuSpread = spread(summaries, 'cpu_avg');
  const memorySpread = spread(summaries, 'memory_avg');
  const diskSpread = spread(summaries, 'disk_avg');
  const highestCpu = getHighestSummary(summaries, 'cpu_avg');
  const timeLabel = readSnapshotTimeLabel(snapshot);

  const countLine = summaries
    .map((summary) => `${summary.location} ${summary.serverCount}대`)
    .join(' / ');
  const metricsLine = summaries
    .map(
      (summary) =>
        `${summary.location}: CPU ${formatPercent(summary.metrics.cpu_avg)}, MEM ${formatPercent(summary.metrics.memory_avg)}, DISK ${formatPercent(summary.metrics.disk_avg)}`
    )
    .join(' / ');

  return [
    '🧭 **AZ별 부하 균형**',
    `• 대상: 전체 ${servers.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''} · ${countLine}`,
    `• 평균 부하: ${metricsLine}`,
    `• 균형 판단: 서버 수 편차 ${countSpread}대, CPU 평균 편차 ${formatSignedPercentPoints(cpuSpread)}, MEM 편차 ${formatSignedPercentPoints(memorySpread)}, DISK 편차 ${formatSignedPercentPoints(diskSpread)}`,
    highestCpu
      ? `• 최고 CPU 평균 AZ: ${highestCpu.location} ${formatPercent(highestCpu.metrics.cpu_avg)} (${highestCpu.serverCount}대)`
      : '• 최고 CPU 평균 AZ: 데이터 없음',
    '• 권고: 서버 수는 AZ별 count와 평균 부하를 함께 보고, CPU/MEM 편차가 10%p 이상 지속되면 트래픽 분산 정책과 배치 작업 위치를 우선 점검하세요.',
  ].join('\n');
}

function normalizeThreshold(value: string): number {
  const threshold = Number(value);
  return Number.isFinite(threshold)
    ? Math.max(1, Math.min(100, threshold))
    : 90;
}

function isReportedUsagePercent(
  message: string,
  match: RegExpMatchArray
): boolean {
  const matchIndex = match.index ?? message.indexOf(match[0]);
  const context = message.slice(
    Math.max(0, matchIndex - 24),
    Math.min(message.length, matchIndex + match[0].length + 12)
  );

  return (
    /(?:현재|지금|current|now).{0,20}\d{1,3}\s*%/i.test(context) ||
    /\d{1,3}\s*%?\s*(?:를|을|이|가)?\s*(?:넘었|초과했|도달했|돌파했|exceeded|reached|breached)/i.test(
      context
    )
  );
}

function parseThreshold(message: string): number {
  const targetPatterns = [
    /(?:when|how\s+soon).{0,40}?(?:exceed|reach|hit|breach).{0,16}?(\d{1,3})\s*%?/i,
    /(?:언제|when).{0,32}?(\d{1,3})\s*%?\s*(?:를|을|이|가)?\s*(?:넘|초과|도달|돌파|exceed|reach|breach)/i,
    /(\d{1,3})\s*%?\s*(?:를|을|이|가)?\s*(?:넘|초과|도달|돌파|exceed|reach|breach)/i,
    /(?:임계(?:치|값)?|threshold).{0,32}?(\d{1,3})\s*%?/i,
    /(\d{1,3})\s*%?\s*(?:기준|까지|임계(?:치|값)?|threshold)/i,
  ];

  for (const [index, pattern] of targetPatterns.entries()) {
    const match = message.match(pattern);
    if (!match?.[1]) continue;
    if (index === 2 && isReportedUsagePercent(message, match)) continue;
    return normalizeThreshold(match[1]);
  }

  const match = message.match(/(\d{1,3})\s*%/);
  if (!match) return 90;
  if (isReportedUsagePercent(message, match)) return 90;
  return normalizeThreshold(match[1]);
}

function parseMetric(message: string, request: DomainEvidenceRequest): PercentMetric | null {
  const frameMetric = request.intentFrame?.metric?.toLowerCase();
  if (
    frameMetric === 'cpu' ||
    frameMetric === 'memory' ||
    frameMetric === 'disk' ||
    frameMetric === 'network'
  ) {
    return frameMetric;
  }

  if (/\bcpu\b|씨피유/i.test(message)) return 'cpu';
  if (/메모리|\bmem\b|\bmemory\b|\bmemori\b|\bmemroy\b/i.test(message)) {
    return 'memory';
  }
  if (/디스크|\bdisk\b|스토리지|\bstorage\b|용량/i.test(message)) {
    return 'disk';
  }
  if (/네트워크|\bnetwork\b|\bnet\b/i.test(message)) return 'network';
  return null;
}

function metricLabel(metric: PercentMetric): string {
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

function inferTargetType(targets: string[] | undefined): string | null {
  for (const target of targets ?? []) {
    const normalized = normalizeServerType(target);
    if (normalized !== 'unknown') return normalized;
  }
  return null;
}

function inferMentionedServerTargets(
  servers: SnapshotServer[],
  message: string
): string[] {
  const normalizedMessage = message.toLowerCase();
  return servers
    .filter((server) => {
      const candidates = [server.id, server.name].filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      );
      return candidates.some((candidate) =>
        normalizedMessage.includes(candidate.toLowerCase())
      );
    })
    .map((server) => server.id);
}

function filterCapacityTargets(
  servers: SnapshotServer[],
  request: DomainEvidenceRequest
): { servers: SnapshotServer[]; label: string } {
  const frameTargets = request.intentFrame?.targets ?? [];
  const targets =
    frameTargets.length > 0
      ? frameTargets
      : inferMentionedServerTargets(servers, request.message);
  if (targets.length === 0) return { servers, label: '전체 서버' };

  const targetIds = new Set(targets);
  const exactMatches = servers.filter((server) => targetIds.has(server.id));
  if (exactMatches.length > 0) {
    return { servers: exactMatches, label: `지정 서버 ${exactMatches.length}대` };
  }

  const targetType = inferTargetType(targets);
  if (!targetType) return { servers, label: '전체 서버' };

  const groupMatches = servers.filter(
    (server) => normalizeServerType(server.type ?? '') === targetType
  );
  return {
    servers: groupMatches,
    label: `${targetType} 그룹 ${groupMatches.length}대`,
  };
}

function calculateSlopePerHour(
  serverId: string,
  metric: PercentMetric,
  current: number
): number {
  const points = getTimeRangeData(serverId, 'last24h');
  if (points.length < 2) return 0;

  const first = points[0]?.[metric];
  const last = points[points.length - 1]?.[metric] ?? current;
  if (typeof first !== 'number' || typeof last !== 'number') return 0;

  const hours = ((points.length - 1) * 10) / 60;
  return hours > 0 ? round1((last - first) / hours) : 0;
}

function buildCapacityForecastAnswer(params: {
  request: DomainEvidenceRequest;
  snapshot: DomainSnapshot;
}): { answer: string; metric: PercentMetric; threshold: number } | null {
  const metric = parseMetric(params.request.message, params.request);
  if (!metric) return null;

  const threshold = parseThreshold(params.request.message);
  const allServers = readSnapshotServers(params.snapshot);
  const target = filterCapacityTargets(allServers, params.request);
  if (target.servers.length === 0) return null;

  const rows: CapacityRiskRow[] = target.servers
    .map((server) => {
      const current = server[metric];
      if (typeof current !== 'number') return null;
      const slopePerHour = calculateSlopePerHour(server.id, metric, current);
      const margin = round1(threshold - current);
      const etaHours =
        current >= threshold
          ? 0
          : slopePerHour > 0
            ? round1((threshold - current) / slopePerHour)
            : null;
      return {
        server,
        metric,
        current,
        threshold,
        margin,
        slopePerHour,
        etaHours,
      };
    })
    .filter((row): row is CapacityRiskRow => row !== null)
    .sort((left, right) => {
      if (left.etaHours === 0 && right.etaHours !== 0) return -1;
      if (right.etaHours === 0 && left.etaHours !== 0) return 1;
      if (left.etaHours !== null && right.etaHours !== null) {
        return left.etaHours - right.etaHours;
      }
      if (left.etaHours !== null) return -1;
      if (right.etaHours !== null) return 1;
      return left.margin - right.margin;
    });

  if (rows.length === 0) return null;

  const metricName = metricLabel(metric);
  const timeLabel = readSnapshotTimeLabel(params.snapshot);
  const projectedRows = rows.filter((row) => row.etaHours !== null);
  const topRows = rows.slice(0, 5);
  const summary =
    projectedRows.length > 0
      ? `${projectedRows[0].server.id}가 가장 먼저 ${threshold}%에 도달할 가능성이 있습니다.`
      : `현재 24h 선형 추세로는 ${threshold}% 초과 예상 서버가 없습니다.`;

  return {
    metric,
    threshold,
    answer: [
      `📈 **${metricName} ${threshold}% 도달 예측**`,
      `• 결론: ${summary}`,
      `• 대상: ${target.label} ${rows.length}대${timeLabel ? ` · 데이터 슬롯 ${timeLabel} KST` : ''}`,
      '• 기준: 최근 24h 선형 추세 기반 추정이며, 배치/장애/트래픽 급증 같은 비선형 이벤트는 별도 로그 확인이 필요합니다.',
      `• 근접/예상 TOP ${topRows.length}: ${topRows
        .map((row) => {
          const etaText =
            row.etaHours === 0
              ? '이미 초과'
              : row.etaHours === null
                ? '현 추세 도달 없음'
                : `${row.etaHours}시간 후`;
          return `${row.server.id} ${formatPercent(row.current)} (여유 ${formatSignedPercentPoints(row.margin)}, 24h 기울기 ${formatSignedPercentPoints(row.slopePerHour)}/h, ${etaText})`;
        })
        .join(', ')}`,
      '• 권고: 가장 근접한 서버부터 로그 적체, 백업/배치 산출물, 최근 배포 후 사용률 변화를 확인하고 증설은 마지막 수단으로 검토하세요.',
    ].join('\n'),
  };
}

async function resolveSnapshot(
  request: DomainEvidenceRequest
): Promise<DomainSnapshot | null> {
  return request.dataSource?.snapshot(request) ?? null;
}

export const monitoringLocationLoadBalanceEvidenceProvider: DomainEvidenceProvider =
  {
    id: 'monitoring-location-load-balance',
    canHandle(request) {
      return LOCATION_LOAD_BALANCE_PATTERN.test(request.message);
    },
    async resolve(request) {
      const snapshot = await resolveSnapshot(request);
      if (!snapshot) return null;
      const answer = buildLocationLoadBalanceAnswer(snapshot);
      if (!answer) return null;

      return {
        id: 'monitoring-location-load-balance',
        prompt: [
          '[결정적 monitoring AZ 부하 균형 근거]',
          '아래 AZ별 서버 수와 평균 CPU/MEM/DISK 수치를 바꾸지 말고 그대로 답하세요.',
          '',
          answer,
        ].join('\n'),
        fallback: answer,
        metadata: {
          responsePolicy: 'deterministic_answer',
          capabilityId: MONITORING_LOCATION_LOAD_BALANCE_CAPABILITY_ID,
          intent: 'location_load_balance',
          timestamp: snapshot.timestamp,
        },
      };
    },
  };

export const monitoringCapacityForecastEvidenceProvider: DomainEvidenceProvider =
  {
    id: 'monitoring-capacity-forecast',
    canHandle(request) {
      return (
        request.intentFrame?.capabilityId ===
          MONITORING_CAPACITY_FORECAST_CAPABILITY_ID ||
        request.intentFrame?.intent === 'capacity_forecast' ||
        CAPACITY_FORECAST_PATTERN.test(request.message)
      );
    },
    async resolve(request) {
      const snapshot = await resolveSnapshot(request);
      if (!snapshot) return null;
      const resolved = buildCapacityForecastAnswer({ request, snapshot });
      if (!resolved) return null;

      return {
        id: 'monitoring-capacity-forecast',
        prompt: [
          '[결정적 monitoring 용량 예측 근거]',
          '아래 서버 ID, 현재값, 임계값, 24h 선형 추세 추정치를 바꾸지 말고 그대로 답하세요.',
          '',
          resolved.answer,
        ].join('\n'),
        fallback: resolved.answer,
        metadata: {
          responsePolicy: 'deterministic_answer',
          capabilityId: MONITORING_CAPACITY_FORECAST_CAPABILITY_ID,
          intent: 'capacity_forecast',
          metric: resolved.metric,
          threshold: resolved.threshold,
          timestamp: snapshot.timestamp,
        },
      };
    },
  };
