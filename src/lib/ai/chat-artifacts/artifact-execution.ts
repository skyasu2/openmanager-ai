import {
  createArtifactReplayPack,
  MONITORING_ARTIFACT_DOMAIN_ID,
} from './artifact-workspace-registry';
import {
  type ArtifactWorkspaceStore,
  createArtifactWorkspaceStore,
} from './artifact-workspace-store';
import { generateIncidentReportArtifact } from './incident-report-artifact';
import { generateMonitoringAnalysisArtifact } from './monitoring-analysis-artifact';
import {
  type ChatArtifact,
  type ChatArtifactRequest,
  createArtifactEnvelope,
} from './types';

export type ExecutableSurfaceArtifactKind =
  | 'incident-report'
  | 'monitoring-analysis';

export type ExecutableSurfaceArtifact<
  TKind extends ExecutableSurfaceArtifactKind = ExecutableSurfaceArtifactKind,
> = Extract<ChatArtifact, { kind: TKind }>;

export type ExecuteChatArtifactRequest<
  TKind extends ExecutableSurfaceArtifactKind = ExecutableSurfaceArtifactKind,
> = ChatArtifactRequest & {
  kind: TKind;
};

export type SaveArtifactExecutionReplayPackResult =
  | {
      saved: true;
      replayPack: ReturnType<typeof createArtifactReplayPack>;
    }
  | {
      saved: false;
      reason: 'unsupported_artifact' | 'storage_unavailable';
    };

export async function executeChatArtifact<
  TKind extends ExecutableSurfaceArtifactKind,
>({
  kind,
  ...request
}: ExecuteChatArtifactRequest<TKind>): Promise<
  ExecutableSurfaceArtifact<TKind>
> {
  switch (kind) {
    case 'incident-report':
      return generateIncidentReportArtifact(request) as Promise<
        ExecutableSurfaceArtifact<TKind>
      >;
    case 'monitoring-analysis':
      return generateMonitoringAnalysisArtifact(request) as Promise<
        ExecutableSurfaceArtifact<TKind>
      >;
  }

  throw new Error(`Unsupported artifact kind: ${kind satisfies never}`);
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
