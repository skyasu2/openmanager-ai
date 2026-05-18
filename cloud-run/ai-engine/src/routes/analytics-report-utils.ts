import { randomUUID } from 'crypto';
import { z } from 'zod';
import { logger } from '../lib/logger';

export interface ToolBasedData {
  id: string;
  title: string;
  severity: string;
  description: string;
  affected_servers: string[];
  affectedServers: Array<{
    id: string;
    name: string;
    severity: string;
    metric?: string;
    value?: number;
  }>;
  anomalies: Array<{
    server_id: string;
    server_name: string;
    metric: string;
    value: number;
    severity: string;
  }>;
  system_summary: {
    total_servers: number;
    online_servers: number;
    warning_servers: number;
    critical_servers: number;
  };
  timeline: Array<{ timestamp: string; event: string; severity: string }>;
  recommendations: Array<{
    action: string;
    priority: string;
    expected_impact: string;
  }>;
  pattern: string;
  postmortem: {
    timeline: string[];
    hypotheses: string[];
    prevention: string[];
  };
}

const SeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'warning',
  'info',
]);

export const IncidentReportOutputSchema = z
  .object({
    title: z.string(),
    severity: SeveritySchema,
    description: z.string(),
    affected_servers: z.array(z.string()),
    affectedServers: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          severity: z.string(),
          metric: z.string().nullable(),
          value: z.number().nullable(),
        })
      ),
    root_cause: z.string(),
    recommendations: z
      .array(
        z.object({
          action: z.string(),
          priority: z.string(),
          expected_impact: z.string(),
        })
      ),
    pattern: z.string(),
    postmortem: z.object({
      timeline: z.array(z.string()),
      hypotheses: z.array(z.string()),
      prevention: z.array(z.string()),
    }),
  })
  .passthrough();

export type IncidentReportOutput = z.infer<typeof IncidentReportOutputSchema>;

export const REPORTER_DEGRADATION_REASON_CODES = [
  'reporter_degraded',
  'reporter_unavailable',
  'provider_schema_drift',
  'provider_parse_drift',
  'provider_rate_limit',
  'provider_timeout',
  'provider_unavailable',
] as const;

export type ReporterDegradationReasonCode =
  (typeof REPORTER_DEGRADATION_REASON_CODES)[number];

export function getReporterDegradationReasonCode(
  reason?: string
): ReporterDegradationReasonCode {
  const message = reason?.toLowerCase() ?? '';
  if (!message) return 'reporter_degraded';
  if (message.includes('reporter_unavailable')) return 'reporter_unavailable';
  if (
    message.includes('invalid json schema') ||
    message.includes('expected schema') ||
    message.includes('response_format') ||
    message.includes('jsonschema')
  ) {
    return 'provider_schema_drift';
  }
  if (
    message.includes('no object generated') ||
    message.includes('could not parse') ||
    message.includes('parse the response')
  ) {
    return 'provider_parse_drift';
  }
  if (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('quota') ||
    message.includes('429')
  ) {
    return 'provider_rate_limit';
  }
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('deadline')
  ) {
    return 'provider_timeout';
  }
  if (
    message.includes('503') ||
    message.includes('502') ||
    message.includes('504') ||
    message.includes('service unavailable')
  ) {
    return 'provider_unavailable';
  }
  return 'reporter_degraded';
}

type IncidentReportFallback = Pick<
  ToolBasedData,
  | 'title'
  | 'severity'
  | 'affected_servers'
  | 'affectedServers'
  | 'recommendations'
  | 'pattern'
  | 'postmortem'
>;

export interface NormalizedIncidentReportOutput {
  title: string;
  severity: string;
  description: string;
  affected_servers: string[];
  affectedServers: ToolBasedData['affectedServers'];
  root_cause: string;
  recommendations: Array<{
    action: string;
    priority: string;
    expected_impact: string;
  }>;
  pattern: string;
  postmortem: ToolBasedData['postmortem'];
}

type IncidentRecommendation = ToolBasedData['recommendations'][number];

function getAnomalyMetricKey(metric: string): string {
  const normalized = metric.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('mem')) return 'memory';
  if (normalized.includes('disk') || normalized.includes('fs')) return 'disk';
  if (normalized.includes('net')) return 'network';
  if (normalized.includes('cpu')) return 'cpu';
  return normalized;
}

