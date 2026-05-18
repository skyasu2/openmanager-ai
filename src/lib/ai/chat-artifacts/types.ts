import type { IncidentReport } from '@/components/ai/pages/auto-report/types';
import {
  normalizeReporterDegradationReasonCode,
  normalizeReporterFallbackSource,
} from '@/lib/ai/degradation-metadata';
import type { JobDataSlot } from '@/types/ai-jobs';
import type {
  CloudRunAnalysisResponse,
  MonitoringBatchAnalysisResponse,
  MonitoringBatchCapacityAlert,
  ServerAnalysisResult,
} from '@/types/intelligent-monitoring.types';

export const ARTIFACT_CONTRACT_VERSION = '2026-05-03-v1';

export type ArtifactSourceMode =
  | 'otel-static'
  | 'tool-result'
  | 'restored-legacy';

export interface ArtifactEvidence {
  id: string;
  kind: 'metric' | 'log' | 'topology' | 'rule' | 'prediction' | 'report';
  summary: string;
  serverId?: string;
  metric?: string;
  severity?: 'info' | 'warning' | 'critical';
}

export interface ArtifactProviderAttemptSummary {
  provider: string;
  modelId?: string;
  status?: 'success' | 'failed' | 'skipped';
  errorCode?: string;
}

export interface ArtifactProviderSummary {
  provider?: string;
  modelId?: string;
  usedFallback?: boolean;
  fallbackReason?: string;
  attempts?: ArtifactProviderAttemptSummary[];
}

export interface ArtifactDegradationSummary {
  degraded: boolean;
  reasonCode?: string;
  fallbackSource?: string;
}

export interface ArtifactContractMetadata {
  artifactVersion?: string;
  sourceMode?: ArtifactSourceMode;
  dataSlot?: string;
  traceId?: string;
  evidence?: ArtifactEvidence[];
  providerSummary?: ArtifactProviderSummary;
  degradation?: ArtifactDegradationSummary;
}

