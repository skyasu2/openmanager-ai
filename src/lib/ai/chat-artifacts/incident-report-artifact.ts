import {
  type IncidentReport,
  normalizeIncidentSeverity,
} from '@/components/ai/pages/auto-report/types';
import { createQueryAsOf } from '@/lib/ai/query-as-of';
import {
  type ArtifactDegradationSummary,
  attachArtifactEnvelopeMetadata,
  type ChatArtifactRequest,
  type IncidentReportArtifact,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function normalizeSystemSummary(
  value: unknown
): IncidentReport['systemSummary'] {
  if (!isRecord(value)) return undefined;
  const totalServers = Number(value.total_servers ?? value.totalServers ?? 0);
  const healthyServers = Number(
    value.healthy_servers ?? value.online_servers ?? value.healthyServers ?? 0
  );
  const warningServers = Number(
    value.warning_servers ?? value.warningServers ?? 0
  );
  const criticalServers = Number(
    value.critical_servers ?? value.criticalServers ?? 0
  );
  const uptimePercent = readNumber(value.uptime_percent ?? value.uptimePercent);
  const affectedDurationMinutes = readNumber(
    value.affected_duration_minutes ?? value.affectedDurationMinutes
  );
  const dataSlotLabel = readString(
    value.data_slot_label ?? value.dataSlotLabel
  );

  return {
    totalServers: Number.isFinite(totalServers) ? totalServers : 0,
    healthyServers: Number.isFinite(healthyServers) ? healthyServers : 0,
    warningServers: Number.isFinite(warningServers) ? warningServers : 0,
    criticalServers: Number.isFinite(criticalServers) ? criticalServers : 0,
    ...(uptimePercent !== undefined && { uptimePercent }),
    ...(affectedDurationMinutes !== undefined && {
      affectedDurationMinutes,
    }),
    ...(dataSlotLabel && { dataSlotLabel }),
  };
}

function normalizeLogPatterns(value: unknown): IncidentReport['logPatterns'] {
  if (!Array.isArray(value)) return undefined;

  const patterns = value
    .map((entry): NonNullable<IncidentReport['logPatterns']>[number] | null => {
      if (!isRecord(entry)) return null;
      const severity = readString(entry.severity).toUpperCase();
      if (
        severity !== 'ERROR' &&
        severity !== 'WARNING' &&
        severity !== 'INFO'
      ) {
        return null;
      }

      const message = readString(entry.message);
      const serverId = readString(entry.serverId ?? entry.server_id);
      const firstSeen = readString(entry.firstSeen ?? entry.first_seen);
      const lastSeen = readString(entry.lastSeen ?? entry.last_seen);
      const count = readNumber(entry.count);
      if (!message || !serverId || !firstSeen || !lastSeen || !count) {
        return null;
      }

      return {
        message,
        count,
        severity,
        serverId,
        firstSeen,
        lastSeen,
      };
    })
    .filter(
      (entry): entry is NonNullable<IncidentReport['logPatterns']>[number] =>
        entry !== null
    );

  return patterns.length > 0 ? patterns : undefined;
}

function normalizeIncidentReport(
  rawReport: Record<string, unknown>
): IncidentReport {
  const rootCause = isRecord(rawReport.root_cause_analysis)
    ? rawReport.root_cause_analysis
    : undefined;

  return {
    id: readString(rawReport.id, `incident-${Date.now()}`),
    title: readString(rawReport.title, '장애 보고서'),
    severity: normalizeIncidentSeverity(readString(rawReport.severity, 'info')),
    timestamp: new Date(
      readString(rawReport.created_at, new Date().toISOString())
    ),
    affectedServers: readStringArray(rawReport.affected_servers),
    description:
      readString(rootCause?.primary_cause) ||
      readString(rootCause?.summary) ||
      readString(rawReport.description, '장애 보고서가 생성되었습니다.'),
    status: 'active',
    pattern: readString(rawReport.pattern) || undefined,
    recommendations: Array.isArray(rawReport.recommendations)
      ? (rawReport.recommendations as IncidentReport['recommendations'])
      : undefined,
    systemSummary: normalizeSystemSummary(rawReport.system_summary),
    logPatterns: normalizeLogPatterns(
      rawReport.log_patterns ?? rawReport.logPatterns
    ),
    anomalies: Array.isArray(rawReport.anomalies)
      ? (rawReport.anomalies as IncidentReport['anomalies'])
      : undefined,
    timeline: Array.isArray(rawReport.timeline)
      ? (rawReport.timeline as IncidentReport['timeline'])
      : undefined,
    postmortem: isRecord(rawReport.postmortem)
      ? (rawReport.postmortem as unknown as IncidentReport['postmortem'])
      : undefined,
  };
}

function normalizeDegradationSummary(
  rawReport: Record<string, unknown>
): ArtifactDegradationSummary | undefined {
  if (rawReport.degraded !== true) return undefined;

  const reasonCode = readString(
    rawReport.fallbackReasonCode ?? rawReport.degradationReasonCode
  );
  const fallbackSource = readString(rawReport.fallbackSource);
  const fallbackReason = readString(
    rawReport.fallbackReason ?? rawReport._fallbackReason
  );

  return {
    degraded: true,
    ...(reasonCode && { reasonCode }),
    ...(fallbackSource && { fallbackSource }),
    ...(fallbackReason && { fallbackReason }),
  };
}

export async function generateIncidentReportArtifact({
  query,
  sessionId,
  queryAsOfDataSlot,
  signal,
}: ChatArtifactRequest): Promise<IncidentReportArtifact> {
  const response = await fetch('/api/ai/incident-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      action: 'generate',
      notify: true,
      query,
      sessionId,
      queryAsOf: createQueryAsOf(queryAsOfDataSlot),
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('로그인이 필요합니다. 게스트 로그인 후 이용해주세요.');
    }
    throw new Error(`장애 보고서 작성 요청 실패: ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (data.source === 'fallback' || data.success === false) {
    throw new Error(
      readString(
        data.message,
        '보고서 생성 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.'
      )
    );
  }

  if (!isRecord(data.report)) {
    throw new Error('보고서 데이터를 받지 못했습니다. 다시 시도해주세요.');
  }

  const report = normalizeIncidentReport(data.report);
  const degradation = normalizeDegradationSummary(data.report);

  return attachArtifactEnvelopeMetadata<IncidentReportArtifact>(
    {
      kind: 'incident-report',
      generatedAt: new Date().toISOString(),
      report,
      source:
        readString(data.report._source) || readString(data.source) || undefined,
      ...(degradation && {
        degradation,
        providerSummary: {
          usedFallback: true,
          fallbackReason:
            degradation.reasonCode ?? degradation.fallbackReason ?? 'degraded',
        },
      }),
      queryAsOfDataSlot,
    },
    {
      sourceMode: 'tool-result',
      dataSlot: queryAsOfDataSlot?.timeLabel,
    }
  );
}
