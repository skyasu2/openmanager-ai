import type { ReactNode } from 'react';
import {
  listArtifactSchemaEntries,
  MONITORING_ARTIFACT_DOMAIN_ID,
  resolveArtifactSchemaEntry,
} from '@/lib/ai/chat-artifacts/artifact-workspace-registry';
import {
  ARTIFACT_CONTRACT_VERSION,
  type ArtifactEnvelope,
  type ArtifactSourceMode,
  type ChatArtifact,
  readArtifactEnvelope,
} from '@/lib/ai/chat-artifacts/types';

export const MONITORING_ARTIFACT_RENDERER_DOMAIN_ID =
  MONITORING_ARTIFACT_DOMAIN_ID;

export type ArtifactRendererKind = string;
export interface ArtifactRendererPayload {
  kind: string;
  generatedAt: string;
  artifactVersion?: string;
  sourceMode?: ArtifactSourceMode;
  dataSlot?: string;
  traceId?: string;
  evidence?: unknown;
  providerSummary?: unknown;
}

export interface ArtifactRendererEnvelope
  extends Omit<
    ArtifactEnvelope,
    'artifactVersion' | 'kind' | 'generatedAt' | 'payload'
  > {
  domainId?: string;
  artifactVersion: string;
  kind: string;
  generatedAt: string;
  payload: ArtifactRendererPayload;
}

export type ArtifactRendererFn = (
  artifact: ArtifactRendererPayload,
  entry: SupportedArtifactRendererEntry
) => ReactNode;

export interface ArtifactRendererKeyInput {
  domainId: string;
  artifactKind: string;
  artifactVersion: string;
}

export interface RegisterArtifactRendererOptions {
  isPayload?: (value: unknown) => boolean;
}

interface ArtifactRendererRegistration extends ArtifactRendererKeyInput {
  renderer: ArtifactRendererFn;
  isPayload?: (value: unknown) => boolean;
}

export interface SupportedArtifactRendererEntry {
  status: 'supported';
  key: string;
  domainId: string;
  artifactKind: ArtifactRendererKind;
  artifactVersion: string;
  artifact: ArtifactRendererPayload;
  envelope: ArtifactRendererEnvelope;
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

const artifactRendererMap = new Map<string, ArtifactRendererRegistration>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function isArtifactSourceMode(value: unknown): value is ArtifactSourceMode {
  return (
    value === 'otel-static' ||
    value === 'tool-result' ||
    value === 'restored-legacy'
  );
}

function isChatArtifact(value: unknown): value is ChatArtifact {
  return listArtifactSchemaEntries().some((entry) => entry.isPayload(value));
}

function isBaseChatArtifactPayload(
  value: unknown,
  expectedKind: string
): value is ArtifactRendererPayload {
  return (
    isRecord(value) &&
    value.kind === expectedKind &&
    !!readString(value.generatedAt)
  );
}

function readRendererArtifactEnvelope(
  artifact: ArtifactRendererPayload,
  domainId: string,
  sourceEnvelope?: RawArtifactEnvelope
): ArtifactRendererEnvelope {
  const artifactVersion =
    sourceEnvelope?.artifactVersion ??
    artifact.artifactVersion ??
    ARTIFACT_CONTRACT_VERSION;
  const sourceMode =
    sourceEnvelope?.sourceMode ?? artifact.sourceMode ?? 'restored-legacy';

  if (isChatArtifact(artifact)) {
    const envelope = readArtifactEnvelope(artifact);
    return {
      ...envelope,
      domainId,
      artifactVersion,
      sourceMode,
      payload: artifact,
    };
  }

  return {
    domainId,
    artifactVersion,
    kind: artifact.kind,
    generatedAt: artifact.generatedAt,
    sourceMode,
    ...(artifact.dataSlot && { dataSlot: artifact.dataSlot }),
    ...(artifact.traceId && { traceId: artifact.traceId }),
    payload: artifact,
  };
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
  artifact: ArtifactRendererPayload,
  domainId: string,
  sourceEnvelope?: RawArtifactEnvelope
): SupportedArtifactRendererEntry | UnsupportedArtifactRendererEntry {
  const envelope = readRendererArtifactEnvelope(
    artifact,
    domainId,
    sourceEnvelope
  );
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
    envelope,
  };
}

export function createArtifactRendererKey({
  domainId,
  artifactKind,
  artifactVersion,
}: ArtifactRendererKeyInput): string {
  return `${domainId}:${artifactKind}:${artifactVersion}`;
}

function resolveArtifactRendererRegistration(
  input: ArtifactRendererKeyInput | { key: string }
): ArtifactRendererRegistration | undefined {
  const key = 'key' in input ? input.key : createArtifactRendererKey(input);
  return artifactRendererMap.get(key);
}

export function registerArtifactRenderer(
  input: ArtifactRendererKeyInput,
  renderer: ArtifactRendererFn,
  options: RegisterArtifactRendererOptions = {}
): void {
  artifactRendererMap.set(createArtifactRendererKey(input), {
    ...input,
    renderer,
    ...(options.isPayload && { isPayload: options.isPayload }),
  });
}

export function unregisterArtifactRenderer(
  input: ArtifactRendererKeyInput
): void {
  artifactRendererMap.delete(createArtifactRendererKey(input));
}

export function resolveArtifactRenderer(
  entry: Pick<SupportedArtifactRendererEntry, 'key'>
): ArtifactRendererFn | undefined {
  return resolveArtifactRendererRegistration(entry)?.renderer;
}

export function isArtifactRendererKeyAllowed(key: string): boolean {
  return (
    MONITORING_ARTIFACT_RENDERER_KEYS.has(key) || artifactRendererMap.has(key)
  );
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

    const schema = resolveArtifactSchemaEntry({
      domainId: envelope.domainId,
      artifactKind: envelope.kind,
      artifactVersion: envelope.artifactVersion,
    });
    const rendererRegistration = resolveArtifactRendererRegistration({
      domainId: envelope.domainId,
      artifactKind: envelope.kind,
      artifactVersion: envelope.artifactVersion,
    });

    if (!schema && !rendererRegistration) {
      entries.push(toUnsupportedEntry(envelope, 'unknown_renderer'));
      continue;
    }

    const isPayload = schema?.isPayload ?? rendererRegistration?.isPayload;
    const isValidPayload = isPayload
      ? isPayload(envelope.payload)
      : isBaseChatArtifactPayload(envelope.payload, envelope.kind);

    if (!isValidPayload) {
      entries.push(toUnsupportedEntry(envelope, 'invalid_payload'));
      continue;
    }

    const entry = toSupportedEntry(
      envelope.payload as ArtifactRendererPayload,
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
    metadata.serverMonitoringAnalysisArtifact,
    metadata.opsProcedureArtifact,
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
