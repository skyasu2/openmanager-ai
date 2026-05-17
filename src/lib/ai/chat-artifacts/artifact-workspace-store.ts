import type { MonitoringChatArtifact } from '@/lib/ai/domains/monitoring/artifact-registry';
import {
  type ArtifactReplayPack,
  compareArtifactReplayPacks,
  createArtifactReplayPack,
  listArtifactSchemaEntries,
  MONITORING_ARTIFACT_DOMAIN_ID,
  readArtifactReplayPack,
  resolveArtifactSchemaEntry,
} from './artifact-workspace-registry';
import { type ArtifactEnvelope, createArtifactEnvelope } from './types';

export const ARTIFACT_WORKSPACE_STORAGE_KEY = 'openmanager-artifact-workspace';
export const ARTIFACT_WORKSPACE_STORE_VERSION = '2026-05-06-v1';

export interface ArtifactWorkspaceStorePolicy {
  persistence: 'local-session-first';
  allowsDatabaseWritesByDefault: false;
}

export interface ArtifactWorkspaceSnapshot {
  storeVersion: typeof ARTIFACT_WORKSPACE_STORE_VERSION;
  updatedAt: string;
  replayPacks: ArtifactReplayPack[];
}

export interface ArtifactWorkspaceStore {
  policy: ArtifactWorkspaceStorePolicy;
  saveReplayPack: (pack: ArtifactReplayPack) => void;
  importReplayPackExport: (contents: string) => ArtifactReplayPackImportResult;
  readReplayPack: (workspaceId: string) => ArtifactReplayPack | undefined;
  listReplayPacks: () => ArtifactReplayPack[];
  clear: () => void;
}

export interface ArtifactReplayPackExport {
  fileName: string;
  mimeType: 'application/json';
  contents: string;
}

export type ArtifactReplayPackImportResult =
  | {
      status: 'accepted';
      replayPack: ArtifactReplayPack;
    }
  | {
      status: 'rejected';
      reason: 'invalid_json' | 'unsupported_replay_pack';
    };

export interface ArtifactReplayPackComparisonSummary {
  status: 'identical' | 'different';
  matchedCount: number;
  missingCount: number;
  addedCount: number;
  changedCount: number;
  items: ArtifactReplayPackComparisonItem[];
}

export interface ArtifactReplayPackComparisonItem {
  id: string;
  label: string;
  status: 'matched' | 'missing' | 'added' | 'changed';
}

export interface CreateArtifactWorkspaceStoreOptions {
  storage?: ArtifactWorkspaceStorage;
  now?: () => string;
}

export interface ExtractArtifactReplayPackFromChatHistoryOptions {
  workspaceId: string;
  createdAt?: string;
  messages: ArtifactWorkspaceHistoryMessage[];
}

export interface ArtifactWorkspaceHistoryMessage {
  metadata?: ArtifactWorkspaceHistoryMetadata;
}

export interface ArtifactWorkspaceHistoryMetadata {
  traceId?: string;
  artifactEnvelopes?: ArtifactEnvelope[];
  incidentReportArtifact?: unknown;
  monitoringAnalysisArtifact?: unknown;
  serverMonitoringAnalysisArtifact?: unknown;
  serverSnapshotArtifact?: unknown;
  opsProcedureArtifact?: unknown;
}

export interface ArtifactWorkspaceStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const STORE_POLICY: ArtifactWorkspaceStorePolicy = {
  persistence: 'local-session-first',
  allowsDatabaseWritesByDefault: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function createMemoryStorage(): ArtifactWorkspaceStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function getDefaultStorage(): ArtifactWorkspaceStorage {
  if (typeof window === 'undefined') {
    return createMemoryStorage();
  }

  try {
    return window.sessionStorage;
  } catch {
    return createMemoryStorage();
  }
}

function createEmptySnapshot(updatedAt: string): ArtifactWorkspaceSnapshot {
  return {
    storeVersion: ARTIFACT_WORKSPACE_STORE_VERSION,
    updatedAt,
    replayPacks: [],
  };
}

function readSnapshot(
  storage: ArtifactWorkspaceStorage,
  updatedAt: string
): ArtifactWorkspaceSnapshot {
  try {
    const raw = storage.getItem(ARTIFACT_WORKSPACE_STORAGE_KEY);
    if (!raw) return createEmptySnapshot(updatedAt);

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return createEmptySnapshot(updatedAt);

    const snapshotUpdatedAt = readString(parsed.updatedAt) ?? updatedAt;
    const replayPacks = Array.isArray(parsed.replayPacks)
      ? parsed.replayPacks
          .map(readArtifactReplayPack)
          .filter((pack): pack is ArtifactReplayPack => pack !== undefined)
      : [];

    return {
      storeVersion: ARTIFACT_WORKSPACE_STORE_VERSION,
      updatedAt: snapshotUpdatedAt,
      replayPacks,
    };
  } catch {
    return createEmptySnapshot(updatedAt);
  }
}

function writeSnapshot(
  storage: ArtifactWorkspaceStorage,
  snapshot: ArtifactWorkspaceSnapshot
): void {
  try {
    storage.setItem(ARTIFACT_WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Browser storage can be blocked or quota-limited; artifact workspace
    // persistence must degrade without breaking the chat surface.
  }
}

function toSafeFileSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 96) || 'workspace'
  );
}

