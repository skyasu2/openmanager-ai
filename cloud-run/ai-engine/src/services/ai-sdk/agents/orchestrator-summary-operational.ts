import {
  buildSummaryPayloadFromCurrentState,
  toNumber,
  type AlertServerSnapshot,
  type MetricsToolPayload,
  type ServerSnapshot,
} from './orchestrator-summary-payload';
import { getReadOnlyDiagnosticCommands } from '../../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';
import type { DiagnosticMetric } from '../../../tools-ai-sdk/reporter-tools/knowledge-types';

export function isStatusAlertOperationalQuery(query: string): boolean {
  const mentionsAlertStatus =
    /위험\s*\/\s*경고|경고\s*\/\s*위험|(?:위험|critical|경고|warning|주의|alert|알림).{0,20}서버|서버.{0,20}(?:위험|critical|경고|warning|주의|alert|알림)/i.test(
      query
    );
  const asksForOperations =
    /원인|이유|장애|조치|대응|권장|권고|우선순위|해야|운영자|확인/i.test(query);

  return mentionsAlertStatus && asksForOperations;
}

function hasExplicitServerId(query: string): boolean {
  return /\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b/i.test(query);
}

export function isExplicitServerOperationalQuery(query: string): boolean {
  const asksForOperations =
    /원인|이유|장애|조치|대응|권장|권고|우선순위|해야|운영자|확인/i.test(query);
  const asksForExplicitDistribution =
    isPerServerActionRequest(query) ||
    /(?:리소스|성능).{0,10}(?:경고|주의)|(?:top|TOP)\s*\d{1,2}|상위\s*\d{1,2}/i.test(
      query
    );
  return hasExplicitServerId(query) && asksForOperations && asksForExplicitDistribution;
}

function roundPercent(value: number | null): string {
  return value === null ? 'N/A' : `${Math.round(value)}%`;
}