export interface ChatArtifact extends ArtifactContractMetadata {
  kind: string;
  generatedAt: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface ChatArtifactRequest {
  query: string;
  sessionId?: string;
  queryAsOfDataSlot?: JobDataSlot;
  signal?: AbortSignal;
}

export interface IncidentReportArtifact extends ArtifactContractMetadata {
  kind: 'incident-report';
  generatedAt: string;
  report: IncidentReport;
  source?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface MonitoringAnalysisArtifact extends ArtifactContractMetadata {
  kind: 'monitoring-analysis';
  generatedAt: string;
  title: string;
  summary: string;
  serverCount: number;
  riskSignalCount: number;
  warningServers: number;
  criticalServers: number;
  analysis: MonitoringBatchAnalysisResponse;
  capacityAlerts?: MonitoringBatchCapacityAlert[];
  roleGroupSummary?: MonitoringRoleGroupSummary[];
  source?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface MonitoringRoleGroupSummary {
  role: string;
  count: number;
  warningCount: number;
  criticalCount: number;
  avgCpu: number;
  avgMemory: number;
  avgDisk: number;
}

export interface ServerMonitoringCurrentMetrics {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: number;
  load1?: number;
  load5?: number;
  cpuCores?: number;
}

export interface ServerMonitoringArtifactRequest extends ChatArtifactRequest {
  serverId: string;
  serverName: string;
  currentMetrics?: ServerMonitoringCurrentMetrics;
}

export interface ServerMonitoringAnalysisArtifact
  extends ArtifactContractMetadata {
  kind: 'server-monitoring-analysis';
  generatedAt: string;
  title: string;
  summary: string;
  serverId: string;
  serverName: string;
  overallStatus: ServerAnalysisResult['overallStatus'];
  analysis: CloudRunAnalysisResponse;
  server: ServerAnalysisResult;
  source?: string;
  queryAsOfDataSlot?: JobDataSlot;
}

export interface ServerSnapshotArtifact extends ArtifactContractMetadata {
  kind: 'server-snapshot';
  generatedAt: string;
  title: string;
  summary: string;
  source: 'otel-static';
  queryAsOfDataSlot?: JobDataSlot;
  slot: JobDataSlot;
  totals: {
    total: number;
    online: number;
    warning: number;
    critical: number;
    offline: number;
  };
  averages: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  topServers: Array<{
    id: string;
    name: string;
    status: 'online' | 'warning' | 'critical' | 'offline';
    cpu: number;
    memory: number;
    disk: number;
    network: number;
    primaryRisk: 'cpu' | 'memory' | 'disk' | 'network';
  }>;
  alerts: Array<{
    serverId: string;
    metric: 'cpu' | 'memory' | 'disk' | 'network';
    value: number;
    severity: 'warning' | 'critical';
    summary: string;
  }>;
}

export interface OpsProcedureArtifact extends ArtifactContractMetadata {
  kind: 'ops-procedure';
  generatedAt: string;
  title: string;
  summary: string;
  procedureType: 'runbook' | 'alert-rule' | 'script';
  source: 'tool-result' | 'otel-static';
  queryAsOfDataSlot?: JobDataSlot;
  inputs: {
    metric?: 'cpu' | 'memory' | 'disk' | 'network';
    threshold?: number;
    serverScope?: 'all' | 'group' | 'server';
    serverId?: string;
    group?: string;
    timeWindowMinutes?: number;
    notificationTarget?: 'slack-webhook' | 'none';
  };
  evidence: ArtifactEvidence[];
  runbook: {
    symptoms: string[];
    likelyCauses: string[];
    responseSteps: string[];
    validationSteps: string[];
    rollbackOrStopConditions: string[];
    limitations: string[];
  };
  codeBlocks: Array<{
    id: string;
    title: string;
    language: 'bash' | 'yaml' | 'promql' | 'markdown';
    content: string;
    executable: boolean;
    requiredEnv: string[];
    safetyLevel: 'read-only' | 'notification-only' | 'mutating';
    notes: string[];
  }>;
  validation: {
    noFakeFunctions: boolean;
    noHardcodedSecrets: boolean;
    requiresManualReview: boolean;
  };
}

export interface ArtifactEnvelope<
  TArtifact extends ChatArtifact = ChatArtifact,
> {
  domainId?: string;
  artifactVersion: string;
  kind: TArtifact['kind'];
  generatedAt: string;
  dataSlot?: string;
  sourceMode: ArtifactSourceMode;
  traceId?: string;
  evidence?: ArtifactEvidence[];
  providerSummary?: ArtifactProviderSummary;
  degradation?: ArtifactDegradationSummary;
  payload: TArtifact;
}

export interface CreateArtifactEnvelopeOptions {
  domainId?: string;
  artifactVersion?: string;
  dataSlot?: string;
  sourceMode?: ArtifactSourceMode;
  traceId?: string;
  evidence?: ArtifactEvidence[];
  providerSummary?: unknown;
  degradation?: unknown;
}

type VersionedArtifact<TArtifact extends ChatArtifact> = TArtifact & {
  artifactVersion: string;
  sourceMode: ArtifactSourceMode;
};

const PROVIDER_ATTEMPT_STATUSES = new Set(['success', 'failed', 'skipped']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPublicString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return trimmed
    .replace(/bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/sk-[a-z0-9_-]+/gi, '[redacted]')
    .slice(0, 160);
}

function readArtifactDataSlot(artifact: ChatArtifact): string | undefined {
  if (artifact.dataSlot) return artifact.dataSlot;
  if (artifact.queryAsOfDataSlot?.timeLabel) {
    return artifact.queryAsOfDataSlot.timeLabel;
  }

  const snapshotSlot = (artifact as { slot?: unknown }).slot;
  if (artifact.kind === 'server-snapshot' && isRecord(snapshotSlot)) {
    const timeLabel = readPublicString(snapshotSlot.timeLabel);
    if (timeLabel) return timeLabel;
  }

  const analysis = (artifact as { analysis?: unknown }).analysis;
  if (artifact.kind === 'monitoring-analysis') {
    if (!isRecord(analysis)) return undefined;
    const slot = analysis.slot;
    if (isRecord(slot)) return readPublicString(slot.timeLabel);
  }
  return undefined;
}

function readArtifactEvidence(value: unknown): ArtifactEvidence[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const evidence = value
    .map((entry): ArtifactEvidence | undefined => {
      if (!isRecord(entry)) return undefined;
      const id = readPublicString(entry.id);
      const kind = readPublicString(entry.kind);
      const summary = readPublicString(entry.summary);
      if (!id || !kind || !summary) return undefined;
      if (
        kind !== 'metric' &&
        kind !== 'log' &&
        kind !== 'topology' &&
        kind !== 'rule' &&
        kind !== 'prediction' &&
        kind !== 'report'
      ) {
        return undefined;
      }

      const severity = readPublicString(entry.severity);
      return {
        id,
        kind,
        summary,
        ...(readPublicString(entry.serverId) && {
          serverId: readPublicString(entry.serverId),
        }),
        ...(readPublicString(entry.metric) && {
          metric: readPublicString(entry.metric),
        }),
        ...(severity === 'info' ||
        severity === 'warning' ||
        severity === 'critical'
          ? { severity }
          : {}),
      };
    })
    .filter((entry): entry is ArtifactEvidence => entry !== undefined);

  return evidence.length > 0 ? evidence : undefined;
}

export function sanitizeArtifactProviderSummary(
  value: unknown
): ArtifactProviderSummary | undefined {
  if (!isRecord(value)) return undefined;

  const attempts = Array.isArray(value.attempts)
    ? value.attempts
        .map((entry): ArtifactProviderAttemptSummary | undefined => {
          if (!isRecord(entry)) return undefined;
          const provider = readPublicString(entry.provider);
          if (!provider) return undefined;
          const status = readPublicString(entry.status);

          return {
            provider,
            ...(readPublicString(entry.modelId) && {
              modelId: readPublicString(entry.modelId),
            }),
            ...(status && PROVIDER_ATTEMPT_STATUSES.has(status)
              ? {
                  status: status as ArtifactProviderAttemptSummary['status'],
                }
              : {}),
            ...(readPublicString(entry.errorCode) && {
              errorCode: readPublicString(entry.errorCode),
            }),
          };
        })
        .filter(
          (entry): entry is ArtifactProviderAttemptSummary =>
            entry !== undefined
        )
    : undefined;

  const summary: ArtifactProviderSummary = {
    ...(readPublicString(value.provider) && {
      provider: readPublicString(value.provider),
    }),
    ...(readPublicString(value.modelId) && {
      modelId: readPublicString(value.modelId),
    }),
    ...(typeof value.usedFallback === 'boolean' && {
      usedFallback: value.usedFallback,
    }),
    ...(readPublicString(value.fallbackReason) && {
      fallbackReason: readPublicString(value.fallbackReason),
    }),
    ...(attempts && attempts.length > 0 && { attempts }),
  };

  return Object.keys(summary).length > 0 ? summary : undefined;
}

export function sanitizeArtifactDegradationSummary(
  value: unknown
): ArtifactDegradationSummary | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.degraded !== 'boolean') return undefined;