function isSupportedChatArtifact(
  value: unknown
): value is MonitoringChatArtifact {
  return listArtifactSchemaEntries().some((entry) => entry.isPayload(value));
}

function isSupportedArtifactEnvelope(
  value: unknown
): value is ArtifactEnvelope<MonitoringChatArtifact> {
  if (!isRecord(value)) return false;

  const domainId = readString(value.domainId) ?? MONITORING_ARTIFACT_DOMAIN_ID;
  const artifactKind = readString(value.kind);
  const artifactVersion = readString(value.artifactVersion);
  if (!artifactKind || !artifactVersion) return false;

  const schema = resolveArtifactSchemaEntry({
    domainId,
    artifactKind,
    artifactVersion,
  });

  return schema?.isPayload(value.payload) ?? false;
}

function readLegacyArtifacts(
  metadata: ArtifactWorkspaceHistoryMetadata,
  ignoredKinds: ReadonlySet<MonitoringChatArtifact['kind']>
): ArtifactEnvelope<MonitoringChatArtifact>[] {
  return [
    metadata.incidentReportArtifact,
    metadata.monitoringAnalysisArtifact,
    metadata.serverMonitoringAnalysisArtifact,
    metadata.serverSnapshotArtifact,
    metadata.opsProcedureArtifact,
  ]
    .filter(isSupportedChatArtifact)
    .filter((artifact) => !ignoredKinds.has(artifact.kind))
    .map((artifact) =>
      createArtifactEnvelope(artifact, {
        domainId: MONITORING_ARTIFACT_DOMAIN_ID,
        sourceMode: 'restored-legacy',
        traceId: readString(metadata.traceId),
      })
    );
}

function mapReplayPackEntries(
  pack: ArtifactReplayPack | undefined
): Map<string, ArtifactReplayPack['entries'][number]> {
  return new Map(pack?.entries.map((entry) => [entry.id, entry]) ?? []);
}

