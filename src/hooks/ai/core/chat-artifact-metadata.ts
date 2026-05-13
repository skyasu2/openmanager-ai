import type { UIMessage } from '@ai-sdk/react';
import {
  buildAssistantPlanFromRouteDecision,
  buildAssistantResultFromRouteDecision,
} from '@/lib/ai/assistant-contract';
import {
  type ChatArtifactIntentReason,
  createArtifactGuidanceMessage,
} from '@/lib/ai/chat-artifacts/chat-artifact-intent';
import {
  type ChatArtifact,
  createArtifactEnvelope,
} from '@/lib/ai/chat-artifacts/types';
import { MONITORING_ARTIFACT_RENDERER_DOMAIN_ID } from '@/lib/ai/domain-renderers/artifact-renderer-registry';
import { buildRouteDecision } from '@/lib/ai/route-decision';
import type { JobDataSlot } from '@/types/ai-jobs';

export function createTextMessage({
  id,
  role,
  text,
  metadata,
}: {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  metadata?: Record<string, unknown>;
}): UIMessage {
  return {
    id,
    role,
    parts: [{ type: 'text', text }],
    ...(metadata && { metadata }),
  };
}

export function createArtifactGuidanceMessages({
  query,
  target,
  reason,
}: {
  query: string;
  target: 'incident-report' | 'monitoring-analysis';
  reason: ChatArtifactIntentReason;
}): [UIMessage, UIMessage] {
  const token = Date.now().toString(36);

  return [
    createTextMessage({
      id: `artifact-guidance-user-${token}`,
      role: 'user',
      text: query,
    }),
    createTextMessage({
      id: `artifact-guidance-assistant-${token}`,
      role: 'assistant',
      text: createArtifactGuidanceMessage(target),
      metadata: {
        artifactIntentReason: reason,
        artifactIntentTarget: target,
      },
    }),
  ];
}

export function getArtifactLoadingText(kind: ChatArtifact['kind']): string {
  switch (kind) {
    case 'incident-report':
      return '장애 보고서를 작성하고 있습니다.';
    case 'monitoring-analysis':
      return '이상감지/추세 분석을 실행하고 있습니다.';
    case 'server-monitoring-analysis':
      return '단일 서버 이상감지/추세 분석을 실행하고 있습니다.';
    case 'server-snapshot':
      return '서버 상태 스냅샷을 생성하고 있습니다.';
    case 'ops-procedure':
      return '운영 절차 아티팩트를 생성하고 있습니다.';
  }
}

