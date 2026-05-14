import { generateTraceId } from '@/config/ai-proxy/tracing';
import type { ApiServerMetrics } from '@/services/metrics/MetricsProvider';
import { metricsProvider } from '@/services/metrics/MetricsProvider';
import { generateServerLogs } from '@/services/server-data/server-data-logs';
import {
  type ArtifactEvidence,
  attachArtifactEnvelopeMetadata,
  type ChatArtifactRequest,
  type OpsProcedureArtifact,
} from './types';

const DEFAULT_THRESHOLD = 80;

type OpsProcedureMetric = NonNullable<OpsProcedureArtifact['inputs']['metric']>;
type OpsProcedureType = OpsProcedureArtifact['procedureType'];
type OpsProcedureValidation = OpsProcedureArtifact['validation'];

const METRIC_LABELS: Record<OpsProcedureMetric, string> = {
  cpu: 'CPU',
  memory: 'Memory',
  disk: 'Disk',
  network: 'Network',
};

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}

function readMetric(query: string): OpsProcedureMetric {
  if (/메모리|memory|mem/i.test(query)) return 'memory';
  if (/디스크|disk|용량|storage/i.test(query)) return 'disk';
  if (/네트워크|network|트래픽/i.test(query)) return 'network';
  return 'cpu';
}

function readThreshold(query: string, fallback = DEFAULT_THRESHOLD): number {
  const percentMatches = [...query.matchAll(/(\d{1,3})\s*(?:%|퍼센트|프로)/g)];
  const percentValue = percentMatches.at(-1)?.[1];
  if (percentValue) {
    const value = Number(percentValue);
    if (Number.isFinite(value) && value >= 0 && value <= 100) return value;
  }

  const match = query.match(/(\d{1,3})(?:\s*%|퍼센트|프로)?/);
  if (!match) return fallback;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : fallback;
}

function readProcedureType(query: string): OpsProcedureType {
  if (
    /alertmanager|prometheus|alert\s*rule|알림\s*(규칙|설정)|yaml/i.test(query)
  ) {
    return 'alert-rule';
  }
  if (
    /runbook|런북|대응\s*(순서|절차)|원인과\s*대응|로그.*(원인|대응)/i.test(
      query
    )
  ) {
    return 'runbook';
  }
  return 'script';
}

