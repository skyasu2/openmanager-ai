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
const CPU_RANKING_QUERY_PATTERN =
  /(cpu|CPU|씨피유).*(높|상위|top|TOP|가장|순서|랭킹|ranking)|(높|상위|top|TOP|가장).*(cpu|CPU|씨피유)/i;
const DISK_THRESHOLD_QUERY_PATTERN =
  /((disk|DISK|디스크).*(사용률|usage)?.*(\d{1,3})\s*%?\s*(이상|초과|>=|넘))|((\d{1,3})\s*%?\s*(이상|초과|>=|넘).*(disk|DISK|디스크))/i;

export function isDeterministicSummaryQuery(
  query: string,
  agentName: string
): boolean {
  if (
    DISK_THRESHOLD_QUERY_PATTERN.test(query) &&
    (agentName === 'NLQ Agent' || agentName === 'Analyst Agent')
  ) {
    return true;
  }

  return (
    agentName === 'NLQ Agent' &&
    (SUMMARY_QUERY_PATTERN.test(query) || CPU_RANKING_QUERY_PATTERN.test(query))
  );
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

function extractRequestedServerCount(query: string, fallback = 3): number {
  const patterns = [
    /(?:상위|top)\s*(\d{1,2})/i,
    /(\d{1,2})\s*대/,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > 0) {
      return Math.min(parsed, 10);
    }
  }

  return fallback;
}

function extractDiskThreshold(query: string, fallback = 70): number {
  const patterns = [
    /(disk|DISK|디스크).*?(\d{1,3})\s*%?\s*(이상|초과|>=|넘)/i,
    /(\d{1,3})\s*%?\s*(이상|초과|>=|넘).*?(disk|DISK|디스크)/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (!match) continue;
    const rawValue = match[2] ?? match[1];
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
  }

  return fallback;
}

function extractRequestedActionCount(query: string): number | null {
  const patterns = [
    /(?:즉시\s*)?(?:조치|권고|확인\s*항목|확인할\s*항목)\s*(\d{1,2})\s*개/,
    /(\d{1,2})\s*개\s*(?:즉시\s*)?(?:조치|권고|확인\s*항목|확인할\s*항목)/,
    /서버별로\s*(\d{1,2})\s*개/,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isInteger(parsed) && parsed > 0) {
      return Math.min(parsed, 10);
    }
  }

  return null;
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

