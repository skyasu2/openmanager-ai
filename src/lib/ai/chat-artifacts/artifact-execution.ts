import type { MonitoringChatArtifact } from '@/lib/ai/domains/monitoring/artifact-registry';
import type {
  IncidentReportArtifact,
  MonitoringAnalysisArtifact,
  ServerMonitoringAnalysisArtifact,
  ServerMonitoringArtifactRequest,
} from '@/lib/ai/domains/monitoring/artifact-types';
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
} from './types';

/**
 * Artifact kinds generated through existing BFF/Cloud Run-backed APIs.
 * Locally generated artifacts such as ops-procedure are
 * registered through artifact-executors.ts instead of this wrapper.
 */
export type RemoteToolArtifactKind =
  | 'incident-report'
  | 'monitoring-analysis'
  | 'server-monitoring-analysis';

type ExecuteChatArtifactRequestByKind = {
  'incident-report': ChatArtifactRequest & { kind: 'incident-report' };
  'monitoring-analysis': ChatArtifactRequest & { kind: 'monitoring-analysis' };
  'server-monitoring-analysis': ServerMonitoringArtifactRequest & {
    kind: 'server-monitoring-analysis';
  };
};

export type ExecuteChatArtifactRequest<
  TKind extends RemoteToolArtifactKind = RemoteToolArtifactKind,
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
): Promise<MonitoringChatArtifact> {
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
    sourceMode: artifact.sourceMode ?? 'tool-result',
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
