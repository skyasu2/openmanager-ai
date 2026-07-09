import type { MonitoringAnalysisArtifact } from '@/lib/ai/domains/monitoring/artifact-types';
import { formatKSTTimestampLabel } from '@/lib/utils/kst-format';
import type {
  MonitoringBatch24hMetricSummary,
  MonitoringBatchCapacityAlert,
  MonitoringBatchEvidenceRef,
  MonitoringBatchFactCorrelatedLog,
  MonitoringBatchFactSignal,
  MonitoringBatchRiskSignal,
} from '@/types/intelligent-monitoring.types';

export type MonitoringDisplaySignal =
  | MonitoringBatchRiskSignal
  | MonitoringBatchFactSignal;

export interface MonitoringBaselineRow {
  signal: MonitoringBatchFactSignal;
  baseline: MonitoringBatch24hMetricSummary;
}

export type MonitoringCorrelatedLogSeverity =
  | MonitoringBatchFactCorrelatedLog['severity']
  | Extract<MonitoringBatchEvidenceRef['severity'], 'warning' | 'critical'>;

export interface MonitoringCorrelatedLogRow {
  serverId: string;
  serverName: string;
  severity: MonitoringCorrelatedLogSeverity;
  summary: string;
  evidenceRefId?: string;
}

function buildRoleGroupMarkdown(artifact: MonitoringAnalysisArtifact): string {
  const roleGroups = artifact.roleGroupSummary ?? [];
  if (roleGroups.length === 0) {
    return '';
  }

  return roleGroups
    .map(
      (group) =>
        `- ${group.role}: ${group.count}대, CPU ${group.avgCpu}%, MEM ${group.avgMemory}%, DISK ${group.avgDisk}%, 주의 ${group.warningCount}대, 위험 ${group.criticalCount}대`
    )
    .join('\n');
}

function buildBaselineMarkdown(artifact: MonitoringAnalysisArtifact): string {
  const baselineRows = readBaselineRows(artifact);
  if (baselineRows.length === 0) {
    return '';
  }

  return baselineRows
    .map(({ signal, baseline }) => {
      const peakLabel = formatBaselineTimestamp(
        baseline.peakTimestamp,
        baseline.peakSlot
      );
      return (
        `- ${signal.serverName || signal.serverId}: ${formatMetricLabel(baseline.metric)} ` +
        `현재 ${formatBaselinePercent(baseline.current)}, 24h 평균 ${formatBaselinePercent(baseline.avg24h)}, ` +
        `p95 ${formatBaselinePercent(baseline.p95)}, peak ${formatBaselinePercent(baseline.max)} @ ${peakLabel}, ` +
        `경고 슬롯 ${baseline.warningSlots}, 위험 슬롯 ${baseline.criticalSlots}`
      );
    })
    .join('\n');
}

function buildCorrelatedLogsMarkdown(
  artifact: MonitoringAnalysisArtifact
): string {
  const correlatedLogRows = readCorrelatedLogRows(artifact);
  if (correlatedLogRows.length === 0) {
    return '';
  }

  return correlatedLogRows
    .map(
      (row) =>
        `- ${row.serverName || row.serverId}: ${formatCorrelatedLogSeverity(row.severity)} · ${row.summary}`
    )
    .join('\n');
}

function buildCapacityAlertsMarkdown(
  artifact: MonitoringAnalysisArtifact
): string {
  const alerts = readCapacityAlerts(artifact);
  if (alerts.length === 0) {
    return '';
  }

  return alerts
    .map(
      (alert) =>
        `- ${alert.serverName || alert.serverId}: ${alert.metric.toUpperCase()} 현재 ${Math.round(alert.currentValue)}%, 예측 ${Math.round(alert.predictedValue)}% · ${alert.humanReadable}`
    )
    .join('\n');
}

export function formatQueryFocusServer(
  artifact: MonitoringAnalysisArtifact
): string | null {
  const focusServer =
    artifact.queryFocusServer ?? artifact.analysis.queryFocusServer;
  if (!focusServer) return null;

  return `${focusServer.serverName || focusServer.serverId} (${formatStatusLabel(focusServer.status)}, CPU ${Math.round(focusServer.cpu)}%, MEM ${Math.round(focusServer.memory)}%, DISK ${Math.round(focusServer.disk)}%)`;
}

