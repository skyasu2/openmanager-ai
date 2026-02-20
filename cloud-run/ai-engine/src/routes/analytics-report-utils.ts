import { randomUUID } from 'crypto';
import { logger } from '../lib/logger';

interface ToolBasedData {
  id: string;
  title: string;
  severity: string;
  description: string;
  affected_servers: string[];
  anomalies: Array<{
    server_id: string;
    server_name: string;
    metric: string;
    value: number;
    severity: string;
  }>;
  system_summary: {
    total_servers: number;
    healthy_servers: number;
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
          healthyCount?: number;
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
    healthy_servers: summary.healthyCount ?? 0,
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

  return {
    id,
    title,
    severity,
    description,
    affected_servers: serverId ? [serverId] : affectedServerIds,
    anomalies,
    system_summary: systemSummary,
    timeline,
    recommendations,
    pattern: hasAnomalies ? '이상 패턴 감지됨' : '정상 패턴',
  };
}

/**
 * Parse JSON response from agent.
 */
export function parseAgentJsonResponse(
  text: string,
  fallback: Pick<
    ToolBasedData,
    'title' | 'severity' | 'affected_servers' | 'recommendations' | 'pattern'
  >
): {
  title: string;
  severity: string;
  description: string;
  affected_servers: string[];
  root_cause: string;
  recommendations: Array<{ action: string; priority: string; expected_impact: string }>;
  pattern: string;
} {
  const jsonMatch =
    text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      return {
        title: parsed.title || fallback.title,
        severity: parsed.severity || fallback.severity,
        description: parsed.description || '',
        affected_servers: Array.isArray(parsed.affected_servers)
          ? parsed.affected_servers
          : fallback.affected_servers,
        root_cause: parsed.root_cause || '',
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations
          : fallback.recommendations,
        pattern: parsed.pattern || fallback.pattern,
      };
    } catch {
      logger.warn('[Incident Report] JSON parse failed, using regex extraction');
    }
  }

  return {
    title: fallback.title,
    severity: fallback.severity,
    description: '',
    affected_servers: fallback.affected_servers,
    root_cause: '',
    recommendations: fallback.recommendations,
    pattern: fallback.pattern,
  };
}
