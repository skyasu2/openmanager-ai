import {
  ARTIFACT_CONTRACT_VERSION,
  type ArtifactEnvelope,
  type ArtifactSourceMode,
  type ChatArtifact,
} from './types';

export const MONITORING_ARTIFACT_DOMAIN_ID = 'openmanager-monitoring';
export const ARTIFACT_REPLAY_PACK_VERSION = '2026-05-06-v1';

export type ArtifactFamilyId = ChatArtifact['kind'];

export interface ArtifactReplayPolicy {
  persistence: 'local-session-first';
  allowsDatabaseWritesByDefault: false;
  compareStrategy: 'stable-json';
}

export interface ArtifactSchemaKeyInput {
  domainId: string;
  artifactKind: string;
  artifactVersion: string;
}

export interface ArtifactSchemaEntry<
  TArtifact extends ChatArtifact = ChatArtifact,
> {
  domainId: string;
  familyId: ArtifactFamilyId;
  artifactKind: TArtifact['kind'];
  artifactVersion: string;
  legacyMetadataKey:
    | 'incidentReportArtifact'
    | 'monitoringAnalysisArtifact'
    | 'serverSnapshotArtifact';
  replayPolicy: ArtifactReplayPolicy;
  isPayload: (value: unknown) => value is TArtifact;
}

export interface ArtifactReplayPackEntry {
  id: string;
  schema: {
    domainId: string;
    familyId: ArtifactFamilyId;
    artifactKind: ChatArtifact['kind'];
    artifactVersion: string;
  };
  generatedAt: string;
  sourceMode: ArtifactSourceMode;
  dataSlot?: string;
  traceId?: string;
  payload: ChatArtifact;
}

export interface ArtifactReplayPack {
  replayPackVersion: typeof ARTIFACT_REPLAY_PACK_VERSION;
  workspaceId: string;
  createdAt: string;
  entries: ArtifactReplayPackEntry[];
}

export interface CreateArtifactReplayPackOptions {
  workspaceId: string;
  createdAt?: string;
  envelopes: ArtifactEnvelope[];
}

export interface ArtifactReplayPackComparison {
  matched: string[];
  missing: string[];
  added: string[];
  changed: string[];
}

const REPLAY_POLICY: ArtifactReplayPolicy = {
  persistence: 'local-session-first',
  allowsDatabaseWritesByDefault: false,
  compareStrategy: 'stable-json',
};

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

function isIncidentReportArtifact(
  value: unknown
): value is Extract<ChatArtifact, { kind: 'incident-report' }> {
  return (
    isRecord(value) &&
    value.kind === 'incident-report' &&
    !!readString(value.generatedAt) &&
    isRecord(value.report)
  );
}

function isMonitoringAnalysisArtifact(
  value: unknown
): value is Extract<ChatArtifact, { kind: 'monitoring-analysis' }> {
  return (
    isRecord(value) &&
    value.kind === 'monitoring-analysis' &&
    !!readString(value.generatedAt) &&
    !!readString(value.title) &&
    !!readString(value.summary) &&
    Number.isFinite(Number(value.serverCount)) &&
    isRecord(value.analysis)
  );
}

function isServerSnapshotArtifact(
  value: unknown
): value is Extract<ChatArtifact, { kind: 'server-snapshot' }> {
  return (
    isRecord(value) &&
    value.kind === 'server-snapshot' &&
    !!readString(value.generatedAt) &&
    !!readString(value.title) &&
    !!readString(value.summary) &&
    value.source === 'otel-static' &&
    isRecord(value.slot) &&
    isRecord(value.totals) &&
    isRecord(value.averages) &&
    Array.isArray(value.topServers) &&
    Array.isArray(value.alerts)
  );
}

const ARTIFACT_SCHEMA_ENTRIES: ArtifactSchemaEntry[] = [
  {
    domainId: MONITORING_ARTIFACT_DOMAIN_ID,
    familyId: 'incident-report',
    artifactKind: 'incident-report',
    artifactVersion: ARTIFACT_CONTRACT_VERSION,
    legacyMetadataKey: 'incidentReportArtifact',
    replayPolicy: REPLAY_POLICY,
    isPayload: isIncidentReportArtifact,
  },
  {
    domainId: MONITORING_ARTIFACT_DOMAIN_ID,
    familyId: 'monitoring-analysis',
    artifactKind: 'monitoring-analysis',
    artifactVersion: ARTIFACT_CONTRACT_VERSION,
    legacyMetadataKey: 'monitoringAnalysisArtifact',
    replayPolicy: REPLAY_POLICY,
    isPayload: isMonitoringAnalysisArtifact,
  },
  {
    domainId: MONITORING_ARTIFACT_DOMAIN_ID,
    familyId: 'server-snapshot',
    artifactKind: 'server-snapshot',
    artifactVersion: ARTIFACT_CONTRACT_VERSION,
    legacyMetadataKey: 'serverSnapshotArtifact',
    replayPolicy: REPLAY_POLICY,
    isPayload: isServerSnapshotArtifact,
  },
];

export function listArtifactSchemaEntries(): ArtifactSchemaEntry[] {
  return ARTIFACT_SCHEMA_ENTRIES.map((entry) => ({ ...entry }));
}

