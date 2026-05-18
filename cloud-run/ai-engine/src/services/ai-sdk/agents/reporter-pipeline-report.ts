import { STATUS_THRESHOLDS } from '../../../config/status-thresholds';
import { getTrendPredictor } from '../../../lib/ai/monitoring/TrendPredictor';
import { logger } from '../../../lib/logger';

type MonitoringMetric = 'cpu' | 'memory' | 'disk' | 'network';

interface MonitoringServerState {
  id: string;
  name: string;
  type?: string;
  status: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
}

interface MonitoringState {
  timestamp?: string;
  servers: MonitoringServerState[];
}

interface MonitoringHistorySlot {
  timestamp?: string;
  timestampMs?: number;
  servers: Array<Partial<Record<MonitoringMetric, number>> & { id: string }>;
}

interface MetricDataPoint {
  timestamp: number;
  value: number;
}

const TIMELINE_METRICS = [
  { key: 'cpu', label: 'CPU' },
  { key: 'memory', label: 'Memory' },
  { key: 'disk', label: 'Disk' },
] as const satisfies Array<{ key: Extract<MonitoringMetric, 'cpu' | 'memory' | 'disk'>; label: string }>;

const COMMAND_TEMPLATES: Record<string, string[]> = {
  cpu: [
    'top -o %CPU -b -n 1 | head -20',
    'ps aux --sort=-%cpu | head -10',
    'htop -d 1',
  ],
  memory: ['free -h', 'ps aux --sort=-%mem | head -10', 'vmstat 1 5'],
  disk: ['df -h', 'du -sh /* 2>/dev/null | sort -hr | head -10'],
  network: ['netstat -tuln', 'ss -tuln'],
  general: ['systemctl status', 'journalctl -xe --no-pager | tail -50'],
};

const SERVER_TYPE_COMMANDS: Record<string, Record<string, string[]>> = {
  database: {
    cpu: ['SHOW FULL PROCESSLIST;', 'mysqladmin processlist'],
    memory: [
      'redis-cli INFO memory',
      'mysql -e "SHOW STATUS LIKE \'Innodb_buffer_pool%\'"',
    ],
    general: ['mysql -e "SHOW GLOBAL STATUS"'],
  },
  cache: {
    cpu: ['redis-cli SLOWLOG GET 10'],
    memory: ['redis-cli INFO memory', 'redis-cli CONFIG GET maxmemory*'],
    general: ['redis-cli PING'],
  },
  application: {
    cpu: ['jstack <PID>', 'top -H -p <PID>'],
    memory: ['jmap -heap <PID>'],
    general: ['journalctl -u app-server --since "1h ago"'],
  },
  web: {
    general: [
      'systemctl status nginx',
      'tail -100 /var/log/nginx/error.log',
    ],
  },
  loadbalancer: {
    general: ['haproxy -c -f /etc/haproxy/haproxy.cfg'],
  },
};

export interface ReportForEvaluation {
  title: string;
  summary: string;
  affectedServers: Array<{
    id: string;
    name: string;
    status: string;
    primaryIssue: string;
  }>;
  timeline: Array<{
    timestamp: string;
    eventType: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
  }>;
  rootCause: {
    cause: string;
    confidence: number;
    evidence: string[];
    suggestedFix: string;
  } | null;
  suggestedActions: string[];
  similarCases?: string[];
  sla?: {
    targetUptime: number;
    actualUptime: number;
    slaViolation: boolean;
  };
  warnings?: Array<{
    serverId: string;
    serverName: string;
    metric: string;
    currentValue: number;
    threshold: number;
    gap: number;
  }>;
  predictions?: Array<{
    serverId: string;
    serverName: string;
    metric: string;
    currentValue: number;
    predictedValue: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    confidence: number;
    thresholdBreachHumanReadable: string | null;
  }>;
  markdown?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toMonitoringServer(value: unknown): MonitoringServerState | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : value.id,
    ...(typeof value.type === 'string' && { type: value.type }),
    status: typeof value.status === 'string' ? value.status : 'online',
    cpu: toFiniteNumber(value.cpu),
    memory: toFiniteNumber(value.memory),
    disk: toFiniteNumber(value.disk),
    network: toFiniteNumber(value.network),
  };
}