function toAlertSnapshot(server: ServerSnapshot): AlertServerSnapshot {
  return {
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
  };
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

function getAttentionServer(payload: MetricsToolPayload): AlertServerSnapshot | null {
  const alertServers = deriveAlertServers(payload);
  const activeAlerts = alertServers.filter((server) => server.status !== 'offline');
  if (activeAlerts.length > 0) {
    return [...activeAlerts].sort((left, right) => {
      const leftPriority =
        left.status === 'critical' ? 0 : left.status === 'warning' ? 1 : 2;
      const rightPriority =
        right.status === 'critical' ? 0 : right.status === 'warning' ? 1 : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return (
        (getDominantMetric(right).metricValue ?? 0) -
        (getDominantMetric(left).metricValue ?? 0)
      );
    })[0];
  }

  const topServer = [...payload.servers]
    .filter((server) => server.status !== 'offline')
    .sort((left, right) => {
      const leftMetric = Math.max(
        toNumber(left.cpu) ?? 0,
        toNumber(left.memory) ?? 0,
        toNumber(left.disk) ?? 0
      );
      const rightMetric = Math.max(
        toNumber(right.cpu) ?? 0,
        toNumber(right.memory) ?? 0,
        toNumber(right.disk) ?? 0
      );
      return rightMetric - leftMetric;
    })[0];

  return topServer ? toAlertSnapshot(topServer) : null;
}

function buildActionItems(
  alertServers: AlertServerSnapshot[],
  payload: MetricsToolPayload,
  query: string
): string | null {
  const requestedCount = extractRequestedActionCount(query);
  if (!requestedCount) {
    return null;
  }

  const attentionServer = getAttentionServer(payload);
  if (!attentionServer) {
    return null;
  }

  const dominantMetric = getDominantMetric(attentionServer);
  const actionPool =
    dominantMetric.metricLabel === 'CPU'
      ? [
          `${attentionServer.id}: 상위 프로세스와 스레드/worker 점유율을 확인하세요.`,
          `${attentionServer.id}: 최근 배포, 배치 작업, 트래픽 분산 편차를 함께 확인하세요.`,
          `${attentionServer.id}: 같은 추세가 10분 이상 지속되면 LB 분산 정책과 캐시/쿼리 설정을 조정하세요.`,
        ]
      : dominantMetric.metricLabel === '메모리'
        ? [
            `${attentionServer.id}: 메모리 상위 프로세스와 OOM/GC 로그를 확인하세요.`,
            `${attentionServer.id}: cache eviction, 세션 증가, 누수 가능성을 우선 점검하세요.`,
            `${attentionServer.id}: 최근 배포 후 heap/connection 증가 추세를 비교하세요.`,
          ]
        : dominantMetric.metricLabel === '디스크'
          ? [
              `${attentionServer.id}: 로그 적체와 임시 파일 증가 경로를 확인하세요.`,
              `${attentionServer.id}: 백업 산출물과 회전 정책이 정상 동작하는지 점검하세요.`,
              `${attentionServer.id}: 대용량 파일 생성 프로세스와 보존 기간 설정을 확인하세요.`,
            ]
          : [
              `${attentionServer.id}: 헬스체크, 최근 배포 이력, 애플리케이션 로그를 확인하세요.`,
              `${attentionServer.id}: 알림 발생 시각 전후의 트래픽과 배치 작업을 비교하세요.`,
              `${attentionServer.id}: 동일 증상이 지속되면 관련 인스턴스를 분산 또는 격리하세요.`,
            ];

  return actionPool
    .slice(0, requestedCount)
    .map((action, index) => `${index + 1}. ${action}`)
    .join('\n');
}

function buildRecommendation(
  alertServers: AlertServerSnapshot[],
  payload: MetricsToolPayload,
  query: string
): string {
  const requestedActions = buildActionItems(alertServers, payload, query);
  if (requestedActions) {
    return requestedActions;
  }

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
  return buildSummaryFromPayloadForQuery('', payload);
}

function shouldIncludeAttentionServer(query: string): boolean {
  return /(가장|최우선|주의).*(서버|1대)|주의할\s*서버/i.test(query);
}

function buildSummaryFromPayloadForQuery(
  query: string,
  payload: MetricsToolPayload
): string {
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
    `• 전체 ${totalServers}대: 정상 ${onlineCount}대, 경고 ${warningCount}대, 위험 ${criticalCount}대, 오프라인 ${offlineCount}대`,
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
    if (shouldIncludeAttentionServer(query)) {
      const attentionServer = getAttentionServer(payload);
      if (attentionServer) {
        const dominantMetric = getDominantMetric(attentionServer);
        lines.push(
          `• 관찰 우선: ${attentionServer.id}: ${dominantMetric.metricLabel} ${roundPercent(dominantMetric.metricValue)} (현재 최고 리소스)`
        );
      }
    }
  } else {
    for (const alertServer of activeAlerts) {
      const dominantMetric = getDominantMetric(alertServer);
      lines.push(
        `• ${alertServer.id}: ${dominantMetric.metricLabel} ${roundPercent(dominantMetric.metricValue)} (${formatTrendLabel(dominantMetric.trendLabel)})`
      );
    }
  }

  lines.push('', '📈 **추세**', buildTrendSummary(alertServers), '', '💡 **권고**');
  lines.push(buildRecommendation(alertServers, payload, query));

  return lines.join('\n');
}

function buildCpuCheckItem(server: ServerSnapshot): string {
  if (server.id.includes('lb-')) {
    return 'HAProxy worker CPU, active connection, backend 분산 편차를 확인하세요.';
  }
  if (server.id.includes('api-') || server.id.includes('was-')) {
    return '상위 프로세스와 최근 배포/배치 작업의 CPU 증가 여부를 확인하세요.';
  }
  if (server.id.includes('db-')) {
    return '슬로우 쿼리, connection 수, 백그라운드 job CPU 점유를 확인하세요.';
  }
  if (server.id.includes('storage-')) {
    return 'NFS/스토리지 프로세스의 iowait 동반 여부와 클라이언트 요청 급증을 확인하세요.';
  }
  if (server.id.includes('cache-')) {
    return 'Redis command 폭증, eviction, persistence 작업 여부를 확인하세요.';
  }
  return '상위 프로세스, 예약 작업, 최근 배포 전후 CPU 변화를 확인하세요.';
}

function getDiskRiskLabel(disk: number | null): string {
  if (disk === null) return '데이터 없음';
  if (disk >= 85) return '매우 높음';
  if (disk >= 80) return '높음';
  return '주의';
}