function readTimeLabel(minuteOfDay?: number): string | undefined {
  if (typeof minuteOfDay !== 'number' || !Number.isFinite(minuteOfDay)) {
    return undefined;
  }
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} KST`;
}

function sortByMetric(
  servers: ApiServerMetrics[],
  metric: OpsProcedureMetric
): ApiServerMetrics[] {
  return [...servers].sort((left, right) => right[metric] - left[metric]);
}

function selectAffectedServers(
  servers: ApiServerMetrics[],
  metric: OpsProcedureMetric,
  threshold: number
): ApiServerMetrics[] {
  const sorted = sortByMetric(servers, metric);
  const breached = sorted.filter((server) => server[metric] >= threshold);
  return (breached.length > 0 ? breached : sorted).slice(0, 5);
}

function buildMetricEvidence(
  servers: ApiServerMetrics[],
  metric: OpsProcedureMetric,
  threshold: number
): ArtifactEvidence[] {
  return servers.map((server, index) => {
    const value = roundMetric(server[metric]);
    return {
      id: `ops-procedure-${metric}-${server.serverId || index}`,
      kind: 'metric',
      summary: `${server.hostname || server.serverId} ${METRIC_LABELS[metric]} ${value}% (기준 ${threshold}%)`,
      serverId: server.serverId,
      metric,
      severity:
        value >= 90 ? 'critical' : value >= threshold ? 'warning' : 'info',
    };
  });
}

function buildLogEvidence(
  servers: ApiServerMetrics[],
  metric: OpsProcedureMetric
): ArtifactEvidence[] {
  return servers.flatMap((server) =>
    generateServerLogs(
      {
        cpu: server.cpu,
        memory: server.memory,
        disk: server.disk,
        network: server.network,
      },
      server.serverId,
      { serverType: server.serverId }
    )
      .filter((log) => log.level === 'warn' || log.level === 'error')
      .slice(0, 2)
      .map(
        (log, index): ArtifactEvidence => ({
          id: `ops-procedure-log-${server.serverId}-${index}`,
          kind: 'log',
          summary: log.message.slice(0, 160),
          serverId: server.serverId,
          metric,
          severity: log.level === 'error' ? 'critical' : 'warning',
        })
      )
  );
}

function buildRunbook({
  procedureType,
  metric,
  threshold,
  affectedServers,
}: {
  procedureType: OpsProcedureType;
  metric: OpsProcedureMetric;
  threshold: number;
  affectedServers: ApiServerMetrics[];
}): OpsProcedureArtifact['runbook'] {
  const metricLabel = METRIC_LABELS[metric];
  const affectedSummary =
    affectedServers.length > 0
      ? affectedServers
          .slice(0, 3)
          .map(
            (server) =>
              `${server.hostname || server.serverId} ${roundMetric(server[metric])}%`
          )
          .join(', ')
      : '현재 스냅샷에서 대상 서버 없음';

  return {
    symptoms: [
      `${metricLabel} ${threshold}% 이상 조건을 운영 절차로 고정합니다.`,
      `대상 후보: ${affectedSummary}`,
    ],
    likelyCauses: [
      '트래픽 증가, 배치 작업, 특정 프로세스 과점유 가능성',
      '최근 배포나 설정 변경 후 리소스 사용률 상승 가능성',
    ],
    responseSteps:
      procedureType === 'runbook'
        ? [
            '관련 warning/error 로그를 먼저 확인합니다.',
            `${metricLabel} 상위 서버에서 프로세스와 서비스 상태를 점검합니다.`,
            '장애 영향이 확인되면 담당자에게 escalate하고 변경 이력을 대조합니다.',
          ]
        : [
            `${metricLabel} ${threshold}% 이상 서버를 알림 대상으로 선별합니다.`,
            'Slack webhook은 환경변수로 주입하고, 알림 폭주 방지를 위해 수동 검토 후 적용합니다.',
            '알림 후 동일 기준으로 메트릭을 재확인합니다.',
          ],
    validationSteps: [
      `OpenManager에서 ${metricLabel} 사용률을 재확인합니다.`,
      'journalctl 또는 서비스 로그에서 warning/error 재발 여부를 확인합니다.',
      '알림 또는 runbook 적용 후 10분 간격으로 같은 조건이 해소됐는지 재검증합니다.',
    ],
    rollbackOrStopConditions: [
      'Slack webhook URL이 검증되지 않았거나 알림 폭주가 발생하면 즉시 중단합니다.',
      '서비스 재시작, 삭제, 정리 같은 mutating 명령은 별도 승인 전 실행하지 않습니다.',
    ],
    limitations: [
      '이 산출물은 현재 OTel snapshot 기반 템플릿이며 원격 명령을 자동 실행하지 않습니다.',
      'Webhook URL, 운영 API endpoint, 배포 위치는 사용자가 안전하게 주입해야 합니다.',
    ],
  };
}

function shellArray(values: string[]): string {
  if (values.length === 0) return '()';
  return `(${values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(' ')})`;
}

function buildScriptBlock({
  metric,
  threshold,
  affectedServers,
}: {
  metric: OpsProcedureMetric;
  threshold: number;
  affectedServers: ApiServerMetrics[];
}): OpsProcedureArtifact['codeBlocks'][number] {
  const serverIds = affectedServers.map((server) => server.serverId);
  const metricLabel = METRIC_LABELS[metric];

  return {
    id: `ops-${metric}-slack-script`,
    title: `${metricLabel} Slack threshold notification template`,
    language: 'bash',
    content: [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      '',
      `THRESHOLD=${threshold}`,
      `SLACK_WEBHOOK_URL="\${SLACK_WEBHOOK_URL:-}"`,
      `AFFECTED_SERVERS=${shellArray(serverIds)}`,
      '',
      'if [[ -z "$SLACK_WEBHOOK_URL" ]]; then',
      '  echo "SLACK_WEBHOOK_URL is required" >&2',
      '  exit 1',
      'fi',
      '',
      `server_list=$(printf "%s, " "\${AFFECTED_SERVERS[@]}")`,
      `payload=$(printf '{"text":"OpenManager alert: ${metricLabel} threshold %s%% exceeded on %s"}' "$THRESHOLD" "\${server_list%, }")`,
      'curl -fsS -X POST -H "Content-Type: application/json" --data "$payload" "$SLACK_WEBHOOK_URL"',
    ].join('\n'),
    executable: false,
    requiredEnv: ['SLACK_WEBHOOK_URL'],
    safetyLevel: 'notification-only',
    notes: [
      '현재 snapshot 기반 템플릿이라 배포 전 데이터 소스 연결을 검토해야 합니다.',
      'Slack webhook URL은 secret으로 주입하고 코드/아티팩트에 저장하지 않습니다.',
    ],
  };
}

function buildAlertRuleBlocks({
  metric,
  threshold,
}: {
  metric: OpsProcedureMetric;
  threshold: number;
}): OpsProcedureArtifact['codeBlocks'] {
  const metricLabel = METRIC_LABELS[metric];
  const metricName = metricLabel.charAt(0) + metricLabel.slice(1).toLowerCase();
  const alertName = `High${metricName}Usage`;
  const promql =
    metric === 'cpu'
      ? `100 * (1 - avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m]))) > ${threshold}`
      : `openmanager_${metric}_usage_percent > ${threshold}`;

  return [
    {
      id: `ops-${metric}-promql`,
      title: `${metricLabel} threshold PromQL`,
      language: 'promql',
      content: promql,
      executable: false,
      requiredEnv: [],
      safetyLevel: 'read-only',
      notes: [
        'Prometheus metric 이름은 실제 운영 exporter에 맞춰 확인해야 합니다.',
      ],
    },
    {
      id: `ops-${metric}-alertmanager-yaml`,
      title: `${metricLabel} Prometheus rule and Alertmanager receiver`,
      language: 'yaml',
      content: [
        'groups:',
        '  - name: openmanager-ops-procedure',
        '    rules:',
        `      - alert: ${alertName}`,
        `        expr: ${promql}`,
        '        for: 5m',
        '        labels:',
        '          severity: warning',
        '        annotations:',
        `          summary: "${metricLabel} usage is above ${threshold}%"`,
        'receivers:',
        '  - name: slack-webhook',
        '    slack_configs:',
        '      - api_url: SLACK_WEBHOOK_URL',
        '        send_resolved: true',
      ].join('\n'),
      executable: false,
      requiredEnv: ['SLACK_WEBHOOK_URL'],
      safetyLevel: 'notification-only',
      notes: [
        'Alertmanager 설정에는 실제 webhook URL 대신 secret placeholder만 둡니다.',
        'Prometheus rule과 Alertmanager receiver/routing은 분리 적용해야 합니다.',
      ],
    },
  ];
}

function buildRunbookBlock(
  runbook: OpsProcedureArtifact['runbook']
): OpsProcedureArtifact['codeBlocks'][number] {
  return {
    id: 'ops-log-runbook-markdown',
    title: 'Log-driven response runbook',
    language: 'markdown',
    content: [
      '# 로그 기반 원인/대응 runbook',
      '',
      '## 증상',
      ...runbook.symptoms.map((item) => `- ${item}`),
      '',
      '## 대응 순서',
      ...runbook.responseSteps.map((item, index) => `${index + 1}. ${item}`),
      '',
      '## 검증',
      ...runbook.validationSteps.map((item) => `- ${item}`),
    ].join('\n'),
    executable: false,
    requiredEnv: [],
    safetyLevel: 'read-only',
    notes: ['명령 실행 전 대상 서버와 권한을 별도로 확인하세요.'],
  };
}

export function validateOpsProcedureArtifact(
  artifact: Pick<OpsProcedureArtifact, 'codeBlocks'>
): OpsProcedureValidation {
  const serialized = JSON.stringify(artifact.codeBlocks);
  const noFakeFunctions =
    !/filterServers\(|getServerMetrics|searchKnowledgeBase/i.test(serialized);
  const noHardcodedSecrets =
    !/https:\/\/hooks\.slack\.com\/services|xox[baprs]-|sk-[a-z0-9_-]+/i.test(
      serialized
    );

  return {
    noFakeFunctions,
    noHardcodedSecrets,
    requiresManualReview: true,
  };
}

export async function generateOpsProcedureArtifact({
  query,
  queryAsOfDataSlot,
  signal,
}: ChatArtifactRequest): Promise<OpsProcedureArtifact> {
  signal?.throwIfAborted();

  const metric = readMetric(query);
  const threshold = readThreshold(query);
  const procedureType = readProcedureType(query);
  const [servers, summary] = await Promise.all([
    metricsProvider.getAllServerMetrics(),
    metricsProvider.getSystemSummary(),
  ]);

  signal?.throwIfAborted();

  const affectedServers = selectAffectedServers(servers, metric, threshold);
  const metricEvidence = buildMetricEvidence(
    affectedServers,
    metric,
    threshold
  );
  const logEvidence =
    procedureType === 'runbook'
      ? buildLogEvidence(affectedServers, metric)
      : [];
  const evidence = [...metricEvidence, ...logEvidence];
  const runbook = buildRunbook({
    procedureType,
    metric,
    threshold,
    affectedServers,
  });
  const codeBlocks =
    procedureType === 'alert-rule'
      ? buildAlertRuleBlocks({ metric, threshold })
      : procedureType === 'runbook'
        ? [buildRunbookBlock(runbook)]
        : [buildScriptBlock({ metric, threshold, affectedServers })];
  const validation = validateOpsProcedureArtifact({ codeBlocks });
  const metricLabel = METRIC_LABELS[metric];
  const generatedAt = new Date().toISOString();

  return attachArtifactEnvelopeMetadata(
    {
      kind: 'ops-procedure',
      generatedAt,
      title:
        procedureType === 'alert-rule'
          ? `${metricLabel} ${threshold}% Slack 알림 규칙`
          : procedureType === 'runbook'
            ? '로그 기반 원인/대응 runbook'
            : `${metricLabel} ${threshold}% Slack 알림 운영 절차`,
      summary:
        procedureType === 'runbook'
          ? 'warning/error 로그와 현재 메트릭을 근거로 원인 후보, 대응 순서, 검증 절차를 정리했습니다.'
          : `${metricLabel} ${threshold}% 이상 조건을 기준으로 알림 산출물을 생성했습니다.`,
      procedureType,
      source: 'otel-static',
      queryAsOfDataSlot,
      inputs: {
        metric,
        threshold,
        serverScope: 'all',
        timeWindowMinutes: 10,
        notificationTarget:
          procedureType === 'runbook' ? 'none' : 'slack-webhook',
      },
      evidence,
      runbook,
      codeBlocks,
      validation,
    },
    {
      sourceMode: 'otel-static',
      dataSlot:
        queryAsOfDataSlot?.timeLabel ?? readTimeLabel(summary.minuteOfDay),
      traceId: generateTraceId(),
      evidence,
    }
  );
}

export function patchOpsProcedureArtifactFromQuery(
  artifact: OpsProcedureArtifact,
  query: string
): OpsProcedureArtifact {
  const nextThreshold = readThreshold(query, artifact.inputs.threshold);
  const previousThreshold = artifact.inputs.threshold;
  if (!nextThreshold || nextThreshold === previousThreshold) return artifact;

  const codeBlocks = artifact.codeBlocks.map((block) => ({
    ...block,
    content: block.content
      .replace(
        new RegExp(`THRESHOLD=${previousThreshold}\\b`, 'g'),
        `THRESHOLD=${nextThreshold}`
      )
      .replace(
        new RegExp(`> ${previousThreshold}\\b`, 'g'),
        `> ${nextThreshold}`
      )
      .replace(new RegExp(`${previousThreshold}%`, 'g'), `${nextThreshold}%`),
    notes: [
      ...block.notes,
      `임계치를 ${previousThreshold}%에서 ${nextThreshold}%로 수정했습니다.`,
    ],
  }));
  const nextTraceId = generateTraceId();
  const parentEvidence: ArtifactEvidence[] = artifact.traceId
    ? [
        {
          id: `ops-procedure-parent-${artifact.traceId.slice(0, 12)}`,
          kind: 'report',
          summary: `이전 운영 절차 trace ${artifact.traceId}를 기준으로 임계치를 ${previousThreshold}%에서 ${nextThreshold}%로 수정했습니다.`,
          severity: 'info',
        },
      ]
    : [];
  const evidence = [...artifact.evidence, ...parentEvidence];
  const updated: OpsProcedureArtifact = {
    ...artifact,
    generatedAt: new Date().toISOString(),
    traceId: nextTraceId,
    title: artifact.title.replace(
      new RegExp(`${previousThreshold}%`, 'g'),
      `${nextThreshold}%`
    ),
    summary: artifact.summary.replace(
      new RegExp(`${previousThreshold}%`, 'g'),
      `${nextThreshold}%`
    ),
    inputs: {
      ...artifact.inputs,
      threshold: nextThreshold,
    },
    evidence,
    codeBlocks,
    validation: validateOpsProcedureArtifact({ codeBlocks }),
  };

  return attachArtifactEnvelopeMetadata(updated, {
    sourceMode: updated.sourceMode ?? 'otel-static',
    dataSlot: updated.dataSlot,
    traceId: nextTraceId,
    evidence,
  });
}

export function buildOpsProcedureMarkdown(
  artifact: OpsProcedureArtifact
): string {
  return [
    `# ${artifact.title}`,
    '',
    `- 유형: ${artifact.procedureType}`,
    `- 기준: ${artifact.inputs.metric ?? 'metric'} ${artifact.inputs.threshold ?? '-'}%`,
    `- 생성 시각: ${new Date(artifact.generatedAt).toLocaleString('ko-KR')}`,
    '',
    artifact.summary,
    '',
    '## 증거',
    ...(artifact.evidence.length > 0
      ? artifact.evidence.map((entry) => `- [${entry.kind}] ${entry.summary}`)
      : ['- 증거 없음']),
    '',
    '## 대응 순서',
    ...artifact.runbook.responseSteps.map(
      (step, index) => `${index + 1}. ${step}`
    ),
    '',
    '## 검증',
    ...artifact.runbook.validationSteps.map((step) => `- ${step}`),
    '',
    '## 코드/설정',
    ...artifact.codeBlocks.flatMap((block) => [
      '',
      `### ${block.title}`,
      `- language: ${block.language}`,
      `- executable: ${block.executable ? 'true' : 'false'}`,
      `- safety: ${block.safetyLevel}`,
      '',
      `\`\`\`${block.language}`,
      block.content,
      '```',
    ]),
  ].join('\n');
}

export function buildOpsProcedureJson(artifact: OpsProcedureArtifact): string {
  return JSON.stringify(artifact, null, 2);
}