function getAnomalyServerLabel(
  anomaly: ToolBasedData['anomalies'][number]
): string {
  return anomaly.server_name || anomaly.server_id;
}

function isLoadBalancerAnomaly(
  anomaly: ToolBasedData['anomalies'][number]
): boolean {
  const target = `${anomaly.server_id} ${anomaly.server_name}`.toLowerCase();
  return (
    target.includes('haproxy') ||
    target.includes('loadbalancer') ||
    target.includes('load-balancer') ||
    target.includes('lb-')
  );
}

function anomalyPriority(
  severity: string
): IncidentRecommendation['priority'] {
  return severity === 'critical' ? 'high' : 'medium';
}

function buildAnomalyRecommendation(
  anomaly: ToolBasedData['anomalies'][number]
): IncidentRecommendation {
  const metric = getAnomalyMetricKey(anomaly.metric);
  const label = getAnomalyServerLabel(anomaly);
  const value = `${Math.round(anomaly.value * 10) / 10}%`;
  const priority = anomalyPriority(anomaly.severity);

  if (metric === 'cpu') {
    return {
      action: `${label} CPU 상위 프로세스 확인 (${value})\n명령어: \`top -o %CPU -b -n 1 | head -20\``,
      priority,
      expected_impact: '부하 프로세스 식별 및 조치 우선순위 산정',
    };
  }

  if (metric === 'network') {
    if (isLoadBalancerAnomaly(anomaly)) {
      return {
        action: `${label} HAProxy 세션/백엔드 상태 확인 (${value})\n명령어: \`echo "show stat" | socat - /run/haproxy/admin.sock | head -20\``,
        priority,
        expected_impact: '로드밸런서 연결 쏠림과 backend 장애 여부 확인',
      };
    }

    return {
      action: `${label} 네트워크 연결/소켓 상태 확인 (${value})\n명령어: \`ss -s\``,
      priority,
      expected_impact: '연결 수 급증 또는 소켓 고갈 여부 확인',
    };
  }

  if (metric === 'memory') {
    return {
      action: `${label} 메모리 상위 프로세스 확인 (${value})\n명령어: \`ps aux --sort=-%mem | head -10\``,
      priority,
      expected_impact: '메모리 누수 또는 캐시 증가 원인 식별',
    };
  }

  if (metric === 'disk') {
    return {
      action: `${label} 디스크 사용량 상위 경로 확인 (${value})\n명령어: \`du -sh /* 2>/dev/null | sort -hr | head -10\``,
      priority,
      expected_impact: '급증한 로그/데이터 경로 식별',
    };
  }

  return {
    action: `${label} ${anomaly.metric} 임계 초과 확인 (${value})\n명령어: \`journalctl -xe --no-pager | tail -50\``,
    priority,
    expected_impact: '이상 징후 발생 시점의 시스템 로그 확인',
  };
}

function buildAnomalyRecommendations(
  anomalies: ToolBasedData['anomalies']
): IncidentRecommendation[] {
  return anomalies.slice(0, 4).map(buildAnomalyRecommendation);
}