function getDiskFailureWindow(disk: number | null): string {
  if (disk === null) return '추정 불가';
  if (disk >= 85) return '즉시~30분 내 쓰기 실패 또는 로그 적체 위험';
  if (disk >= 80) return '수 시간 내 임계치 85% 도달 가능';
  return '24시간 내 증가 추세 재확인 필요';
}

function buildDiskCheckItem(server: ServerSnapshot): string {
  if (server.id.includes('backup')) {
    return '백업 산출물 보존 기간, 증분 백업 크기, 오래된 dump 정리를 확인하세요.';
  }
  if (server.id.includes('storage-') || server.id.includes('nfs')) {
    return 'NFS/export 사용량, 대용량 파일 생성 클라이언트, inode 사용률을 확인하세요.';
  }
  if (server.id.includes('db-')) {
    return 'WAL/binlog, slow log, 임시 테이블 파일과 백업 디렉터리를 확인하세요.';
  }
  if (server.id.includes('api-') || server.id.includes('was-')) {
    return '애플리케이션 로그 회전, 업로드 임시 파일, 배포 산출물 누적을 확인하세요.';
  }
  return '로그 적체, tmp 디렉터리, 대용량 파일 생성 프로세스를 확인하세요.';
}

function buildDiskThresholdRankingFromPayload(
  query: string,
  payload: MetricsToolPayload
): string {
  const threshold = extractDiskThreshold(query);
  const matchedServers = [...payload.servers]
    .filter((server) => server.status !== 'offline')
    .map((server) => ({ server, disk: toNumber(server.disk) }))
    .filter(
      (entry): entry is { server: ServerSnapshot; disk: number } =>
        entry.disk !== null && entry.disk >= threshold
    )
    .sort((left, right) => right.disk - left.disk);

  const lines = [
    `📊 **DISK 사용률 ${threshold}% 이상 서버 ${matchedServers.length}대**`,
    `• 기준: 전체 ${payload.servers.length}대 중 DISK >= ${threshold}%`,
  ];

  if (matchedServers.length === 0) {
    lines.push('• 현재 기준을 초과한 서버는 없습니다.');
    return lines.join('\n');
  }

  matchedServers.forEach(({ server, disk }, index) => {
    lines.push(
      `${index + 1}. ${server.id}: DISK ${roundPercent(disk)} (상태 ${server.status}, 위험도 ${getDiskRiskLabel(disk)})`
    );
  });

  lines.push('', '⏱️ **잠재적 장애 시점**');
  matchedServers.forEach(({ server, disk }, index) => {
    lines.push(`${index + 1}. ${server.id}: ${getDiskFailureWindow(disk)}`);
  });

  lines.push('', '💡 **권장 조치**');
  matchedServers.forEach(({ server }, index) => {
    lines.push(`${index + 1}. ${server.id}: ${buildDiskCheckItem(server)}`);
  });

  return lines.join('\n');
}

function buildCpuRankingFromPayload(query: string, payload: MetricsToolPayload): string {
  const requestedCount = extractRequestedServerCount(query, 3);
  const topServers = [...payload.servers]
    .filter((server) => server.status !== 'offline')
    .sort((left, right) => (toNumber(right.cpu) ?? -1) - (toNumber(left.cpu) ?? -1))
    .slice(0, requestedCount);

  const lines = [`📊 **CPU 사용률 상위 ${requestedCount}대**`];
  topServers.forEach((server, index) => {
    lines.push(`${index + 1}. ${server.id}: CPU ${roundPercent(toNumber(server.cpu))}`);
  });

  lines.push('', '💡 **서버별 확인 항목**');
  topServers.forEach((server, index) => {
    lines.push(`${index + 1}. ${server.id}: ${buildCpuCheckItem(server)}`);
  });

  return lines.join('\n');
}

function buildDeterministicAnswerFromPayload(
  query: string,
  payload: MetricsToolPayload
): string {
  if (DISK_THRESHOLD_QUERY_PATTERN.test(query)) {
    return buildDiskThresholdRankingFromPayload(query, payload);
  }

  if (CPU_RANKING_QUERY_PATTERN.test(query)) {
    return buildCpuRankingFromPayload(query, payload);
  }

  return buildSummaryFromPayloadForQuery(query, payload);
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

  return buildDeterministicAnswerFromPayload(query, payload);
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

  return buildDeterministicAnswerFromPayload(query, payload);
}