  return {
    degraded: value.degraded,
    ...(value.degraded && {
      reasonCode: normalizeReporterDegradationReasonCode(value.reasonCode),
      fallbackSource: normalizeReporterFallbackSource(value.fallbackSource),
    }),
  };
}

export function createArtifactEnvelope<TArtifact extends ChatArtifact>(
  artifact: TArtifact,
  options: CreateArtifactEnvelopeOptions = {}
): ArtifactEnvelope<TArtifact> {
  const providerSummary = sanitizeArtifactProviderSummary(
    options.providerSummary ?? artifact.providerSummary
  );
  const degradation = sanitizeArtifactDegradationSummary(
    options.degradation ?? artifact.degradation
  );
  const evidence = options.evidence ?? readArtifactEvidence(artifact.evidence);

  return {
    ...(options.domainId && { domainId: options.domainId }),
    artifactVersion:
      options.artifactVersion ??
      artifact.artifactVersion ??
      ARTIFACT_CONTRACT_VERSION,
    kind: artifact.kind,
    generatedAt: artifact.generatedAt,
    ...((options.dataSlot ?? readArtifactDataSlot(artifact)) && {
      dataSlot: options.dataSlot ?? readArtifactDataSlot(artifact),
    }),
    sourceMode: options.sourceMode ?? artifact.sourceMode ?? 'restored-legacy',
    ...((options.traceId ?? artifact.traceId) && {
      traceId: options.traceId ?? artifact.traceId,
    }),
    ...(evidence && { evidence }),
    ...(providerSummary && { providerSummary }),
    ...(degradation && { degradation }),
    payload: artifact,
  };
}

export function readArtifactEnvelope<TArtifact extends ChatArtifact>(
  artifact: TArtifact
): ArtifactEnvelope<TArtifact> {
  return createArtifactEnvelope(artifact, {
    sourceMode: artifact.sourceMode ?? 'restored-legacy',
  });
}

export function attachArtifactEnvelopeMetadata<TArtifact extends ChatArtifact>(
  artifact: TArtifact,
  options: CreateArtifactEnvelopeOptions
): VersionedArtifact<TArtifact> {
  const envelope = createArtifactEnvelope(artifact, options);

  return {
    ...artifact,
    artifactVersion: envelope.artifactVersion,
    sourceMode: envelope.sourceMode,
    ...(envelope.dataSlot && { dataSlot: envelope.dataSlot }),
    ...(envelope.traceId && { traceId: envelope.traceId }),
    ...(envelope.evidence && { evidence: envelope.evidence }),
    ...(envelope.providerSummary && {
      providerSummary: envelope.providerSummary,
    }),
    ...(envelope.degradation && { degradation: envelope.degradation }),
  };
}