function normalizeRecommendationKey(action: string): string {
  return action
    .replace(/`[^`]+`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isGenericCapacityAction(action: string): boolean {
  return /서버\s*리소스\s*업그레이드|스케일\s*업|scale\s*up|증설|로드\s*밸런싱\s*조정/i.test(
    action
  );
}

export function mergeIncidentRecommendations(
  deterministic: IncidentRecommendation[],
  agent: IncidentRecommendation[]
): IncidentRecommendation[] {
  const ordered = [
    ...deterministic,
    ...agent.filter((item) => !isGenericCapacityAction(item.action)),
    ...agent.filter((item) => isGenericCapacityAction(item.action)),
  ];
  const seen = new Set<string>();
  const merged: IncidentRecommendation[] = [];

  for (const item of ordered) {
    const key = normalizeRecommendationKey(item.action);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if (merged.length >= 6) break;
  }

  return merged;
}

function normalizeAffectedServers(
  value: Partial<IncidentReportOutput>['affectedServers'],
  fallback: ToolBasedData['affectedServers']
): ToolBasedData['affectedServers'] {
  if (!Array.isArray(value)) return fallback;

  return value
    .filter((server) => server.id && server.name && server.severity)
    .map((server) => ({
      id: server.id,
      name: server.name,
      severity: server.severity,
      ...(typeof server.metric === 'string' ? { metric: server.metric } : {}),
      ...(typeof server.value === 'number' ? { value: server.value } : {}),
    }));
}

function readTimelineText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePostmortemTimeline(
  value: unknown,
  fallback: string[]
): string[] {
  if (!Array.isArray(value)) return fallback;

  const normalized = value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }

      if (!entry || typeof entry !== 'object') {
        return '';
      }

      const record = entry as Record<string, unknown>;
      const timestamp = readTimelineText(record.timestamp);
      const event =
        readTimelineText(record.event) ||
        readTimelineText(record.description) ||
        readTimelineText(record.message) ||
        readTimelineText(record.title);
      const severity = readTimelineText(record.severity);

      if (!timestamp && !event && !severity) {
        return '';
      }

      return [
        timestamp,
        event,
        severity ? `(${severity})` : '',
      ]
        .filter(Boolean)
        .join(' - ');
    })
    .filter((entry): entry is string => entry.length > 0);

  return normalized.length > 0 ? normalized : fallback;
}

/**
 * Extract structured data from tool results.
 * Updated to work with detectAnomaliesAllServers output.
 */
export function extractToolBasedData(
  anomalyData: unknown,
  trendData: unknown,
  timelineData: unknown,
  serverId?: string
): ToolBasedData {
  const id = randomUUID();

  const allServerAnomaly = anomalyData as
    | {
        success?: boolean;
        totalServers?: number;
        anomalies?: Array<{
          server_id: string;
          server_name: string;
          metric: string;
          value: number;
          severity: string;
        }>;
        affectedServers?: string[];
        summary?: {
          totalServers?: number;
          onlineCount?: number;
          warningCount?: number;
          criticalCount?: number;
        };
        hasAnomalies?: boolean;
        anomalyCount?: number;
      }
    | undefined;

  const anomalies =
    allServerAnomaly?.anomalies || [];

  const summary = allServerAnomaly?.summary || {};
  const systemSummary = {
    total_servers: summary.totalServers ?? allServerAnomaly?.totalServers ?? 0,
    online_servers: summary.onlineCount ?? 0,
    warning_servers: summary.warningCount ?? 0,
    critical_servers: summary.criticalCount ?? 0,
  };

  const tl = timelineData as
    | { events?: Array<{ timestamp: string; description: string; severity: string }> }
    | null;
  const timeline: Array<{ timestamp: string; event: string; severity: string }> = [];
  if (tl?.events) {
    for (const e of tl.events) {
      timeline.push({
        timestamp: e.timestamp,
        event: e.description,
        severity: e.severity,
      });
    }
  }

  const relatedServers = new Map<
    string,
    {
      id: string;
      name: string;
      severity: string;
      metric?: string;
      value?: number;
    }
  >();

  for (const anomaly of anomalies) {
    if (!relatedServers.has(anomaly.server_id)) {
      relatedServers.set(anomaly.server_id, {
        id: anomaly.server_id,
        name: anomaly.server_name || anomaly.server_id,
        severity: anomaly.severity,
        metric: anomaly.metric,
        value: anomaly.value,
      });
    }
  }

  let severity = 'info';
  if (systemSummary.critical_servers > 0 || anomalies.some((a) => a.severity === 'critical')) {
    severity = 'critical';
  } else if (
    systemSummary.warning_servers > 0 ||
    anomalies.some((a) => a.severity === 'warning' || a.severity === 'medium')
  ) {
    severity = 'warning';
  }

  const trend = trendData as
    | { summary?: { hasRisingTrends?: boolean; risingMetrics?: string[] } }
    | undefined;
  const recommendations: Array<{
    action: string;
    priority: string;
    expected_impact: string;
  }> = buildAnomalyRecommendations(anomalies);
  if (trend?.summary?.hasRisingTrends && trend.summary.risingMetrics) {
    for (const metric of trend.summary.risingMetrics.slice(0, 3)) {
      recommendations.push({
        action: `${metric} 상승 추세 모니터링 강화`,
        priority: 'medium',
        expected_impact: '사전 장애 예방',
      });
    }
  }

  const hasAnomalies = allServerAnomaly?.hasAnomalies ?? anomalies.length > 0;
  const anomalyCount = allServerAnomaly?.anomalyCount ?? anomalies.length;
  const affectedServerIds =
    allServerAnomaly?.affectedServers ??
    [...new Set(anomalies.map((a) => a.server_id))];

  const title = hasAnomalies
    ? `이상 감지: ${anomalyCount}건 발견`
    : '서버 상태 정상';
  const description = hasAnomalies
    ? `총 ${systemSummary.total_servers}대 서버 중 ${anomalyCount}건의 이상 징후가 감지되었습니다.`
    : `총 ${systemSummary.total_servers}대 서버가 정상 상태입니다.`;

  const postmortemTimeline = timeline.map((entry) => {
    const date = new Date(entry.timestamp);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes} - ${entry.event}`;
  });

  const postmortemHypotheses: string[] = [];
  if (anomalies.some((anomaly) => anomaly.metric.toLowerCase() === 'cpu')) {
    postmortemHypotheses.push('CPU 부하 상승이 1차 원인일 가능성이 높습니다.');
  }
  if (trend?.summary?.hasRisingTrends) {
    postmortemHypotheses.push('상승 추세가 유지되어 단일 스파이크보다 지속 부하 가능성이 있습니다.');
  }
  if (postmortemHypotheses.length === 0) {
    postmortemHypotheses.push('수집된 이상 징후를 기준으로 추가 원인 분석이 필요합니다.');
  }

  const postmortemPrevention =
    recommendations.length > 0
      ? recommendations.map((recommendation) => recommendation.action)
      : ['모니터링 임계값과 알림 정책을 재검토합니다.'];

  return {
    id,
    title,
    severity,
    description,
    affected_servers: serverId ? [serverId] : affectedServerIds,
    affectedServers:
      relatedServers.size > 0
        ? Array.from(relatedServers.values())
        : (serverId
            ? [
                {
                  id: serverId,
                  name: serverId,
                  severity,
                },
              ]
            : []),
    anomalies,
    system_summary: systemSummary,
    timeline,
    recommendations,
    pattern: hasAnomalies ? '이상 패턴 감지됨' : '정상 패턴',
    postmortem: {
      timeline: postmortemTimeline,
      hypotheses: postmortemHypotheses,
      prevention: postmortemPrevention,
    },
  };
}