function extractRequestedActionCount(query: string): number | null {
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

function isPerServerActionRequest(query: string): boolean {
  return (
    /(각\s*서버|서버별|서버마다).*(조치|권고|확인\s*항목|확인할\s*항목)/i.test(
      query
    ) ||
    /(조치|권고|확인\s*항목|확인할\s*항목).*(각\s*서버|서버별|서버마다|개씩)/i.test(
      query
    )
  );
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

function toAlertSnapshot(server: ServerSnapshot): AlertServerSnapshot {
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

function buildActionPoolForServer(server: AlertServerSnapshot): string[] {
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
  alertServers: AlertServerSnapshot[],
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

  return actions
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

function getExplicitQueryServers(
  query: string,
  payload: MetricsToolPayload,
  lookupPayload?: MetricsToolPayload | null
): AlertServerSnapshot[] {
  const requestedIds = query.match(/\b[a-z0-9]+(?:-[a-z0-9]+){2,}\b/gi) ?? [];
  const seen = new Set<string>();
  const uniqueRequestedIds = requestedIds.filter((serverId) => {
    const normalizedServerId = serverId.toLowerCase();
    if (seen.has(normalizedServerId)) return false;
    seen.add(normalizedServerId);
    return true;
  });

  const currentStatePayload = lookupPayload ?? buildSummaryPayloadFromCurrentState();
  const lookupServers = [
    ...payload.servers,
    ...(currentStatePayload?.servers ?? []).filter(
      (server) => !payload.servers.some((payloadServer) => payloadServer.id === server.id)
    ),
  ];

  return uniqueRequestedIds
    .map((serverId) =>
      lookupServers.find(
        (server) => server.id.toLowerCase() === serverId.toLowerCase()
      )
    )
    .filter((server): server is ServerSnapshot => Boolean(server))
    .map((server) => toAlertSnapshot(server));
}

function buildCauseLine(server: AlertServerSnapshot): string {
  const dominantMetric = getDominantMetric(server);
  if (dominantMetric.metricLabel === 'CPU') {
    return `• ${server.id}: CPU ${roundPercent(dominantMetric.metricValue)} - 상위 프로세스, 배치 작업, 트래픽 분산 편차 가능성을 우선 점검해야 합니다.`;
  }
  if (dominantMetric.metricLabel === '메모리') {
    return `• ${server.id}: 메모리 ${roundPercent(dominantMetric.metricValue)} - 프로세스 증가, cache/세션 누적, 누수 가능성을 우선 점검해야 합니다.`;
  }
  if (dominantMetric.metricLabel === '디스크') {
    return `• ${server.id}: 디스크 ${roundPercent(dominantMetric.metricValue)} - 로그, 백업 산출물, tmp 파일 증가 가능성을 우선 점검해야 합니다.`;
  }
  return `• ${server.id}: 상태 ${server.status} - 최근 상태 변화 시각과 관련 로그를 우선 점검해야 합니다.`;
}

function isHaproxyDistributionQuery(query: string): boolean {
  return (
    /haproxy|로드\s*밸런서|load\s*balancer|\blb\b/i.test(query) &&
    /백엔드|backend|분산|연결|상태|트래픽/i.test(query)
  );
}

function isHaproxyServer(server: ServerSnapshot): boolean {
  return /haproxy|\blb-/i.test(server.id) || /haproxy|load\s*balancer/i.test(server.name ?? '');
}

export function buildHaproxyDistributionAnswer(
  query: string,
  payload: MetricsToolPayload
): string | null {
  if (!isHaproxyDistributionQuery(query)) {
    return null;
  }

  const haproxyServers = payload.servers
    .filter(isHaproxyServer)
    .sort((left, right) => (toNumber(right.cpu) ?? 0) - (toNumber(left.cpu) ?? 0));

  if (haproxyServers.length === 0) {
    return null;
  }

  const lines = [
    '📊 **HAProxy 상태/분산 점검**',
    '• 현재 도구 근거는 HAProxy 서버 메트릭입니다. 백엔드별 세션 수는 runtime socket의 `show stat` 확인이 필요합니다.',
    '',
    '현재 HAProxy 메트릭',
  ];

  haproxyServers.forEach((server, index) => {
    lines.push(
      `${index + 1}. ${server.id}: CPU ${roundPercent(toNumber(server.cpu))}, 메모리 ${roundPercent(toNumber(server.memory))}, 디스크 ${roundPercent(toNumber(server.disk))} (상태 ${server.status})`
    );
  });

  lines.push(
    '',
    '백엔드 분산 판단 기준',
    '1. `echo "show stat" | socat - /run/haproxy/admin.sock`에서 backend별 `status`, `scur`, `qcur`, `check_status` 편차를 비교하세요.',
    '2. CPU가 70% 이상이면 worker CPU와 active connection 증가가 같이 있는지 먼저 확인하세요.',
    '3. 특정 backend만 세션이 몰리거나 DOWN이면 서버 health check, weight, stick-table 설정을 확인하세요.'
  );

  return lines.join('\n');
}

export function buildExplicitServerOperationalAnswer(
  query: string,
  payload: MetricsToolPayload,
  lookupPayload?: MetricsToolPayload | null
): string | null {
  if (!isExplicitServerOperationalQuery(query)) {
    return null;
  }

  const requestedServers = getExplicitQueryServers(query, payload, lookupPayload);
  if (requestedServers.length === 0) {
    return null;
  }

  const requestedActionCount = extractRequestedActionCount(query) ?? 1;
  const perServerRequest = isPerServerActionRequest(query);
  const actionServers = requestedServers.filter(
    (server) => server.status !== 'offline'
  );
  const actions =
    actionServers.length === 0
      ? []
      : perServerRequest
        ? actionServers.flatMap((server) =>
            buildActionPoolForServer(server).slice(0, requestedActionCount)
          )
        : Array.from({ length: requestedActionCount }, (_, actionIndex) => {
            const server = actionServers[actionIndex % actionServers.length];
            const serverActionIndex = Math.floor(actionIndex / actionServers.length);
            const actionPool = buildActionPoolForServer(server);
            return actionPool[serverActionIndex % actionPool.length];
          });

  const lines = [`📊 **요청 서버 ${requestedServers.length}대 상태**`];
  requestedServers.forEach((server, index) => {
    const dominantMetric = getDominantMetric(server);
    lines.push(
      `${index + 1}. ${server.id}: ${dominantMetric.metricLabel} ${roundPercent(dominantMetric.metricValue)} (상태 ${server.status})`
    );
  });

  lines.push('', '⚠️ **장애 원인 추정**');
  requestedServers.forEach((server) => {
    lines.push(buildCauseLine(server));
  });

  lines.push('', '💡 **즉시 조치**');
  if (actions.length === 0) {
    lines.push('• 오프라인 서버의 헬스체크, 최근 배포 이력, 애플리케이션 로그를 우선 확인하세요.');
  } else {
    actions.forEach((action, index) => {
      lines.push(`${index + 1}. ${action}`);
    });
  }

  return lines.join('\n');
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

function shouldIncludeAttentionServer(query: string): boolean {
  return /(가장|최우선|주의).*(서버|1대)|주의할\s*서버/i.test(query);
}

function shouldIncludeDiagnosticCommands(query: string): boolean {
  return /명령어|command|cli|shell|쉘|터미널|진단|점검\s*명령|확인(?:할|용)?\s*명령/i.test(
    query
  );
}

function getDiagnosticMetricForServer(server: AlertServerSnapshot): {
  metric: DiagnosticMetric;
  label: string;
} {
  const network = toNumber(server.network);
  const maxCoreMetric = Math.max(
    toNumber(server.cpu) ?? 0,
    toNumber(server.memory) ?? 0,
    toNumber(server.disk) ?? 0
  );
  if (network !== null && network >= 80 && network > maxCoreMetric) {
    return { metric: 'status', label: '상태' };
  }

  const dominantMetric = getDominantMetric(server);
  if (dominantMetric.metricKey === 'cpu') {
    return { metric: 'cpu', label: 'CPU' };
  }
  if (dominantMetric.metricKey === 'memory') {
    return { metric: 'memory', label: '메모리' };
  }
  if (dominantMetric.metricKey === 'disk') {
    return { metric: 'disk', label: '디스크' };
  }
  return { metric: 'status', label: '상태' };
}

function inferServerService(server: AlertServerSnapshot): string | undefined {
  const value = `${server.id} ${server.name ?? ''} ${server.type ?? ''}`.toLowerCase();
  if (/redis|cache/.test(value)) return 'redis';
  if (/mysql|db/.test(value)) return 'mysql';
  if (/nginx|web/.test(value)) return 'nginx';
  if (/haproxy|lb/.test(value)) return 'haproxy';
  if (/nfs|storage/.test(value)) return 'nfs';
  return undefined;
}

function buildDiagnosticCommandBlock(server: AlertServerSnapshot): string[] {
  const diagnosticMetric = getDiagnosticMetricForServer(server);
  const commands = getReadOnlyDiagnosticCommands({
    metric: diagnosticMetric.metric,
    service: inferServerService(server),
    limit: 3,
    maxRisk: 'medium',
  });

  if (commands.length === 0) return [];

  return [
    `# ${server.id} ${diagnosticMetric.label}`,
    ...commands.map((command) => command.command),
  ];
}

function appendDiagnosticCommandSection(
  lines: string[],
  servers: AlertServerSnapshot[]
): void {
  const blocks = servers
    .map(buildDiagnosticCommandBlock)
    .filter((block) => block.length > 0);
  if (blocks.length === 0) return;

  lines.push('', '🔎 **진단 명령어 (읽기 전용)**', '```bash');
  blocks.forEach((block, index) => {
    if (index > 0) lines.push('');
    lines.push(...block);
  });
  lines.push('```');
}

export function buildSummaryFromPayloadForQuery(
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

  if (shouldIncludeDiagnosticCommands(query)) {
    const attentionServer = getAttentionServer(payload);
    const diagnosticServers =
      activeAlerts.length > 0
        ? activeAlerts.slice(0, 2)
        : attentionServer
          ? [attentionServer]
          : [];
    appendDiagnosticCommandSection(lines, diagnosticServers);
  }

  return lines.join('\n');
}
