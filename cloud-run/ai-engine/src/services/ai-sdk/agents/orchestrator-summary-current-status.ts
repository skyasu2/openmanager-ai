import {
  toNumber,
  type AlertServerSnapshot,
  type MetricsToolPayload,
  type ServerSnapshot,
} from './orchestrator-summary-payload';
import { getReadOnlyDiagnosticCommands } from '../../../tools-ai-sdk/reporter-tools/knowledge-command-catalog';
import type { DiagnosticMetric } from '../../../tools-ai-sdk/reporter-tools/knowledge-types';
import { isRestartNeededLookupQuery } from '../routing/routing-patterns';

function roundPercent(value: number | null): string {
  return value === null ? 'N/A' : `${Math.round(value)}%`;
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
  };
}

function deriveAlertServers(payload: MetricsToolPayload): AlertServerSnapshot[] {
  if (payload.alertServers && payload.alertServers.length > 0) {
    return payload.alertServers;
  }

  return payload.servers
    .filter((server) =>
      ['warning', 'critical', 'offline'].includes(server.status)
    )
    .map(toAlertSnapshot);
}

function getDominantMetric(alertServer: AlertServerSnapshot): {
  metricLabel: string;
  metricValue: number | null;
} {
  const metrics = [
    { label: 'CPU', value: toNumber(alertServer.cpu) },
    { label: '메모리', value: toNumber(alertServer.memory) },
    { label: '디스크', value: toNumber(alertServer.disk) },
  ];

  const dominantMetric =
    metrics
      .filter((metric): metric is { label: string; value: number } =>
        metric.value !== null
      )
      .sort((left, right) => right.value - left.value)[0] ?? null;

  return dominantMetric
    ? { metricLabel: dominantMetric.label, metricValue: dominantMetric.value }
    : { metricLabel: '상태', metricValue: null };
}