function formatReplayGeneratedAt(generatedAt: string): string {
  const date = new Date(generatedAt);
  if (!Number.isFinite(date.getTime())) return generatedAt;

  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} KST`;
}

function createComparisonItem(
  id: string,
  status: ArtifactReplayPackComparisonItem['status'],
  entries: Map<string, ArtifactReplayPack['entries'][number]>
): ArtifactReplayPackComparisonItem {
  const entry = entries.get(id);
  const label = entry
    ? `${entry.schema.artifactKind} (${formatReplayGeneratedAt(
        entry.generatedAt
      )})`
    : id;

  return {
    id,
    label,
    status,
  };
}

export function createArtifactWorkspaceStore(
  options: CreateArtifactWorkspaceStoreOptions = {}
): ArtifactWorkspaceStore {
  const storage = options.storage ?? getDefaultStorage();
  const now = options.now ?? (() => new Date().toISOString());

  return {
    policy: STORE_POLICY,
    saveReplayPack: (pack) => {
      const restoredPack = readArtifactReplayPack(pack);
      if (!restoredPack) return;

      const updatedAt = now();
      const snapshot = readSnapshot(storage, updatedAt);
      const replayPacks = snapshot.replayPacks.filter(
        (entry) => entry.workspaceId !== restoredPack.workspaceId
      );

      writeSnapshot(storage, {
        storeVersion: ARTIFACT_WORKSPACE_STORE_VERSION,
        updatedAt,
        replayPacks: [...replayPacks, restoredPack],
      });
    },
    importReplayPackExport: (contents) => {
      const result = readArtifactReplayPackExport(contents);
      if (result.status === 'accepted') {
        const updatedAt = now();
        const snapshot = readSnapshot(storage, updatedAt);
        const replayPacks = snapshot.replayPacks.filter(
          (entry) => entry.workspaceId !== result.replayPack.workspaceId
        );
        writeSnapshot(storage, {
          storeVersion: ARTIFACT_WORKSPACE_STORE_VERSION,
          updatedAt,
          replayPacks: [...replayPacks, result.replayPack],
        });
      }
      return result;
    },
    readReplayPack: (workspaceId) =>
      readSnapshot(storage, now()).replayPacks.find(
        (pack) => pack.workspaceId === workspaceId
      ),
    listReplayPacks: () => readSnapshot(storage, now()).replayPacks,
    clear: () => {
      try {
        storage.removeItem(ARTIFACT_WORKSPACE_STORAGE_KEY);
      } catch {
        // See writeSnapshot: blocked storage should not surface as UI failure.
      }
    },
  };
}

export function extractArtifactReplayPackFromChatHistory({
  workspaceId,
  createdAt = new Date().toISOString(),
  messages,
}: ExtractArtifactReplayPackFromChatHistoryOptions): ArtifactReplayPack {
  const envelopes = messages.flatMap((message) => {
    const metadata = message.metadata;
    if (!metadata) return [];

    const currentEnvelopes = Array.isArray(metadata.artifactEnvelopes)
      ? metadata.artifactEnvelopes.filter(isSupportedArtifactEnvelope)
      : [];
    const currentKinds = new Set(
      currentEnvelopes.map((envelope) => envelope.kind)
    );

    return [
      ...currentEnvelopes,
      ...readLegacyArtifacts(metadata, currentKinds),
    ];
  });

  return createArtifactReplayPack({
    workspaceId,
    createdAt,
    envelopes,
  });
}

export function createArtifactReplayPackExport(
  value: unknown
): ArtifactReplayPackExport | undefined {
  const replayPack = readArtifactReplayPack(value);
  if (!replayPack) return undefined;

  return {
    fileName: `artifact-replay-${toSafeFileSegment(
      replayPack.workspaceId
    )}-${toSafeFileSegment(replayPack.createdAt)}.json`,
    mimeType: 'application/json',
    contents: JSON.stringify(replayPack, null, 2),
  };
}

export function readArtifactReplayPackExport(
  contents: string
): ArtifactReplayPackImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents) as unknown;
  } catch {
    return {
      status: 'rejected',
      reason: 'invalid_json',
    };
  }

  const replayPack = readArtifactReplayPack(parsed);
  if (!replayPack) {
    return {
      status: 'rejected',
      reason: 'unsupported_replay_pack',
    };
  }

  return {
    status: 'accepted',
    replayPack,
  };
}

export function createArtifactReplayPackComparisonSummary(
  expected: unknown,
  actual: unknown
): ArtifactReplayPackComparisonSummary {
  const expectedPack = readArtifactReplayPack(expected);
  const actualPack = readArtifactReplayPack(actual);
  const comparison = compareArtifactReplayPacks(expected, actual);
  const missingCount = comparison.missing.length;
  const addedCount = comparison.added.length;
  const changedCount = comparison.changed.length;
  const expectedEntries = mapReplayPackEntries(expectedPack);
  const actualEntries = mapReplayPackEntries(actualPack);
  const baseEntries = new Map([...actualEntries, ...expectedEntries]);

  return {
    status:
      missingCount === 0 && addedCount === 0 && changedCount === 0
        ? 'identical'
        : 'different',
    matchedCount: comparison.matched.length,
    missingCount,
    addedCount,
    changedCount,
    items: [
      ...comparison.matched.map((id) =>
        createComparisonItem(id, 'matched', baseEntries)
      ),
      ...comparison.missing.map((id) =>
        createComparisonItem(id, 'missing', expectedEntries)
      ),
      ...comparison.added.map((id) =>
        createComparisonItem(id, 'added', actualEntries)
      ),
      ...comparison.changed.map((id) =>
        createComparisonItem(id, 'changed', baseEntries)
      ),
    ],
  };
}