export function getArtifactSuccessText(artifact: ChatArtifact): string {
  if (artifact.kind === 'incident-report') {
    return [
      '장애 보고서를 작성했습니다.',
      '',
      `- 제목: ${artifact.report.title}`,
      `- 영향 서버: ${artifact.report.affectedServers.length}대`,
      '',
      '아래 카드에서 MD/TXT 파일로 내려받거나 장애 보고서 작성 화면에서 확인할 수 있습니다.',
    ].join('\n');
  }

  if (artifact.kind === 'server-snapshot') {
    return [
      '서버 상태 스냅샷을 생성했습니다.',
      '',
      `- 총 서버: ${artifact.totals.total}대`,
      `- 주의/위험: ${
        artifact.totals.warning +
        artifact.totals.critical +
        artifact.totals.offline
      }대`,
      '',
      '아래 카드에서 MD/JSON 파일로 내려받을 수 있습니다.',
    ].join('\n');
  }

  if (artifact.kind === 'ops-procedure') {
    return [
      '운영 절차 아티팩트를 생성했습니다.',
      '',
      `- 유형: ${artifact.procedureType}`,
      `- 기준: ${artifact.inputs.metric?.toUpperCase() ?? 'metric'} ${
        artifact.inputs.threshold ?? '-'
      }%`,
      '',
      '아래 카드에서 MD/JSON 파일로 내려받고 코드/설정의 검증 상태를 확인할 수 있습니다.',
    ].join('\n');
  }

  if (artifact.kind === 'server-monitoring-analysis') {
    return [
      '단일 서버 이상감지/추세 분석을 완료했습니다.',
      '',
      `- 서버: ${artifact.serverName}`,
      `- 상태: ${artifact.overallStatus}`,
      `- 이상 신호: ${artifact.server.anomalyDetection?.anomalyCount ?? 0}건`,
      '',
      '아래 카드에서 MD/JSON 파일로 내려받을 수 있습니다.',
    ].join('\n');
  }

  return [
    '이상감지/추세 분석을 완료했습니다.',
    '',
    `- 분석 서버: ${artifact.serverCount}대`,
    `- 위험 신호: ${artifact.riskSignalCount}건`,
    '',
    '아래 카드에서 MD/JSON 파일로 내려받거나 이상감지/추세 화면에서 확인할 수 있습니다.',
  ].join('\n');
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

export function getArtifactErrorText(
  kind: ChatArtifact['kind'],
  error: unknown
): string {
  const target = getArtifactActionLabel(kind);
  if (isAbortError(error)) {
    return `${target}을 중단했습니다.`;
  }

  const message = error instanceof Error ? error.message : String(error);
  return `${target}을 완료하지 못했습니다. ${message}`;
}

export function buildArtifactMetadata(
  artifact: ChatArtifact,
  intentReason: ChatArtifactIntentReason,
  queryAsOfDataSlot?: JobDataSlot
): Record<string, unknown> {
  const routeDecision = buildArtifactRouteDecision(
    artifact.kind,
    intentReason,
    queryAsOfDataSlot
  );
  const assistantPlan = buildAssistantPlanFromRouteDecision(routeDecision);
  const assistantResult = buildAssistantResultFromRouteDecision(routeDecision);
  const artifactEnvelope = createArtifactEnvelope(artifact, {
    domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
    sourceMode:
      artifact.sourceMode ??
      (artifact.kind === 'server-snapshot' ? 'otel-static' : 'tool-result'),
    ...(queryAsOfDataSlot?.timeLabel && {
      dataSlot: queryAsOfDataSlot.timeLabel,
    }),
  });

  if (artifact.kind === 'incident-report') {
    return {
      artifactIntentReason: intentReason,
      routeDecision,
      assistantPlan,
      assistantResult,
      artifactEnvelopes: [artifactEnvelope],
      incidentReportArtifact: artifact,
      toolsCalled: ['generateIncidentReportArtifact'],
      toolResultSummaries: [
        {
          toolName: 'generateIncidentReportArtifact',
          label: '장애 보고서 작성',
          summary: `${artifact.report.title} 보고서를 생성했습니다.`,
          status: 'completed' as const,
        },
      ],
    };
  }

  if (artifact.kind === 'server-snapshot') {
    return {
      artifactIntentReason: intentReason,
      routeDecision,
      assistantPlan,
      assistantResult,
      artifactEnvelopes: [artifactEnvelope],
      serverSnapshotArtifact: artifact,
      toolsCalled: ['generateServerSnapshotArtifact'],
      toolResultSummaries: [
        {
          toolName: 'generateServerSnapshotArtifact',
          label: '서버 상태 스냅샷',
          summary: `${artifact.totals.total}대 서버 상태 스냅샷을 생성했습니다.`,
          status: 'completed' as const,
        },
      ],
    };
  }

  if (artifact.kind === 'ops-procedure') {
    return {
      artifactIntentReason: intentReason,
      routeDecision,
      assistantPlan,
      assistantResult,
      artifactEnvelopes: [artifactEnvelope],
      opsProcedureArtifact: artifact,
      toolsCalled: ['generateOpsProcedureArtifact'],
      toolResultSummaries: [
        {
          toolName: 'generateOpsProcedureArtifact',
          label: '운영 절차 아티팩트',
          summary: `${artifact.procedureType} 절차를 생성했습니다.`,
          status: 'completed' as const,
        },
      ],
    };
  }

  if (artifact.kind === 'server-monitoring-analysis') {
    return {
      artifactIntentReason: intentReason,
      routeDecision,
      assistantPlan,
      assistantResult,
      artifactEnvelopes: [artifactEnvelope],
      serverMonitoringAnalysisArtifact: artifact,
      toolsCalled: ['generateServerMonitoringArtifact'],
      toolResultSummaries: [
        {
          toolName: 'generateServerMonitoringArtifact',
          label: '단일 서버 이상감지/추세 분석',
          summary: `${artifact.serverName} 분석 결과를 ${artifact.overallStatus} 상태로 정리했습니다.`,
          status: 'completed' as const,
        },
      ],
    };
  }

  return {
    artifactIntentReason: intentReason,
    routeDecision,
    assistantPlan,
    assistantResult,
    artifactEnvelopes: [artifactEnvelope],
    monitoringAnalysisArtifact: artifact,
    toolsCalled: ['generateMonitoringAnalysisArtifact'],
    toolResultSummaries: [
      {
        toolName: 'generateMonitoringAnalysisArtifact',
        label: '이상감지/추세 분석',
        summary: `${artifact.serverCount}개 서버 분석과 위험 신호 ${artifact.riskSignalCount}건을 정리했습니다.`,
        status: 'completed' as const,
      },
    ],
  };
}

export function buildArtifactErrorMetadata({
  artifactKind,
  intentReason,
  queryAsOfDataSlot,
  requestError,
  errorText,
}: {
  artifactKind: ChatArtifact['kind'];
  intentReason: ChatArtifactIntentReason;
  queryAsOfDataSlot?: JobDataSlot;
  requestError: unknown;
  errorText: string;
}): Record<string, unknown> {
  const routeDecision = buildArtifactRouteDecision(
    artifactKind,
    intentReason,
    queryAsOfDataSlot
  );
  const descriptor = getArtifactToolDescriptor(artifactKind);

  return {
    artifactIntentReason: intentReason,
    routeDecision,
    assistantPlan: buildAssistantPlanFromRouteDecision(routeDecision),
    assistantResult: buildAssistantResultFromRouteDecision(routeDecision, {
      status: 'failed',
      errorCode: isAbortError(requestError)
        ? 'ARTIFACT_ABORTED'
        : 'ARTIFACT_GENERATION_FAILED',
    }),
    toolResultSummaries: [
      {
        toolName: descriptor.toolName,
        label: descriptor.label,
        summary: errorText,
        status: 'failed' as const,
      },
    ],
  };
}

function buildArtifactRouteDecision(
  artifactKind: ChatArtifact['kind'],
  intentReason: ChatArtifactIntentReason,
  queryAsOfDataSlot?: JobDataSlot
) {
  return buildRouteDecision({
    intent: 'artifact',
    executionPath: 'client-artifact',
    artifactKind,
    reasonCodes: [intentReason],
    decidedBy: 'frontend',
    ...(queryAsOfDataSlot?.timeLabel && {
      dataSlot: queryAsOfDataSlot.timeLabel,
    }),
  });
}

function getArtifactToolDescriptor(kind: ChatArtifact['kind']): {
  toolName: string;
  label: string;
} {
  switch (kind) {
    case 'incident-report':
      return {
        toolName: 'generateIncidentReportArtifact',
        label: '장애 보고서 작성',
      };
    case 'server-snapshot':
      return {
        toolName: 'generateServerSnapshotArtifact',
        label: '서버 상태 스냅샷',
      };
    case 'ops-procedure':
      return {
        toolName: 'generateOpsProcedureArtifact',
        label: '운영 절차 아티팩트',
      };
    case 'monitoring-analysis':
      return {
        toolName: 'generateMonitoringAnalysisArtifact',
        label: '이상감지/추세 분석',
      };
    case 'server-monitoring-analysis':
      return {
        toolName: 'generateServerMonitoringArtifact',
        label: '단일 서버 이상감지/추세 분석',
      };
  }
}

function getArtifactActionLabel(kind: ChatArtifact['kind']): string {
  switch (kind) {
    case 'incident-report':
      return '장애 보고서 작성';
    case 'server-snapshot':
      return '서버 상태 스냅샷 생성';
    case 'ops-procedure':
      return '운영 절차 생성';
    case 'monitoring-analysis':
      return '이상감지/추세 분석';
    case 'server-monitoring-analysis':
      return '단일 서버 이상감지/추세 분석';
  }
}