function buildActionPoolForServer(server: AlertServerSnapshot): string[] {
  const dominantMetric = getDominantMetric(server);
  if (dominantMetric.metricLabel === 'CPU') {
    return [
      `${server.id}: 상위 프로세스와 스레드/worker 점유율을 확인하세요.`,
      `${server.id}: 최근 배포, 배치 작업, 트래픽 분산 편차를 함께 확인하세요.`,
    ];
  }

  if (dominantMetric.metricLabel === '메모리') {
    return [
      `${server.id}: 메모리 상위 프로세스와 OOM/GC 로그를 확인하세요.`,
      `${server.id}: cache eviction, 세션 증가, 누수 가능성을 우선 점검하세요.`,
    ];
  }

  if (dominantMetric.metricLabel === '디스크') {
    return [
      `${server.id}: 로그 적체와 임시 파일 증가 경로를 확인하세요.`,
      `${server.id}: 백업 산출물과 회전 정책이 정상 동작하는지 점검하세요.`,
    ];
  }

  return [
    `${server.id}: 헬스체크, 최근 배포 이력, 애플리케이션 로그를 확인하세요.`,
    `${server.id}: 알림 발생 시각 전후의 트래픽과 배치 작업을 비교하세요.`,
  ];
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
  if (dominantMetric.metricLabel === 'CPU') {
    return { metric: 'cpu', label: 'CPU' };
  }
  if (dominantMetric.metricLabel === '메모리') {
    return { metric: 'memory', label: '메모리' };
  }
  if (dominantMetric.metricLabel === '디스크') {
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

function shouldIncludeDiagnosticsForServerDetail(
  query: string,
  server: AlertServerSnapshot
): boolean {
  return (
    ['warning', 'critical', 'offline'].includes(server.status) ||
    /상세|자세|확인|진단|명령어|command|check|diagnos/i.test(query)
  );
}

function buildDiagnosticCommandBlock(
  server: AlertServerSnapshot
): string[] {
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

function getAttentionServer(payload: MetricsToolPayload): AlertServerSnapshot | null {
  const alertServers = deriveAlertServers(payload).filter(
    (server) => server.status !== 'offline'
  );
  if (alertServers.length > 0) {
    return alertServers
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
      })[0];
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

function normalizeServerAlias(value: string): string {
  return value.trim().toLowerCase();
}

function buildServerAliases(server: ServerSnapshot): string[] {
  const aliases = new Set<string>([server.id]);
  if (server.name) aliases.add(server.name);

  const idMatch = server.id.match(/^([a-z0-9]+)-([a-z0-9]+)-dc\d+-(\d{2})$/i);
  if (idMatch) {
    const [, role, service, ordinal] = idMatch;
    aliases.add(`${role}-server-${ordinal}`);
    aliases.add(`${role}-${ordinal}`);
    aliases.add(`${service}-server-${ordinal}`);
    aliases.add(`${role}-${service}-${ordinal}`);
  }

  if (server.type) {
    const ordinal = server.id.match(/-(\d{2})$/i)?.[1];
    if (ordinal) {
      aliases.add(`${server.type}-server-${ordinal}`);
      aliases.add(`${server.type}-${ordinal}`);
    }
  }

  return Array.from(aliases)
    .map(normalizeServerAlias)
    .filter((alias) => alias.length > 0);
}

function collectLookupServers(
  payload: MetricsToolPayload,
  lookupPayload?: MetricsToolPayload | null
): ServerSnapshot[] {
  const seen = new Set<string>();
  const servers: ServerSnapshot[] = [];

  for (const server of [...payload.servers, ...(lookupPayload?.servers ?? [])]) {
    const id = normalizeServerAlias(server.id);
    if (seen.has(id)) continue;
    seen.add(id);
    servers.push(server);
  }

  return servers;
}

function getRequestedServerMatches(
  query: string,
  payload: MetricsToolPayload,
  lookupPayload?: MetricsToolPayload | null
): Array<{ server: ServerSnapshot; requestedAlias: string }> {
  const normalizedQuery = normalizeServerAlias(query);
  const matches: Array<{ server: ServerSnapshot; requestedAlias: string }> = [];
  const seen = new Set<string>();

  for (const server of collectLookupServers(payload, lookupPayload)) {
    const matchedAlias = buildServerAliases(server).find((alias) =>
      normalizedQuery.includes(alias)
    );
    if (!matchedAlias) continue;

    const id = normalizeServerAlias(server.id);
    if (seen.has(id)) continue;
    seen.add(id);
    matches.push({ server, requestedAlias: matchedAlias });
  }

  return matches;
}

function isServerDetailStatusQuery(query: string): boolean {
  return /상태|현황|자세|상세|health|status|detail|어때|알려/i.test(query);
}

function isMetricIssueFilterQuery(query: string): boolean {
  return /(?:\bcpu\b|씨피유|메모리|\bmem\b|\bmemory\b|디스크|\bdisk\b|스토리지|\bstorage\b|네트워크|\bnetwork\b|\bnet\b).{0,24}(?:문제|이상|비정상|위험|경고|포화|병목|장애).{0,32}(?:있는|인|난|발생|것만|골라|추려|필터|filter|only)/i.test(
    query
  );
}

function isActionNeededQuery(query: string): boolean {
  if (isMetricIssueFilterQuery(query)) return false;

  return (
    isRestartNeededLookupQuery(query) ||
    /(?:지금|현재|당장|즉시).{0,32}(?:조치|대응).{0,32}(?:필요|해야|대상|있|시급).{0,16}(?:서버|대상|순위)/i.test(query) ||
    /(?:조치|대응).{0,16}(?:필요한|필요|대상|시급).{0,16}(?:서버|순위)/i.test(query) ||
    /(?:서버|대상).{0,16}(?:조치|대응).{0,16}(?:필요|시급|우선순위|순위)|immediate\s+action|urgent\s+action|action\s+needed/i.test(
      query
    ) ||
    /(?:가장\s*)?(?:위험한|위험도\s*높은).{0,24}(?:서버|대상|순위)/i.test(query) ||
    /(?:어떤|어느|무슨)?\s*(?:서버|대상).{0,24}(?:가장\s*)?(?:위험한|위험도\s*높은)/i.test(query) ||
    /문제\s*(?:있는|가\s*있는|있\s*는)\s*(?:서버|대상|시스템)/i.test(query) ||
    /(?:서버|대상|시스템).{0,20}문제\s*(?:있|가\s*있)/i.test(query) ||
    /이상\s*(?:있는|이\s*있는)\s*(?:서버|대상)/i.test(query) ||
    /비정상\s*(?:서버|대상|인\s*서버)/i.test(query) ||
    /장애\s*(?:있는|가\s*있는)\s*(?:서버|대상)/i.test(query) ||
    /most\s+at\s+risk|problematic\s+servers?|faulty\s+servers?|unhealthy\s+servers?/i.test(query)
  );
}

function formatOptionalPercent(label: string, value: number | null): string {
  return `${label} ${roundPercent(value)}`;
}

function formatOptionalNumber(
  label: string,
  value: number | undefined
): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${label} ${Math.round(value * 100) / 100}`
    : null;
}

function formatServerDetailLine(server: ServerSnapshot): string {
  return [
    formatOptionalPercent('CPU', toNumber(server.cpu)),
    formatOptionalPercent('메모리', toNumber(server.memory)),
    formatOptionalPercent('디스크', toNumber(server.disk)),
    formatOptionalPercent('네트워크', toNumber(server.network)),
  ].join(', ');
}

function buildServerStatusJudgement(server: AlertServerSnapshot): string {
  if (server.status === 'critical') {
    return '위험 상태라 즉시 원인 확인과 부하 완화가 필요합니다.';
  }
  if (server.status === 'warning') {
    return '경고 상태라 추세가 지속되는지 우선 관찰하고 병목 지표를 확인하세요.';
  }
  if (server.status === 'offline') {
    return '오프라인 상태라 헬스체크와 최근 배포 이력을 즉시 확인해야 합니다.';
  }
  return '현재 정상 범위이며 즉시 조치보다 추세 관찰이 적절합니다.';
}

export function buildRequestedServerStatusAnswer(
  query: string,
  payload: MetricsToolPayload,
  lookupPayload?: MetricsToolPayload | null
): string | null {
  if (!isServerDetailStatusQuery(query)) return null;

  const requestedServers = getRequestedServerMatches(query, payload, lookupPayload);
  if (requestedServers.length === 0) return null;

  const lines = ['📊 **요청 서버 상세**'];
  const diagnosticServers: AlertServerSnapshot[] = [];
  for (const { server, requestedAlias } of requestedServers) {
    const alertServer = toAlertSnapshot(server);
    const extraMetrics = [
      formatOptionalNumber('load1', server.load1),
      formatOptionalNumber('load5', server.load5),
      server.responseTimeMs !== undefined
        ? `응답시간 ${Math.round(server.responseTimeMs)}ms`
        : null,
    ].filter((item): item is string => item !== null);

    lines.push(
      `• 요청 별칭: ${requestedAlias} → ${server.id}`,
      `• 상태 ${server.status}, ${formatServerDetailLine(server)}`,
      ...(extraMetrics.length > 0 ? [`• 확장 지표: ${extraMetrics.join(', ')}`] : []),
      `• 판단: ${buildServerStatusJudgement(alertServer)}`
    );

    if (shouldIncludeDiagnosticsForServerDetail(query, alertServer)) {
      diagnosticServers.push(alertServer);
    }
  }

  appendDiagnosticCommandSection(lines, diagnosticServers);

  return lines.join('\n');
}

export function buildActionNeededAnswer(
  query: string,
  payload: MetricsToolPayload
): string | null {
  if (!isActionNeededQuery(query)) return null;

  const alertServers = deriveAlertServers(payload);
  const immediateServers = alertServers
    .filter((server) => server.status === 'critical' || server.status === 'offline')
    .sort(
      (left, right) =>
        (getDominantMetric(right).metricValue ?? 0) -
        (getDominantMetric(left).metricValue ?? 0)
    );
  const cautionServers = alertServers
    .filter((server) => server.status === 'warning')
    .sort(
      (left, right) =>
        (getDominantMetric(right).metricValue ?? 0) -
        (getDominantMetric(left).metricValue ?? 0)
    );
  const actionFocus = [...immediateServers, ...cautionServers].slice(0, 3);

  const lines = ['🚨 **즉시 조치 필요 여부**'];
  if (immediateServers.length > 0) {
    lines.push(
      `• 즉시 조치 대상은 ${immediateServers.length}대입니다: ${immediateServers.map((server) => server.id).join(', ')}.`
    );
  } else {
    lines.push('• 즉시 조치 대상은 없습니다.');
  }

  if (cautionServers.length > 0) {
    lines.push(
      `• 주의 관찰 대상은 ${cautionServers.length}대입니다: ${cautionServers.map((server) => server.id).join(', ')}.`
    );
  }

  if (actionFocus.length === 0) {
    const attentionServer = getAttentionServer(payload);
    if (attentionServer) {
      const dominantMetric = getDominantMetric(attentionServer);
      lines.push(
        '',
        '📌 **관찰 우선 서버**',
        `• ${attentionServer.id}: ${dominantMetric.metricLabel} ${roundPercent(dominantMetric.metricValue)}`
      );
    }
    return lines.join('\n');
  }

  lines.push('', '📌 **우선순위**');
  actionFocus.forEach((server, index) => {
    const dominantMetric = getDominantMetric(server);
    const label =
      server.status === 'critical' || server.status === 'offline'
        ? '즉시 조치'
        : '주의 관찰';
    lines.push(
      `${index + 1}. ${server.id}: ${label} - ${dominantMetric.metricLabel} ${roundPercent(dominantMetric.metricValue)} (상태 ${server.status})`
    );
  });

  lines.push('', '💡 **권장 확인**');
  actionFocus.slice(0, 2).forEach((server, index) => {
    lines.push(`${index + 1}. ${buildActionPoolForServer(server)[0]}`);
  });

  appendDiagnosticCommandSection(lines, actionFocus.slice(0, 2));

  return lines.join('\n');
}
