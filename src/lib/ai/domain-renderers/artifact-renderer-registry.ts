import {
  listArtifactSchemaEntries,
  MONITORING_ARTIFACT_DOMAIN_ID,
} from '@/lib/ai/chat-artifacts/artifact-workspace-registry';
import {
  type ArtifactEnvelope,
  type ArtifactSourceMode,
  type ChatArtifact,
  readArtifactEnvelope,
} from '@/lib/ai/chat-artifacts/types';

export const MONITORING_ARTIFACT_RENDERER_DOMAIN_ID =
  MONITORING_ARTIFACT_DOMAIN_ID;

export type ArtifactRendererKind = ChatArtifact['kind'];

export interface ArtifactRendererKeyInput {
  domainId: string;
  artifactKind: string;
  artifactVersion: string;
}

export interface SupportedArtifactRendererEntry {
  status: 'supported';
  key: string;
  domainId: string;
  artifactKind: ArtifactRendererKind;
  artifactVersion: string;
  artifact: ChatArtifact;
  envelope: ArtifactEnvelope;
}

export interface UnsupportedArtifactRendererEntry {
  status: 'unsupported';
  key: string;
  domainId: string;
  artifactKind: string;
  artifactVersion: string;
  reason: 'invalid_payload' | 'unknown_renderer';
}

export type ArtifactRendererEntry =
  | SupportedArtifactRendererEntry
  | UnsupportedArtifactRendererEntry;

type RawArtifactEnvelope = {
  domainId: string;
  kind: string;
  artifactVersion: string;
  generatedAt?: string;
  sourceMode?: ArtifactSourceMode;
  payload?: unknown;
};

const MONITORING_ARTIFACT_RENDERER_KEYS = new Set(
  listArtifactSchemaEntries().map((entry) =>
    createArtifactRendererKey({
      domainId: entry.domainId,
      artifactKind: entry.artifactKind,
      artifactVersion: entry.artifactVersion,
    })
  )
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isArtifactKind(value: unknown): value is ArtifactRendererKind {
  return (
    value === 'incident-report' ||
    value === 'monitoring-analysis' ||
    value === 'server-snapshot'
  );
}

function isArtifactSourceMode(value: unknown): value is ArtifactSourceMode {
  return (
    value === 'otel-static' ||
    value === 'tool-result' ||
    value === 'restored-legacy'
  );
}

function isChatArtifact(value: unknown): value is ChatArtifact {
  if (!isRecord(value) || !isArtifactKind(value.kind)) return false;
  return true;
}

function normalizeRawEnvelope(value: unknown): RawArtifactEnvelope | undefined {
  if (!isRecord(value)) return undefined;

  const kind = readString(value.kind);
  const artifactVersion = readString(value.artifactVersion);
  if (!kind || !artifactVersion) return undefined;

  return {
    domainId:
      readString(value.domainId) ?? MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
    kind,
    artifactVersion,
    ...(readString(value.generatedAt) && {
      generatedAt: readString(value.generatedAt),
    }),
    ...(isArtifactSourceMode(value.sourceMode) && {
      sourceMode: value.sourceMode,
    }),
    ...('payload' in value && { payload: value.payload }),
  };
}

function toUnsupportedEntry(
  envelope: Pick<RawArtifactEnvelope, 'domainId' | 'kind' | 'artifactVersion'>,
  reason: UnsupportedArtifactRendererEntry['reason']
): UnsupportedArtifactRendererEntry {
  return {
    status: 'unsupported',
    key: createArtifactRendererKey({
      domainId: envelope.domainId,
      artifactKind: envelope.kind,
      artifactVersion: envelope.artifactVersion,
    }),
    domainId: envelope.domainId,
    artifactKind: envelope.kind,
    artifactVersion: envelope.artifactVersion,
    reason,
  };
}

function toSupportedEntry(
  artifact: ChatArtifact,
  domainId: string,
  sourceEnvelope?: RawArtifactEnvelope
): SupportedArtifactRendererEntry | UnsupportedArtifactRendererEntry {
  const envelope = readArtifactEnvelope(artifact);
  const artifactVersion =
    sourceEnvelope?.artifactVersion ?? envelope.artifactVersion;
  const key = createArtifactRendererKey({
    domainId,
    artifactKind: artifact.kind,
    artifactVersion,
  });

  if (!isArtifactRendererKeyAllowed(key)) {
    return toUnsupportedEntry(
      {
        domainId,
        kind: artifact.kind,
        artifactVersion,
      },
      'unknown_renderer'
    );
  }

  return {
    status: 'supported',
    key,
    domainId,
    artifactKind: artifact.kind,
    artifactVersion,
    artifact,
    envelope: {
      ...envelope,
      artifactVersion,
      ...(sourceEnvelope?.sourceMode && {
        sourceMode: sourceEnvelope.sourceMode,
      }),
    },
  };
}

export function createArtifactRendererKey({
  domainId,
  artifactKind,
  artifactVersion,
}: ArtifactRendererKeyInput): string {
  return `${domainId}:${artifactKind}:${artifactVersion}`;
}

export function isArtifactRendererKeyAllowed(key: string): boolean {
  return MONITORING_ARTIFACT_RENDERER_KEYS.has(key);
}

export function resolveArtifactRendererEntries(
  metadata: unknown
): ArtifactRendererEntry[] {
  if (!isRecord(metadata)) return [];

  const entries: ArtifactRendererEntry[] = [];
  const renderedKinds = new Set<string>();
  const rawEnvelopes = Array.isArray(metadata.artifactEnvelopes)
    ? metadata.artifactEnvelopes
    : [];

  for (const rawEnvelope of rawEnvelopes) {
    const envelope = normalizeRawEnvelope(rawEnvelope);
    if (!envelope) continue;

    if (!isArtifactKind(envelope.kind) || !isChatArtifact(envelope.payload)) {
      entries.push(toUnsupportedEntry(envelope, 'invalid_payload'));
      continue;
    }

    const entry = toSupportedEntry(
      envelope.payload,
      envelope.domainId,
      envelope
    );
    entries.push(entry);
    if (entry.status === 'supported') {
      renderedKinds.add(entry.artifactKind);
    }
  }

  const legacyArtifacts = [
    metadata.incidentReportArtifact,
    metadata.monitoringAnalysisArtifact,
    metadata.serverSnapshotArtifact,
  ];

  for (const artifact of legacyArtifacts) {
    if (!isChatArtifact(artifact) || renderedKinds.has(artifact.kind)) {
      continue;
    }
    const entry = toSupportedEntry(
      artifact,
      MONITORING_ARTIFACT_RENDERER_DOMAIN_ID
    );
    entries.push(entry);
    if (entry.status === 'supported') {
      renderedKinds.add(entry.artifactKind);
    }
  }

  return entries;
}