function toMonitoringState(value: unknown): MonitoringState | null {
  if (!isRecord(value) || !Array.isArray(value.servers)) {
    return null;
  }

  const servers = value.servers
    .map(toMonitoringServer)
    .filter((server): server is MonitoringServerState => server !== null);
  if (servers.length === 0) {
    return null;
  }

  return {
    ...(typeof value.timestamp === 'string' && { timestamp: value.timestamp }),
    servers,
  };
}

function toMonitoringHistorySlot(value: unknown): MonitoringHistorySlot | null {
  if (!isRecord(value)) {
    return null;
  }

  const source = isRecord(value.data) ? value.data : value;
  if (!Array.isArray(source.servers)) {
    return null;
  }

  const servers = source.servers
    .filter((server): server is Record<string, unknown> => isRecord(server) && typeof server.id === 'string')
    .map((server) => ({
      id: server.id as string,
      cpu: typeof server.cpu === 'number' ? server.cpu : undefined,
      memory: typeof server.memory === 'number' ? server.memory : undefined,
      disk: typeof server.disk === 'number' ? server.disk : undefined,
      network: typeof server.network === 'number' ? server.network : undefined,
    }));
  if (servers.length === 0) {
    return null;
  }

  const timestamp =
    typeof value.timestamp === 'string'
      ? value.timestamp
      : typeof source.timestamp === 'string'
        ? source.timestamp
        : typeof source.fullTimestamp === 'string'
          ? source.fullTimestamp
          : undefined;
  const timestampMs = timestamp ? Date.parse(timestamp) : NaN;

  return {
    ...(timestamp && { timestamp }),
    ...(Number.isFinite(timestampMs) && { timestampMs }),
    servers,
  };
}

function toMonitoringHistory(value: unknown[] | undefined): MonitoringHistorySlot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const slots = value
    .map(toMonitoringHistorySlot)
    .filter((slot): slot is MonitoringHistorySlot => slot !== null);

  if (slots.every((slot) => typeof slot.timestampMs === 'number')) {
    return slots
      .slice()
      .sort((left, right) => left.timestampMs! - right.timestampMs!);
  }

  return slots;
}

function toTrendDataPoints(points: MetricDataPoint[]): Array<{ timestamp: number; value: number }> {
  return points.map((point) => ({ timestamp: point.timestamp, value: point.value }));
}

function buildHistoryForMetric(
  history: MonitoringHistorySlot[],
  serverId: string,
  metric: MonitoringMetric,
  currentValue: number
): MetricDataPoint[] {
  const now = Date.now();
  const baseTime = now - (now % (10 * 60 * 1000));
  const entries = history.slice(-36).flatMap((slot) => {
    const value = slot.servers.find((server) => server.id === serverId)?.[metric];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return [];
    }

    return [{ timestamp: slot.timestampMs, value }];
  });

  if (entries.length === 0) {
    return Array.from({ length: 36 }, (_, index) => ({
      timestamp: baseTime - (35 - index) * 600000,
      value: currentValue,
    }));
  }

  return entries.map((entry, index) => ({
    timestamp:
      entry.timestamp ?? baseTime - (entries.length - 1 - index) * 600000,
    value: entry.value,
  }));
}

export function getServerTypeFromMonitoringState(
  stateInput: unknown,
  serverId: string | undefined
): string | undefined {
  if (!serverId) return undefined;
  return toMonitoringState(stateInput)?.servers.find((server) => server.id === serverId)?.type;
}

