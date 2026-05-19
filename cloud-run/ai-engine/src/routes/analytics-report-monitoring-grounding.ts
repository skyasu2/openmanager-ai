import type {
  MonitoringEvidenceRef,
  MonitoringSeverity,
} from '../services/monitoring/monitoring-types';
import {
  maxSeverity,
  mergeIncidentRecommendations,
  severityRank,
  toIncidentPriority,
  uniqueStrings,
} from './analytics-report-recommendations';
import type {
  IncidentRecommendation,
  MonitoringGroundingForReport,
  ToolBasedData,
} from './analytics-report-types';

function isNotableMonitoringSeverity(
  severity?: MonitoringSeverity | string
): boolean {
  return severityRank(severity) >= severityRank('warning');
}

function formatTimelineTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildMonitoringRecommendation(
  evidence: MonitoringEvidenceRef
): IncidentRecommendation | null {
  if (!evidence.serverId || !isNotableMonitoringSeverity(evidence.severity)) {
    return null;
  }

  const summary = evidence.summary.toLowerCase();
  const priority = toIncidentPriority(evidence.severity);

  if (
    summary.includes('hikaripool') ||
    summary.includes('connection pool') ||
    summary.includes('db connection') ||
    summary.includes('sqltransientconnectionexception')
  ) {
    return {
      action: `${evidence.serverId} HikariPool/DB 커넥션풀 타임아웃 확인\n명령어: \`journalctl -xe --no-pager | grep -Ei "HikariPool|SQLTransientConnectionException|connection timeout" | tail -50\``,
      priority,
      expected_impact: 'WAS DB 연결 대기, 커넥션풀 고갈, DB 지연 전파 여부 확인',
    };
  }

  if (
    summary.includes('mysql') ||
    summary.includes('mysqld') ||
    summary.includes('innodb')
  ) {
    return {
      action: `${evidence.serverId} MySQL/InnoDB 지연 로그 확인\n명령어: \`journalctl -xe --no-pager | grep -i "mysql\\|innodb" | tail -50\``,
      priority,
      expected_impact: 'DB 쓰기 지연과 스토리지 의존 장애 여부 확인',
    };
  }

  if (
    summary.includes('nfs') ||
    summary.includes('minio') ||
    summary.includes('mount') ||
    summary.includes('i/o latency') ||
    summary.includes('upload stalled')
  ) {
    return {
      action: `${evidence.serverId} 스토리지 I/O와 마운트 상태 확인\n명령어: \`df -h && mount | grep -E "nfs|s3|fuse"\``,
      priority,
      expected_impact: '스토리지 지연, 마운트 장애, 백업 경로 병목 여부 확인',
    };
  }

  return {
    action: `${evidence.serverId} 최근 ${evidence.severity} 로그 확인\n명령어: \`journalctl -xe --no-pager | tail -50\``,
    priority,
    expected_impact: '이상 징후 발생 시점의 시스템 로그 확인',
  };
}