export function normalizeAgentIncidentReportOutput(
  parsed: Partial<IncidentReportOutput> | null | undefined,
  fallback: IncidentReportFallback
): NormalizedIncidentReportOutput {
  const output = parsed ?? {};
  const postmortem = output.postmortem;

  return {
    title: output.title || fallback.title,
    severity: output.severity || fallback.severity,
    description: output.description || '',
    affected_servers: Array.isArray(output.affected_servers)
      ? output.affected_servers
      : fallback.affected_servers,
    affectedServers: normalizeAffectedServers(
      output.affectedServers,
      fallback.affectedServers
    ),
    root_cause: output.root_cause || '',
    recommendations: Array.isArray(output.recommendations)
      ? output.recommendations
      : fallback.recommendations,
    pattern: output.pattern || fallback.pattern,
    postmortem:
      postmortem &&
      Array.isArray(postmortem.timeline) &&
      Array.isArray(postmortem.hypotheses) &&
      Array.isArray(postmortem.prevention)
        ? {
            timeline: normalizePostmortemTimeline(
              postmortem.timeline,
              fallback.postmortem.timeline
            ),
            hypotheses: postmortem.hypotheses,
            prevention: postmortem.prevention,
          }
        : fallback.postmortem,
  };
}

/**
 * Parse JSON response from agent.
 */
export function parseAgentJsonResponse(
  text: string,
  fallback: IncidentReportFallback
): NormalizedIncidentReportOutput {
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return normalizeAgentIncidentReportOutput(parsed, fallback);
    } catch {
      logger.warn('[Incident Report] JSON parse failed, using regex extraction');
    }
  }

  return {
    title: fallback.title,
    severity: fallback.severity,
    description: '',
    affected_servers: fallback.affected_servers,
    affectedServers: fallback.affectedServers,
    root_cause: '',
    recommendations: fallback.recommendations,
    pattern: fallback.pattern,
    postmortem: fallback.postmortem,
  };
}