export function getMetricAverageFromMonitoringHistory(
  historyInput: unknown[] | undefined,
  serverId: string,
  metric: MonitoringMetric
): number | null {
  const values = toMonitoringHistory(historyInput)
    .map((slot) => slot.servers.find((server) => server.id === serverId)?.[metric])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

// 히스토리 슬롯의 실제 timestamp를 사용해 타임라인 구성.
// 히스토리 → 현재 순으로 첫 번째 임계 초과 이벤트를 기록하고 중복을 제거한다.
function buildTimelineFromHistory(
  history: MonitoringHistorySlot[],
  state: MonitoringState,
  thresholds: { cpu: number; memory: number; disk: number },
  serverNameMap: Map<string, string>,
  now: Date
): ReportForEvaluation['timeline'] {
  const timeline: ReportForEvaluation['timeline'] = [];
  const seenBreaches = new Set<string>();

  for (const slot of history) {
    const slotTs = slot.timestamp ?? now.toISOString();
    for (const server of slot.servers) {
      const name = serverNameMap.get(server.id) ?? server.id;
      for (const metric of TIMELINE_METRICS) {
        const value = server[metric.key];
        if (typeof value !== 'number' || value < thresholds[metric.key]) {
          continue;
        }

        const key = `${server.id}:${metric.key}`;
        if (!seenBreaches.has(key)) {
          seenBreaches.add(key);
          timeline.push({
            timestamp: slotTs,
            eventType: 'threshold_breach',
            severity: value >= 90 ? 'critical' : 'warning',
            description: `${name}: ${metric.label} ${value.toFixed(1)}%`,
          });
        }
      }
    }
  }

  // 히스토리에 없던 신규 임계 초과(현재 상태)
  for (const server of state.servers) {
    for (const metric of TIMELINE_METRICS) {
      const value = server[metric.key];
      if (value < thresholds[metric.key] || seenBreaches.has(`${server.id}:${metric.key}`)) {
        continue;
      }

      timeline.push({
        timestamp: now.toISOString(),
        eventType: 'threshold_breach',
        severity: value >= 90 ? 'critical' : 'warning',
        description: `${server.name}: ${metric.label} ${value.toFixed(1)}%`,
      });
    }
  }

  return timeline;
}

// 히스토리 슬롯에서 critical 임계 초과 비율로 실제 uptime 계산.
function calculateActualUptime(
  history: MonitoringHistorySlot[],
  state: MonitoringState
): { targetUptime: number; actualUptime: number; slaViolation: boolean } {
  const criticalThreshold = 90;
  const target = 99.9;
  const shortWindowViolationThreshold = 95;

  if (history.length === 0) {
    const hasIssue = state.servers.some(
      (s) => s.cpu >= criticalThreshold || s.memory >= criticalThreshold
    );
    const actual = hasIssue ? 98.5 : 99.9;
    return {
      targetUptime: target,
      actualUptime: actual,
      slaViolation: actual < shortWindowViolationThreshold,
    };
  }

  const healthySlots = history.filter(
    (slot) =>
      !slot.servers.some(
        (s) =>
          (typeof s.cpu === 'number' && s.cpu >= criticalThreshold) ||
          (typeof s.memory === 'number' && s.memory >= criticalThreshold)
      )
  ).length;

  const actual = Math.round((healthySlots / history.length) * 1000) / 10;
  return {
    targetUptime: target,
    actualUptime: actual,
    slaViolation: actual < shortWindowViolationThreshold,
  };
}

// 실행 가능한 CLI 명령어를 포함한 권장 조치 목록 생성.
function buildSuggestedActions(
  affectedServers: ReportForEvaluation['affectedServers']
): string[] {
  if (affectedServers.length === 0) {
    return [
      '전체 서버 리소스 점검\n   명령어: `top -o %CPU -b -n 1 | head -20`',
      '디스크 사용량 확인\n   명령어: `df -h`',
      '시스템 로그 이상 확인\n   명령어: `journalctl -xe --no-pager | tail -50`',
    ];
  }

  const actions: string[] = [];
  const hasCpu = affectedServers.some((s) => s.primaryIssue.includes('CPU'));
  const hasMem = affectedServers.some(
    (s) => s.primaryIssue.includes('Memory') || s.primaryIssue.includes('메모리')
  );
  const hasDisk = affectedServers.some(
    (s) => s.primaryIssue.includes('Disk') || s.primaryIssue.includes('디스크')
  );

  if (hasCpu) {
    actions.push('CPU 사용량 점검\n   명령어: `top -o %CPU -b -n 1 | head -20`');
    actions.push('CPU 집중 프로세스 확인\n   명령어: `ps aux --sort=-%cpu | head -10`');
  }
  if (hasMem) {
    actions.push('메모리 사용량 확인\n   명령어: `free -h`');
    actions.push('메모리 집중 프로세스 확인\n   명령어: `ps aux --sort=-%mem | head -10`');
  }
  if (hasDisk) {
    actions.push('디스크 사용량 확인\n   명령어: `df -h`');
    actions.push('대용량 파일 탐색\n   명령어: `du -sh /* 2>/dev/null | sort -hr | head -10`');
  }
  if (actions.length === 0) {
    actions.push('시스템 상태 점검\n   명령어: `systemctl status`');
  }
  actions.push('시스템 로그 확인\n   명령어: `journalctl -xe --no-pager | tail -50`');

  return actions;
}

function buildPredictionTargets(
  affectedServers: ReportForEvaluation['affectedServers'],
  warnings: NonNullable<ReportForEvaluation['warnings']>
): ReportForEvaluation['affectedServers'] {
  const targets = new Map<string, ReportForEvaluation['affectedServers'][number]>();

  for (const server of affectedServers) {
    targets.set(server.id, server);
  }

  for (const warning of warnings) {
    if (warning.currentValue < 70) {
      continue;
    }

    if (!targets.has(warning.serverId)) {
      targets.set(warning.serverId, {
        id: warning.serverId,
        name: warning.serverName,
        status: 'online',
        primaryIssue: `${warning.metric.toUpperCase()} ${warning.currentValue.toFixed(1)}% 임계 근접`,
      });
    }
  }

  return Array.from(targets.values());
}

export function generateInitialReport(
  stateInput?: unknown,
  historyInput?: unknown[]
): ReportForEvaluation | null {
  try {
    const state = toMonitoringState(stateInput);
    if (!state) {
      return null;
    }
    const history = toMonitoringHistory(historyInput);
    const now = new Date();
    const serverNameMap = new Map(state.servers.map((s) => [s.id, s.name]));

    const affectedServers = state.servers
      .filter((server) => server.status === 'warning' || server.status === 'critical')
      .map((server) => {
        let primaryIssue = '정상';
        if (server.cpu >= 90) {
          primaryIssue = `CPU ${server.cpu.toFixed(1)}%`;
        } else if (server.memory >= 90) {
          primaryIssue = `Memory ${server.memory.toFixed(1)}%`;
        } else if (server.disk >= 90) {
          primaryIssue = `Disk ${server.disk.toFixed(1)}%`;
        } else if (server.status === 'warning') {
          primaryIssue = '경고 상태';
        } else if (server.status === 'critical') {
          primaryIssue = '위험 상태';
        }

        return {
          id: server.id,
          name: server.name,
          status: server.status,
          primaryIssue,
        };
      });

    const thresholds = {
      cpu: STATUS_THRESHOLDS.cpu.warning,
      memory: STATUS_THRESHOLDS.memory.warning,
      disk: STATUS_THRESHOLDS.disk.warning,
    };

    // 히스토리 슬롯의 실제 timestamp를 활용한 타임라인
    const timeline = buildTimelineFromHistory(history, state, thresholds, serverNameMap, now);

    let rootCause: ReportForEvaluation['rootCause'] = null;
    if (affectedServers.length > 0) {
      const primaryServer = affectedServers[0];
      rootCause = {
        cause: `${primaryServer.name}의 ${primaryServer.primaryIssue}`,
        confidence: 0.65,
        evidence: [
          `영향받은 서버 ${affectedServers.length}대`,
          `타임라인 이벤트 ${timeline.length}건`,
        ],
        suggestedFix: '리소스 사용량 점검 및 부하 분산 검토',
      };
    }

    const nearGap = 5;
    const softThresholds = {
      cpu: thresholds.cpu - nearGap,
      memory: thresholds.memory - nearGap,
    };

    const warnings: NonNullable<ReportForEvaluation['warnings']> = [];
    for (const server of state.servers) {
      if (server.status !== 'online') {
        continue;
      }

      for (const [metric, soft, hard] of [
        ['cpu', softThresholds.cpu, thresholds.cpu] as const,
        ['memory', softThresholds.memory, thresholds.memory] as const,
      ]) {
        const value = server[metric];
        if (value >= soft && value < hard) {
          warnings.push({
            serverId: server.id,
            serverName: server.name,
            metric,
            currentValue: value,
            threshold: hard,
            gap: +(hard - value).toFixed(1),
          });
          // near_threshold 이벤트는 현재 시각 기준
          timeline.push({
            timestamp: now.toISOString(),
            eventType: 'near_threshold',
            severity: 'info',
            description: `${server.name}: ${metric.toUpperCase()} ${value.toFixed(1)}% (임계 ${hard}%까지 ${(hard - value).toFixed(1)}%)`,
          });
        }
      }
    }

    const predictions = generatePredictions(
      buildPredictionTargets(affectedServers, warnings),
      state,
      history
    );
    const suggestedActions = buildSuggestedActions(affectedServers);
    const sla = calculateActualUptime(history, state);

    const title =
      affectedServers.length > 0
        ? `${now.toISOString().slice(0, 10)} 시스템 장애 보고서`
        : `${now.toISOString().slice(0, 10)} 시스템 예방 점검 보고서`;

    const summary =
      affectedServers.length > 0
        ? `${affectedServers.length}대 서버에서 이상 감지됨. 주요 이슈: ${affectedServers[0]?.primaryIssue || '확인 필요'}`
        : warnings.length > 0
          ? `전체 서버 정상 운영 중. ${warnings.length}대 서버 임계 근접 모니터링 권장`
          : '모든 서버 정상 운영 중';

    return {
      title,
      summary,
      affectedServers,
      timeline: timeline.slice(0, 10),
      rootCause,
      suggestedActions,
      warnings: warnings.slice(0, 5),
      predictions,
      sla,
    };
  } catch (error) {
    logger.error('[generateInitialReport] Error:', error);
    return null;
  }
}

function generatePredictions(
  servers: ReportForEvaluation['affectedServers'],
  state: MonitoringState,
  history: MonitoringHistorySlot[]
): NonNullable<ReportForEvaluation['predictions']> {
  if (servers.length === 0) {
    return [];
  }

  const predictor = getTrendPredictor();
  const results: NonNullable<ReportForEvaluation['predictions']> = [];

  for (const server of servers.slice(0, 5)) {
    const current = state.servers.find((item) => item.id === server.id);
    if (!current) {
      continue;
    }

    for (const metric of ['cpu', 'memory'] as const) {
      if (current[metric] < 70) {
        continue;
      }
      const metricHistory = buildHistoryForMetric(history, server.id, metric, current[metric]);
      const prediction = predictor.predictEnhanced(
        toTrendDataPoints(metricHistory),
        metric
      );

      results.push({
        serverId: server.id,
        serverName: server.name,
        metric,
        currentValue: current[metric],
        predictedValue:
          Math.round(
            Math.max(0, Math.min(100, prediction.prediction)) * 10
          ) / 10,
        trend: prediction.trend,
        confidence: Math.round(prediction.confidence * 100) / 100,
        thresholdBreachHumanReadable:
          prediction.thresholdBreach.willBreachCritical ||
          prediction.thresholdBreach.willBreachWarning
            ? prediction.thresholdBreach.humanReadable
            : null,
      });
    }
  }

  return results;
}

export function determineFocusArea(
  report: ReportForEvaluation
): keyof typeof COMMAND_TEMPLATES {
  if (!report.affectedServers || report.affectedServers.length === 0) {
    return 'general';
  }
  const issues = report.affectedServers
    .map((server) => server.primaryIssue.toLowerCase())
    .join(' ');

  if (issues.includes('cpu')) {
    return 'cpu';
  }
  if (issues.includes('memory') || issues.includes('메모리')) {
    return 'memory';
  }
  if (issues.includes('disk') || issues.includes('디스크')) {
    return 'disk';
  }
  if (issues.includes('network') || issues.includes('네트워크')) {
    return 'network';
  }
  return 'general';
}

export function getSuggestedCommands(
  focusArea: keyof typeof COMMAND_TEMPLATES,
  serverType?: string
): string[] {
  const genericCommands =
    COMMAND_TEMPLATES[focusArea] || COMMAND_TEMPLATES.general;
  const typeCommands = serverType
    ? (SERVER_TYPE_COMMANDS[serverType]?.[focusArea] ??
      SERVER_TYPE_COMMANDS[serverType]?.general ??
      [])
    : [];

  return [...genericCommands, ...typeCommands];
}