export function buildAnalysisMarkdown(
  artifact: MonitoringAnalysisArtifact
): string {
  const riskSignals = readDisplaySignals(artifact);
  const timeLabel = readTimeLabel(artifact);
  const roleGroupLines = buildRoleGroupMarkdown(artifact);
  const baselineLines = buildBaselineMarkdown(artifact);
  const correlatedLogLines = buildCorrelatedLogsMarkdown(artifact);
  const capacityAlertLines = buildCapacityAlertsMarkdown(artifact);
  const queryFocusServer = formatQueryFocusServer(artifact);
  const warningLines =
    riskSignals.length > 0
      ? riskSignals
          .map(
            (signal) =>
              `- ${signal.serverName || signal.serverId}: ${signal.metric} ${signal.value}% (${signal.severity})`
          )
          .join('\n')
      : '- 감지된 위험 신호 없음';

  return [
    `# ${artifact.title}`,
    '',
    `- 생성 시각: ${new Date(artifact.generatedAt).toLocaleString('ko-KR')}`,
    `- 데이터 기준: ${timeLabel}`,
    `- 분석 서버: ${artifact.serverCount}대`,
    `- 위험 신호: ${artifact.riskSignalCount}건`,
    `- 주의 서버: ${artifact.warningServers}대`,
    `- 위험 서버: ${artifact.criticalServers}대`,
    ...(queryFocusServer ? [`- 기준(origin) 서버: ${queryFocusServer}`] : []),
    '',
    '## 요약',
    '',
    artifact.summary,
    '',
    ...(roleGroupLines ? ['## 역할별 현황', '', roleGroupLines, ''] : []),
    ...(baselineLines ? ['## 24h 기준선', '', baselineLines, ''] : []),
    ...(correlatedLogLines ? ['## 동반 로그', '', correlatedLogLines, ''] : []),
    ...(capacityAlertLines
      ? ['## 용량 소진 예측', '', capacityAlertLines, '']
      : []),
    '## 위험 신호',
    '',
    warningLines,
    '',
  ].join('\n');
}

export function signalClass(severity: 'warning' | 'critical'): string {
  return severity === 'critical'
    ? 'bg-red-50 text-red-700'
    : 'bg-amber-50 text-amber-700';
}

export function formatCorrelatedLogSeverity(
  severity: MonitoringCorrelatedLogSeverity
): string {
  return severity === 'critical' ? '위험' : '주의';
}

export function capacityAlertClass(severity: 'warning' | 'critical'): string {
  return severity === 'critical'
    ? 'border-red-100 bg-red-50 text-red-800'
    : 'border-amber-100 bg-amber-50 text-amber-800';
}

function readRiskSignals(
  artifact: MonitoringAnalysisArtifact
): MonitoringBatchRiskSignal[] {
  return Array.isArray(artifact.analysis.riskSignals)
    ? artifact.analysis.riskSignals
    : [];
}

function readFactSignals(
  artifact: MonitoringAnalysisArtifact
): MonitoringBatchFactSignal[] {
  return Array.isArray(artifact.analysis.factPack?.signals)
    ? artifact.analysis.factPack.signals
    : [];
}

export function readDisplaySignals(
  artifact: MonitoringAnalysisArtifact
): MonitoringDisplaySignal[] {
  const factSignals = readFactSignals(artifact);
  return factSignals.length > 0 ? factSignals : readRiskSignals(artifact);
}

export function readBaselineRows(
  artifact: MonitoringAnalysisArtifact
): MonitoringBaselineRow[] {
  return readFactSignals(artifact)
    .filter((signal) => signal.baseline24h !== undefined)
    .map((signal) => ({
      signal,
      baseline: signal.baseline24h as MonitoringBatch24hMetricSummary,
    }));
}

