import { getCurrentState, getRecentHistory } from '../../../data/precomputed-state';
import { STATUS_THRESHOLDS } from '../../../config/status-thresholds';
import { getTrendPredictor } from '../../../lib/ai/monitoring/TrendPredictor';
import { logger } from '../../../lib/logger';
import {
  getCurrentSlotIndex,
  getHistoryForMetric,
  toTrendDataPoints,
} from '../../../tools-ai-sdk/analyst-tools-shared';

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

export function generateInitialReport(): ReportForEvaluation | null {
  try {
    const state = getCurrentState();
    const now = new Date();

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

    const timeline: ReportForEvaluation['timeline'] = [];
    const thresholds = {
      cpu: STATUS_THRESHOLDS.cpu.warning,
      memory: STATUS_THRESHOLDS.memory.warning,
      disk: STATUS_THRESHOLDS.disk.warning,
    };

    for (const server of state.servers) {
      if (server.cpu >= thresholds.cpu) {
        timeline.push({
          timestamp: now.toISOString(),
          eventType: 'threshold_breach',
          severity: server.cpu >= 90 ? 'critical' : 'warning',
          description: `${server.name}: CPU ${server.cpu.toFixed(1)}%`,
        });
      }
      if (server.memory >= thresholds.memory) {
        timeline.push({
          timestamp: now.toISOString(),
          eventType: 'threshold_breach',
          severity: server.memory >= 90 ? 'critical' : 'warning',
          description: `${server.name}: Memory ${server.memory.toFixed(1)}%`,
        });
      }
    }

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
          timeline.push({
            timestamp: now.toISOString(),
            eventType: 'near_threshold',
            severity: 'info',
            description: `${server.name}: ${metric.toUpperCase()} ${value.toFixed(1)}% (임계 ${hard}%까지 ${(hard - value).toFixed(1)}%)`,
          });
        }
      }
    }

    const predictions = generatePredictions(affectedServers, state);

    const suggestedActions: string[] = [];
    if (affectedServers.some((server) => server.primaryIssue.includes('CPU'))) {
      suggestedActions.push('CPU 사용량 점검');
    }
    if (affectedServers.some((server) => server.primaryIssue.includes('Memory'))) {
      suggestedActions.push('메모리 사용량 확인');
    }
    if (suggestedActions.length === 0) {
      suggestedActions.push('시스템 모니터링 유지');
    }

    return {
      title: `${now.toISOString().slice(0, 10)} 시스템 상태 보고서`,
      summary:
        affectedServers.length > 0
          ? `${affectedServers.length}대 서버에서 이상 감지됨. 주요 이슈: ${affectedServers[0]?.primaryIssue || '확인 필요'}`
          : '모든 서버 정상 운영 중',
      affectedServers,
      timeline: timeline.slice(0, 10),
      rootCause,
      suggestedActions,
      warnings: warnings.slice(0, 5),
      predictions,
      sla: {
        targetUptime: 99.9,
        actualUptime: 99.5,
        slaViolation: false,
      },
    };
  } catch (error) {
    logger.error('[generateInitialReport] Error:', error);
    return null;
  }
}

function generatePredictions(
  servers: ReportForEvaluation['affectedServers'],
  state: ReturnType<typeof getCurrentState>
): NonNullable<ReportForEvaluation['predictions']> {
  if (servers.length === 0) {
    return [];
  }

  const predictor = getTrendPredictor();
  const fixedSlot = getCurrentSlotIndex();
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
      const history = getHistoryForMetric(
        server.id,
        metric,
        current[metric],
        fixedSlot
      );
      const prediction = predictor.predictEnhanced(
        toTrendDataPoints(history),
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