export function resolveArtifactSchemaEntry({
  domainId,
  artifactKind,
  artifactVersion,
}: ArtifactSchemaKeyInput): ArtifactSchemaEntry | undefined {
  return ARTIFACT_SCHEMA_ENTRIES.find(
    (entry) =>
      entry.domainId === domainId &&
      entry.artifactKind === artifactKind &&
      entry.artifactVersion === artifactVersion
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (!isRecord(value)) {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function createReplayEntryId({
  schema,
  generatedAt,
  dataSlot,
  traceId,
}: Pick<
  ArtifactReplayPackEntry,
  'schema' | 'generatedAt' | 'dataSlot' | 'traceId'
>): string {
  return [
    schema.domainId,
    schema.familyId,
    schema.artifactKind,
    schema.artifactVersion,
    dataSlot || 'no-slot',
    generatedAt,
    traceId || 'no-trace',
  ].join(':');
}

function normalizeEnvelope(
  envelope: unknown
): ArtifactReplayPackEntry | undefined {
  if (!isRecord(envelope)) return undefined;

  const domainId =
    readString(envelope.domainId) ?? MONITORING_ARTIFACT_DOMAIN_ID;
  const artifactKind = readString(envelope.kind);
  const artifactVersion = readString(envelope.artifactVersion);
  const generatedAt = readString(envelope.generatedAt);
  const sourceMode = isArtifactSourceMode(envelope.sourceMode)
    ? envelope.sourceMode
    : undefined;
  if (!artifactKind || !artifactVersion || !generatedAt || !sourceMode) {
    return undefined;
  }

  const schema = resolveArtifactSchemaEntry({
    domainId,
    artifactKind,
    artifactVersion,
  });
  if (!schema?.isPayload(envelope.payload)) {
    return undefined;
  }

  const entry = {
    id: '',
    schema: {
      domainId: schema.domainId,
      familyId: schema.familyId,
      artifactKind: schema.artifactKind,
      artifactVersion: schema.artifactVersion,
    },
    generatedAt,
    sourceMode,
    ...(readString(envelope.dataSlot) && {
      dataSlot: readString(envelope.dataSlot),
    }),
    ...(readString(envelope.traceId) && {
      traceId: readString(envelope.traceId),
    }),
    payload: envelope.payload,
  } satisfies ArtifactReplayPackEntry;

  return {
    ...entry,
    id: createReplayEntryId(entry),
  };
}

export function createArtifactReplayPack({
  workspaceId,
  createdAt = new Date().toISOString(),
  envelopes,
}: CreateArtifactReplayPackOptions): ArtifactReplayPack {
  const entries = envelopes
    .map(normalizeEnvelope)
    .filter((entry): entry is ArtifactReplayPackEntry => entry !== undefined);

  return {
    replayPackVersion: ARTIFACT_REPLAY_PACK_VERSION,
    workspaceId,
    createdAt,
    entries,
  };
}

function normalizeReplayEntry(
  value: unknown
): ArtifactReplayPackEntry | undefined {
  if (!isRecord(value) || !isRecord(value.schema)) {
    return undefined;
  }

  return normalizeEnvelope({
    domainId: value.schema.domainId,
    kind: value.schema.artifactKind,
    artifactVersion: value.schema.artifactVersion,
    generatedAt: value.generatedAt,
    sourceMode: value.sourceMode,
    dataSlot: value.dataSlot,
    traceId: value.traceId,
    payload: value.payload,
  });
}

export function readArtifactReplayPack(
  value: unknown
): ArtifactReplayPack | undefined {
  if (!isRecord(value)) return undefined;
  if (value.replayPackVersion !== ARTIFACT_REPLAY_PACK_VERSION) {
    return undefined;
  }

  const workspaceId = readString(value.workspaceId);
  const createdAt = readString(value.createdAt);
  if (!workspaceId || !createdAt) return undefined;

  const entries = Array.isArray(value.entries)
    ? value.entries
        .map(normalizeReplayEntry)
        .filter(
          (entry): entry is ArtifactReplayPackEntry => entry !== undefined
        )
    : [];

  return {
    replayPackVersion: ARTIFACT_REPLAY_PACK_VERSION,
    workspaceId,
    createdAt,
    entries,
  };
}

function mapReplayEntries(
  pack: ArtifactReplayPack
): Map<string, ArtifactReplayPackEntry> {
  return new Map(pack.entries.map((entry) => [entry.id, entry]));
}

export function compareArtifactReplayPacks(
  expectedValue: unknown,
  actualValue: unknown
): ArtifactReplayPackComparison {
  const expected = readArtifactReplayPack(expectedValue);
  const actual = readArtifactReplayPack(actualValue);
  const expectedEntries = expected ? mapReplayEntries(expected) : new Map();
  const actualEntries = actual ? mapReplayEntries(actual) : new Map();
  const matched: string[] = [];
  const missing: string[] = [];
  const added: string[] = [];
  const changed: string[] = [];

  for (const [id, expectedEntry] of expectedEntries) {
    const actualEntry = actualEntries.get(id);
    if (!actualEntry) {
      missing.push(id);
      continue;
    }
    if (stableStringify(expectedEntry) === stableStringify(actualEntry)) {
      matched.push(id);
    } else {
      changed.push(id);
    }
  }

  for (const id of actualEntries.keys()) {
    if (!expectedEntries.has(id)) {
      added.push(id);
    }
  }

  return {
    matched,
    missing,
    added,
    changed,
  };
}