export function readCorrelatedLogRows(
  artifact: MonitoringAnalysisArtifact
): MonitoringCorrelatedLogRow[] {
  const seen = new Set<string>();
  const rows: MonitoringCorrelatedLogRow[] = [];
  const correlatedSignalServerIds = new Set(
    readDisplaySignals(artifact).map((signal) => signal.serverId)
  );

  for (const signal of readFactSignals(artifact)) {
    if (!Array.isArray(signal.correlatedLogs)) {
      continue;
    }

    for (const log of signal.correlatedLogs) {
      const dedupeKey =
        log.evidenceRefId ||
        `${signal.serverId}:${log.severity}:${log.summary}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      rows.push({
        serverId: signal.serverId,
        serverName: signal.serverName,
        severity: log.severity,
        summary: log.summary,
        evidenceRefId: log.evidenceRefId,
      });
    }
  }

  for (const evidence of readEvidenceRefs(artifact)) {
    if (!isCorrelatedLogEvidence(evidence)) {
      continue;
    }
    if (
      !evidence.serverId ||
      !correlatedSignalServerIds.has(evidence.serverId)
    ) {
      continue;
    }

    const dedupeKey =
      evidence.id ||
      `${evidence.serverId ?? 'unknown'}:${evidence.severity}:${evidence.summary}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    rows.push({
      serverId: evidence.serverId ?? 'unknown',
      serverName: evidence.serverId ?? 'unknown',
      severity: evidence.severity,
      summary: evidence.summary,
      evidenceRefId: evidence.id,
    });
  }

  return rows;
}

export function readCapacityAlerts(
  artifact: MonitoringAnalysisArtifact
): MonitoringBatchCapacityAlert[] {
  if (Array.isArray(artifact.capacityAlerts)) {
    return artifact.capacityAlerts;
  }

  return Array.isArray(artifact.analysis.capacityAlerts)
    ? artifact.analysis.capacityAlerts
    : [];
}

export function readEvidenceRefs(
  artifact: MonitoringAnalysisArtifact
): MonitoringBatchEvidenceRef[] {
  if (Array.isArray(artifact.analysis.factPack?.evidenceRefs)) {
    return artifact.analysis.factPack.evidenceRefs;
  }

  return Array.isArray(artifact.analysis.evidenceRefs)
    ? artifact.analysis.evidenceRefs
    : [];
}

export function isCorrelatedLogEvidence(
  evidence: MonitoringBatchEvidenceRef
): evidence is MonitoringBatchEvidenceRef & {
  kind: 'log';
  severity: 'warning' | 'critical';
} {
  return (
    evidence.kind === 'log' &&
    (evidence.severity === 'warning' || evidence.severity === 'critical')
  );
}

export function readTimeLabel(artifact: MonitoringAnalysisArtifact): string {
  return (
    artifact.analysis.slot?.timeLabel ||
    artifact.queryAsOfDataSlot?.timeLabel ||
    '현재'
  );
}

export function formatMonitoringSourceLabel(sourceMode: string): string {
  if (sourceMode === 'live-otel') {
    return 'Live telemetry';
  }
  if (sourceMode === 'replay-json') {
    return 'OpenTelemetry snapshot';
  }
  return 'Monitoring snapshot';
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'online':
      return '정상';
    case 'warning':
      return '주의';
    case 'critical':
      return '위험';
    case 'offline':
      return '오프라인';
    default:
      return status;
  }
}

export function formatMetricLabel(
  metric: MonitoringBatch24hMetricSummary['metric']
): string {
  switch (metric) {
    case 'cpu':
      return 'CPU';
    case 'memory':
      return 'MEM';
    case 'disk':
      return 'DISK';
    case 'network':
      return 'NET';
  }
}

export function formatBaselinePercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatBaselineTimestamp(
  timestamp: string | undefined,
  fallbackSlot: string
): string {
  if (!timestamp) {
    return `${fallbackSlot} KST`;
  }

  return formatKSTTimestampLabel(timestamp) ?? `${fallbackSlot} KST`;
}

function formatCapacityEta(minutes: number | null): string {
  if (minutes === null) {
    return '예측 없음';
  }
  if (minutes <= 0) {
    return '현재';
  }
  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours}시간 ${remainingMinutes}분`
    : `${hours}시간`;
}

export function formatCapacityTarget(
  alert: MonitoringBatchCapacityAlert
): string {
  if (alert.timeToCriticalMinutes !== null) {
    return `위험 도달 ${formatCapacityEta(alert.timeToCriticalMinutes)}`;
  }

  return `주의 도달 ${formatCapacityEta(alert.timeToWarningMinutes)}`;
}

function clampCapacityPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

export function calculateCapacityBarSegments(
  currentValue: number,
  predictedValue: number
): {
  currentPercent: number;
  predictedLeftPercent: number;
  predictedDeltaPercent: number;
} {
  const currentPercent = clampCapacityPercent(Math.round(currentValue));
  const predictedPercent = clampCapacityPercent(Math.round(predictedValue));

  return {
    currentPercent,
    predictedLeftPercent: currentPercent,
    predictedDeltaPercent: Math.max(0, predictedPercent - currentPercent),
  };
}