function buildMonitoringCausalHypotheses(
  timelineEvents: NonNullable<MonitoringGroundingForReport['timeline']>['events'],
  evidenceRefs: MonitoringEvidenceRef[]
): string[] {
  const texts = [
    ...timelineEvents.map(
      (event) => `${event.serverId ?? ''} ${event.description}`
    ),
    ...evidenceRefs.map(
      (evidence) => `${evidence.serverId ?? ''} ${evidence.summary}`
    ),
  ].map((text) => text.toLowerCase());

  const hasDbIoSignal = texts.some(
    (text) =>
      (text.includes('db-') ||
        text.includes('mysql') ||
        text.includes('mysqld') ||
        text.includes('innodb')) &&
      (text.includes('disk') ||
        text.includes('fsync') ||
        text.includes('i/o') ||
        text.includes('io latency') ||
        text.includes('write') ||
        text.includes('nfs'))
  );
  const hasHikariSignal = texts.some(
    (text) =>
      text.includes('hikaripool') ||
      text.includes('connection pool') ||
      text.includes('db connection') ||
      text.includes('sqltransientconnectionexception')
  );
  const hasDownstreamLatency = texts.some(
    (text) =>
      text.includes('downstream') ||
      text.includes('transaction latency') ||
      text.includes('latency') ||
      text.includes('timeout')
  );
  const hasStorageSignal = texts.some(
    (text) =>
      text.includes('nfs') ||
      text.includes('minio') ||
      text.includes('mount') ||
      text.includes('upload stalled') ||
      text.includes('backup')
  );

  const hypotheses: string[] = [];
  if (hasDbIoSignal && hasHikariSignal) {
    hypotheses.push(
      hasDownstreamLatency
        ? 'DB 디스크 I/O 지연이 WAS HikariPool 연결 대기/타임아웃으로 전파된 정황이 있습니다. 인과 체인: DB 디스크/fsync 지연 → WAS DB 커넥션풀 고갈/대기 증가 → downstream transaction 지연.'
        : 'DB 디스크 I/O 지연이 WAS HikariPool 연결 대기/타임아웃으로 전파된 정황이 있습니다. 인과 체인: DB 디스크/fsync 지연 → WAS DB 커넥션풀 고갈/대기 증가.'
    );
  } else if (hasStorageSignal && hasDbIoSignal) {
    hypotheses.push(
      '스토리지/NFS 지연이 DB 쓰기 지연으로 이어진 정황이 있습니다. 인과 체인: 스토리지 I/O 지연 → DB write/fsync 대기 증가 → 상위 서비스 응답 지연.'
    );
  }

  return hypotheses;
}

function mergeAffectedServerSummaries(
  current: ToolBasedData['affectedServers'],
  additions: ToolBasedData['affectedServers']
): ToolBasedData['affectedServers'] {
  const merged = new Map<string, ToolBasedData['affectedServers'][number]>();

  for (const server of [...current, ...additions]) {
    const existing = merged.get(server.id);
    if (
      !existing ||
      severityRank(server.severity) > severityRank(existing.severity)
    ) {
      merged.set(server.id, {
        ...existing,
        ...server,
        metric: server.metric ?? existing?.metric,
        value: server.value ?? existing?.value,
      });
    }
  }

  return Array.from(merged.values());
}

