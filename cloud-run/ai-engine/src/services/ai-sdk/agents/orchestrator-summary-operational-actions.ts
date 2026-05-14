import {
  toNumber,
  type AlertServerSnapshot,
  type MetricsToolPayload,
  type ServerSnapshot,
} from './orchestrator-summary-payload';

export function roundPercent(value: number | null): string {
  return value === null ? 'N/A' : `${Math.round(value)}%`;
}

export function extractRequestedActionCount(query: string): number | null {
  const patterns = [
    /(?:즉시\s*)?(?:조치|권고|확인\s*항목|확인할\s*항목)\s*(\d{1,2})\s*(?:개|가지)?/,
    /(\d{1,2})\s*(?:개|가지)\s*(?:즉시\s*)?(?:조치|권고|확인\s*항목|확인할\s*항목)/,
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

function extractMentionedServerCount(query: string): number | null {
  const match = query.match(/(\d{1,2})\s*대/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 20) : null;
}

export function isPerServerActionRequest(query: string): boolean {
  return (
    /(각\s*서버|서버별|서버마다).*(조치|권고|확인\s*항목|확인할\s*항목)/i.test(
      query
    ) ||
    /(조치|권고|확인\s*항목|확인할\s*항목).*(각\s*서버|서버별|서버마다|개씩)/i.test(
      query
    )
  );
}

export function average(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => value !== null);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

export function deriveAlertServers(
  payload: MetricsToolPayload
): AlertServerSnapshot[] {
  if (payload.alertServers && payload.alertServers.length > 0) {
    return payload.alertServers;
  }

  return payload.servers
    .filter((server) =>
      ['warning', 'critical', 'offline'].includes(server.status)
    )
    .map((server) => ({
      id: server.id,
      name: server.name,
      type: server.type,
      status: server.status,
      cpu: server.cpu,
      memory: server.memory,
      disk: server.disk,
      network: server.network,
      dailyAvg: {
        cpu: toNumber(server.dailyTrend?.cpu?.avg ?? null) ?? undefined,
        memory: toNumber(server.dailyTrend?.memory?.avg ?? null) ?? undefined,
        disk: toNumber(server.dailyTrend?.disk?.avg ?? null) ?? undefined,
      },
    }));
}

export function toAlertSnapshot(
  server: ServerSnapshot
): AlertServerSnapshot {
  return {
    id: server.id,
    name: server.name,
    type: server.type,
    status: server.status,
    cpu: server.cpu,
    memory: server.memory,
    disk: server.disk,
    network: server.network,
    dailyAvg: {
      cpu: toNumber(server.dailyTrend?.cpu?.avg ?? null) ?? undefined,
      memory: toNumber(server.dailyTrend?.memory?.avg ?? null) ?? undefined,
      disk: toNumber(server.dailyTrend?.disk?.avg ?? null) ?? undefined,
    },
  };
}

export function getDominantMetric(alertServer: AlertServerSnapshot): {
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

export function formatTrendLabel(trendLabel: string): string {
  if (trendLabel === 'rising') return '상승 추세 ↑';
  if (trendLabel === 'falling') return '하락 추세 ↓';
  return '안정 추세 →';
}

export function getAttentionServer(
  payload: MetricsToolPayload
): AlertServerSnapshot | null {
  const alertServers = getPrioritizedActionServers(payload);
  if (alertServers.length > 0) {
    return alertServers[0];
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

function getPrioritizedActionServers(
  payload: MetricsToolPayload
): AlertServerSnapshot[] {
  return deriveAlertServers(payload)
    .filter((server) => server.status !== 'offline')
    .sort((left, right) => {
      const leftPriority =
        left.status === 'critical' ? 0 : left.status === 'warning' ? 1 : 2;
      const rightPriority =
        right.status === 'critical' ? 0 : right.status === 'warning' ? 1 : 2;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return (
        (getDominantMetric(right).metricValue ?? 0) -
        (getDominantMetric(left).metricValue ?? 0)
      );
    });
}

export function buildActionPoolForServer(
  server: AlertServerSnapshot
): string[] {
  const dominantMetric = getDominantMetric(server);
  if (dominantMetric.metricLabel === 'CPU') {
    return [
      `${server.id}: 상위 프로세스와 스레드/worker 점유율을 확인하세요.`,
      `${server.id}: 최근 배포, 배치 작업, 트래픽 분산 편차를 함께 확인하세요.`,
      `${server.id}: 같은 추세가 10분 이상 지속되면 LB 분산 정책과 캐시/쿼리 설정을 조정하세요.`,
    ];
  }

  if (dominantMetric.metricLabel === '메모리') {
    return [
      `${server.id}: 메모리 상위 프로세스와 OOM/GC 로그를 확인하세요.`,
      `${server.id}: cache eviction, 세션 증가, 누수 가능성을 우선 점검하세요.`,
      `${server.id}: 최근 배포 후 heap/connection 증가 추세를 비교하세요.`,
    ];
  }

  if (dominantMetric.metricLabel === '디스크') {
    return [
      `${server.id}: 로그 적체와 임시 파일 증가 경로를 확인하세요.`,
      `${server.id}: 백업 산출물과 회전 정책이 정상 동작하는지 점검하세요.`,
      `${server.id}: 대용량 파일 생성 프로세스와 보존 기간 설정을 확인하세요.`,
    ];
  }

  return [
    `${server.id}: 헬스체크, 최근 배포 이력, 애플리케이션 로그를 확인하세요.`,
    `${server.id}: 알림 발생 시각 전후의 트래픽과 배치 작업을 비교하세요.`,
    `${server.id}: 동일 증상이 지속되면 관련 인스턴스를 분산 또는 격리하세요.`,
  ];
}

function buildActionItems(
  payload: MetricsToolPayload,
  query: string
): string | null {
  const requestedCount = extractRequestedActionCount(query);
  if (!requestedCount) {
    return null;
  }

  const perServerRequest = isPerServerActionRequest(query);
  const mentionedServerCount = extractMentionedServerCount(query);
  const prioritizedServers = getPrioritizedActionServers(payload);
  const fallbackAttentionServer = getAttentionServer(payload);
  const actionServers =
    prioritizedServers.length > 0
      ? prioritizedServers.slice(
          0,
          mentionedServerCount
            ? Math.min(mentionedServerCount, prioritizedServers.length)
            : prioritizedServers.length
        )
      : fallbackAttentionServer
        ? [fallbackAttentionServer]
        : [];

  if (actionServers.length === 0) {
    return null;
  }

  const actions = perServerRequest
    ? actionServers.flatMap((server) =>
        buildActionPoolForServer(server).slice(0, requestedCount)
      )
    : Array.from({ length: requestedCount }, (_, actionIndex) => {
        const server = actionServers[actionIndex % actionServers.length];
        const serverActionIndex = Math.floor(actionIndex / actionServers.length);
        const actionPool = buildActionPoolForServer(server);
        return actionPool[serverActionIndex % actionPool.length];
      });

  return actions.map((action, index) => `${index + 1}. ${action}`).join('\n');
}

export function buildRecommendation(
  alertServers: AlertServerSnapshot[],
  payload: MetricsToolPayload,
  query: string
): string {
  const requestedActions = buildActionItems(payload, query);
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
