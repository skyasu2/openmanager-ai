import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';
import { enrichWithMonitoringGrounding } from './analytics-report-monitoring-grounding';
import { buildAnomalyRecommendations } from './analytics-report-recommendations';
import type { IncidentReportOutput } from './analytics-report-schema';
import type {
  IncidentReportFallback,
  MonitoringGroundingForReport,
  NormalizedIncidentReportOutput,
  ToolBasedData,
} from './analytics-report-types';

export {
  getReporterDegradationReasonCode,
  IncidentReportOutputSchema,
  REPORTER_DEGRADATION_REASON_CODES,
  type IncidentReportOutput,
  type ReporterDegradationReasonCode,
} from './analytics-report-schema';
export { mergeIncidentRecommendations } from './analytics-report-recommendations';
export type {
  IncidentReportFallback,
  MonitoringGroundingForReport,
  NormalizedIncidentReportOutput,
  ToolBasedData,
} from './analytics-report-types';

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

      return [timestamp, event, severity ? `(${severity})` : '']
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
  serverId?: string,
  monitoringGrounding?: MonitoringGroundingForReport
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

  const anomalies = allServerAnomaly?.anomalies || [];
  const summary = allServerAnomaly?.summary || {};
  const systemSummary = {
    total_servers: summary.totalServers ?? allServerAnomaly?.totalServers ?? 0,
    online_servers: summary.onlineCount ?? 0,
    warning_servers: summary.warningCount ?? 0,
    critical_servers: summary.criticalCount ?? 0,
  };

  const tl = timelineData as
    | {
        events?: Array<{
          timestamp: string;
          description: string;
          severity: string;
        }>;
      }
    | null;
  const timeline: Array<{
    timestamp: string;
    event: string;
    severity: string;
  }> = [];
  if (tl?.events) {
    for (const event of tl.events) {
      timeline.push({
        timestamp: event.timestamp,
        event: event.description,
        severity: event.severity,
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
  if (
    systemSummary.critical_servers > 0 ||
    anomalies.some((anomaly) => anomaly.severity === 'critical')
  ) {
    severity = 'critical';
  } else if (
    systemSummary.warning_servers > 0 ||
    anomalies.some(
      (anomaly) =>
        anomaly.severity === 'warning' || anomaly.severity === 'medium'
    )
  ) {
    severity = 'warning';
  }

  const trend = trendData as
    | { summary?: { hasRisingTrends?: boolean; risingMetrics?: string[] } }
    | undefined;
  const recommendations = buildAnomalyRecommendations(anomalies);
  if (trend?.summary?.hasRisingTrends && trend.summary.risingMetrics) {
    for (const metric of trend.summary.risingMetrics.slice(0, 3)) {
      recommendations.push({
        action: `${metric} 상승 추세 모니터링 강화`,
        priority: 'medium',
        expected_impact: '사전 장애 예방',
      });
    }
  }

  const summaryHasIncident =
    systemSummary.warning_servers > 0 || systemSummary.critical_servers > 0;
  const hasAnomalies =
    (allServerAnomaly?.hasAnomalies ?? anomalies.length > 0) ||
    summaryHasIncident;
  const anomalyCount = Math.max(
    allServerAnomaly?.anomalyCount ?? anomalies.length,
    anomalies.length,
    systemSummary.warning_servers + systemSummary.critical_servers
  );
  const affectedServerIds =
    allServerAnomaly?.affectedServers ??
    [...new Set(anomalies.map((anomaly) => anomaly.server_id))];

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

  const toolBasedData = {
    id,
    title,
    severity,
    description,
    affected_servers: serverId ? [serverId] : affectedServerIds,
    affectedServers:
      relatedServers.size > 0
        ? Array.from(relatedServers.values())
        : serverId
          ? [
              {
                id: serverId,
                name: serverId,
                severity,
              },
            ]
          : [],
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

  return enrichWithMonitoringGrounding(
    toolBasedData,
    monitoringGrounding,
    serverId
  );
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