export function enrichWithMonitoringGrounding(
  data: ToolBasedData,
  monitoringGrounding?: MonitoringGroundingForReport,
  scopeServerId?: string
): ToolBasedData {
  const evidenceRefs = (monitoringGrounding?.evidenceRefs ?? []).filter(
    (evidence) => !scopeServerId || evidence.serverId === scopeServerId
  );
  const timelineEvents = (monitoringGrounding?.timeline?.events ?? []).filter(
    (event) => !scopeServerId || event.serverId === scopeServerId
  );
  const notableEvidenceRefs = evidenceRefs.filter(
    (evidence) =>
      evidence.serverId && isNotableMonitoringSeverity(evidence.severity)
  );
  const notableTimelineEvents = timelineEvents.filter(
    (event) =>
      event.serverId && isNotableMonitoringSeverity(event.severity)
  );

  if (notableEvidenceRefs.length === 0 && notableTimelineEvents.length === 0) {
    return data;
  }

  const monitoringServerIds = uniqueStrings([
    ...notableTimelineEvents.map((event) => event.serverId ?? ''),
    ...notableEvidenceRefs.map((evidence) => evidence.serverId ?? ''),
  ]);
  const evidenceByServer = new Map<string, MonitoringEvidenceRef>();
  for (const evidence of notableEvidenceRefs) {
    if (!evidence.serverId) continue;
    const existing = evidenceByServer.get(evidence.serverId);
    if (
      !existing ||
      severityRank(evidence.severity) > severityRank(existing.severity)
    ) {
      evidenceByServer.set(evidence.serverId, evidence);
    }
  }

  const monitoringAffectedServers: ToolBasedData['affectedServers'] =
    monitoringServerIds.map((serverId) => {
      const evidence = evidenceByServer.get(serverId);
      return {
        id: serverId,
        name: serverId,
        severity: evidence?.severity ?? 'warning',
        ...(evidence?.metric ? { metric: evidence.metric } : {}),
        ...(typeof evidence?.value === 'number'
          ? { value: evidence.value }
          : {}),
      };
    });
  const monitoringTimeline = notableTimelineEvents.map((event) => ({
    timestamp: event.timestamp,
    event: event.description,
    severity: event.severity,
  }));
  const monitoringPostmortemTimeline = notableTimelineEvents.map(
    (event) => `${formatTimelineTimestamp(event.timestamp)} - ${event.description}`
  );
  const monitoringRecommendations = notableEvidenceRefs
    .map(buildMonitoringRecommendation)
    .filter(
      (recommendation): recommendation is IncidentRecommendation =>
        recommendation !== null
    );
  const causalHypotheses = buildMonitoringCausalHypotheses(
    notableTimelineEvents,
    notableEvidenceRefs
  );
  const severity = [...notableEvidenceRefs, ...notableTimelineEvents].reduce(
    (current, item) => maxSeverity(current, item.severity),
    data.severity
  );
  const warningServerCount = monitoringAffectedServers.filter(
    (server) => server.severity !== 'critical'
  ).length;
  const criticalServerCount = monitoringAffectedServers.filter(
    (server) => server.severity === 'critical'
  ).length;
  const signalCount = Math.max(
    data.anomalies.length,
    notableTimelineEvents.length,
    notableEvidenceRefs.length
  );
  const hadMetricAnomalies = data.anomalies.length > 0;
  const title =
    data.severity === 'info' && !hadMetricAnomalies
      ? `로그 이상 감지: ${signalCount}건 발견`
      : data.title;
  const description =
    data.severity === 'info' && !hadMetricAnomalies
      ? `모니터링 로그/타임라인에서 ${signalCount}건의 warning/critical 이상 징후가 감지되었습니다.`
      : data.description;

  return {
    ...data,
    title,
    severity,
    description,
    affected_servers: uniqueStrings([
      ...data.affected_servers,
      ...monitoringServerIds,
    ]),
    affectedServers: mergeAffectedServerSummaries(
      data.affectedServers,
      monitoringAffectedServers
    ),
    system_summary: {
      ...data.system_summary,
      warning_servers: Math.max(
        data.system_summary.warning_servers,
        warningServerCount
      ),
      critical_servers: Math.max(
        data.system_summary.critical_servers,
        criticalServerCount
      ),
    },
    timeline: [...data.timeline, ...monitoringTimeline],
    recommendations: mergeIncidentRecommendations(
      [...data.recommendations, ...monitoringRecommendations],
      []
    ),
    pattern:
      data.pattern === '정상 패턴' ? '로그 기반 이상 패턴 감지됨' : data.pattern,
    postmortem: {
      timeline: uniqueStrings([
        ...data.postmortem.timeline,
        ...monitoringPostmortemTimeline,
      ]),
      hypotheses:
        causalHypotheses.length > 0
          ? uniqueStrings([
              ...causalHypotheses,
              ...data.postmortem.hypotheses.filter(
                (hypothesis) =>
                  hypothesis !==
                  '수집된 이상 징후를 기준으로 추가 원인 분석이 필요합니다.'
              ),
            ])
          : data.postmortem.hypotheses.length === 1 &&
              data.postmortem.hypotheses[0] ===
                '수집된 이상 징후를 기준으로 추가 원인 분석이 필요합니다.'
            ? [
                '로그 타임라인에서 warning/critical 이벤트가 확인되어 스토리지 I/O 또는 서비스 지연 가능성을 우선 확인해야 합니다.',
              ]
            : data.postmortem.hypotheses,
      prevention:
        monitoringRecommendations.length > 0
          ? mergeIncidentRecommendations(
              monitoringRecommendations,
              data.recommendations
            ).map((recommendation) => recommendation.action)
          : data.postmortem.prevention,
    },
  };
}
