import {
  createArtifactReplayPack,
  MONITORING_ARTIFACT_DOMAIN_ID,
} from './artifact-workspace-registry';
import {
  type ArtifactWorkspaceStore,
  createArtifactWorkspaceStore,
} from './artifact-workspace-store';
import { generateIncidentReportArtifact } from './incident-report-artifact';
import {
  generateMonitoringAnalysisArtifact,
  generateServerMonitoringArtifact,
} from './monitoring-analysis-artifact';
import {
  type ChatArtifact,
  type ChatArtifactRequest,
  createArtifactEnvelope,
  type IncidentReportArtifact,
  type MonitoringAnalysisArtifact,
  type ServerMonitoringAnalysisArtifact,
  type ServerMonitoringArtifactRequest,
} from './types';

export type ExecutableSurfaceArtifactKind =
  | 'incident-report'
  | 'monitoring-analysis'
  | 'server-monitoring-analysis';

export type ExecutableSurfaceArtifact<
  TKind extends ExecutableSurfaceArtifactKind = ExecutableSurfaceArtifactKind,
> = Extract<ChatArtifact, { kind: TKind }>;

type ExecuteChatArtifactRequestByKind = {
  'incident-report': ChatArtifactRequest & { kind: 'incident-report' };
  'monitoring-analysis': ChatArtifactRequest & { kind: 'monitoring-analysis' };
  'server-monitoring-analysis': ServerMonitoringArtifactRequest & {
    kind: 'server-monitoring-analysis';
  };
};

export type ExecuteChatArtifactRequest<
  TKind extends ExecutableSurfaceArtifactKind = ExecutableSurfaceArtifactKind,
> = ExecuteChatArtifactRequestByKind[TKind];

export type SaveArtifactExecutionReplayPackResult =
  | {
      saved: true;
      replayPack: ReturnType<typeof createArtifactReplayPack>;
    }
  | {
      saved: false;
      reason: 'unsupported_artifact' | 'storage_unavailable';
    };

export function executeChatArtifact(
  request: ExecuteChatArtifactRequest<'incident-report'>
): Promise<IncidentReportArtifact>;
export function executeChatArtifact(
  request: ExecuteChatArtifactRequest<'monitoring-analysis'>
): Promise<MonitoringAnalysisArtifact>;
export function executeChatArtifact(
  request: ExecuteChatArtifactRequest<'server-monitoring-analysis'>
): Promise<ServerMonitoringAnalysisArtifact>;
export async function executeChatArtifact(
  request: ExecuteChatArtifactRequest
): Promise<ChatArtifact> {
  switch (request.kind) {
    case 'incident-report': {
      const { kind: _kind, ...artifactRequest } =
        request as ExecuteChatArtifactRequestByKind['incident-report'];
      void _kind;
      return generateIncidentReportArtifact(artifactRequest);
    }
    case 'monitoring-analysis': {
      const { kind: _kind, ...artifactRequest } =
        request as ExecuteChatArtifactRequestByKind['monitoring-analysis'];
      void _kind;
      return generateMonitoringAnalysisArtifact(artifactRequest);
    }
    case 'server-monitoring-analysis': {
      const { kind: _kind, ...serverRequest } =
        request as ExecuteChatArtifactRequestByKind['server-monitoring-analysis'];
      void _kind;
      return generateServerMonitoringArtifact(serverRequest);
    }
  }

  throw new Error(
    `Unsupported artifact kind: ${(request as { kind: string }).kind}`
  );
}

function safeWorkspaceSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'artifact'
  );
}

export function createArtifactExecutionWorkspaceId(
  artifact: ChatArtifact,
  prefix = 'surface'
): string {
  const dataSlot =
    artifact.dataSlot ?? artifact.queryAsOfDataSlot?.timeLabel ?? 'no-slot';

  return [
    safeWorkspaceSegment(prefix),
    safeWorkspaceSegment(artifact.kind),
    safeWorkspaceSegment(dataSlot),
    safeWorkspaceSegment(artifact.generatedAt),
  ].join(':');
}

export function saveArtifactExecutionReplayPack({
  artifact,
  workspaceId = createArtifactExecutionWorkspaceId(artifact),
  store = createArtifactWorkspaceStore(),
}: {
  artifact: ChatArtifact;
  workspaceId?: string;
  store?: ArtifactWorkspaceStore;
}): SaveArtifactExecutionReplayPackResult {
  const envelope = createArtifactEnvelope(artifact, {
    domainId: MONITORING_ARTIFACT_DOMAIN_ID,
    sourceMode:
      artifact.sourceMode ??
      (artifact.kind === 'server-snapshot' ? 'otel-static' : 'tool-result'),
  });
  const replayPack = createArtifactReplayPack({
    workspaceId,
    createdAt: artifact.generatedAt,
    envelopes: [envelope],
  });

  if (replayPack.entries.length === 0) {
    return { saved: false, reason: 'unsupported_artifact' };
  }

  try {
    store.saveReplayPack(replayPack);
    const restoredReplayPack = store.readReplayPack(workspaceId);
    if (!restoredReplayPack || restoredReplayPack.entries.length === 0) {
      return { saved: false, reason: 'storage_unavailable' };
    }

    return { saved: true, replayPack };
  } catch {
    return { saved: false, reason: 'storage_unavailable' };
  }
}
