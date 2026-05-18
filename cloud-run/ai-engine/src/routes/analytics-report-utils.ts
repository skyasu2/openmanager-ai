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
  }> = [];
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
