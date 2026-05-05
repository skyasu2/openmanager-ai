/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  ARTIFACT_REPLAY_PACK_VERSION,
  createArtifactReplayPack,
  MONITORING_ARTIFACT_DOMAIN_ID,
} from './artifact-workspace-registry';
import {
  ARTIFACT_WORKSPACE_STORAGE_KEY,
  createArtifactReplayPackComparisonSummary,
  createArtifactReplayPackExport,
  createArtifactWorkspaceStore,
  extractArtifactReplayPackFromChatHistory,
  readArtifactReplayPackExport,
} from './artifact-workspace-store';
import {
  ARTIFACT_CONTRACT_VERSION,
  createArtifactEnvelope,
  type IncidentReportArtifact,
  type ServerSnapshotArtifact,
} from './types';

const snapshotArtifact: ServerSnapshotArtifact = {
  kind: 'server-snapshot',
  generatedAt: '2026-05-06T01:00:00.000Z',
  title: '현재 서버 상태 스냅샷',
  summary: '4대 서버 중 위험 1대입니다.',
  source: 'otel-static',
  slot: {
    slotIndex: 42,
    minuteOfDay: 420,
    timeLabel: '07:00 KST',
  },
  totals: {
    total: 4,
    online: 2,
    warning: 1,
    critical: 1,
    offline: 0,
  },
  averages: {
    cpu: 60,
    memory: 67.8,
    disk: 56.8,
    network: 35,
  },
  topServers: [],
  alerts: [],
};

const incidentReportArtifact: IncidentReportArtifact = {
  kind: 'incident-report',
  generatedAt: '2026-05-06T01:05:00.000Z',
  report: {
    id: 'incident-workspace-1',
    title: 'DB 메모리 경고',
    severity: 'warning',
    timestamp: new Date('2026-05-06T01:05:00.000Z'),
    affectedServers: ['db-mysql-dc1-primary'],
    description: '메모리 사용률이 높습니다.',
    status: 'active',
  },
};

describe('artifact workspace store', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('persists replay packs in session storage by default and restores supported entries only', () => {
    const pack = createArtifactReplayPack({
      workspaceId: 'workspace-session-1',
      createdAt: '2026-05-06T01:10:00.000Z',
      envelopes: [
        createArtifactEnvelope(snapshotArtifact, {
          domainId: MONITORING_ARTIFACT_DOMAIN_ID,
          sourceMode: 'otel-static',
          dataSlot: '07:00 KST',
          traceId: 'trace-workspace-store-1',
        }),
      ],
    });

    const store = createArtifactWorkspaceStore();
    expect(store.policy).toEqual({
      persistence: 'local-session-first',
      allowsDatabaseWritesByDefault: false,
    });

    store.saveReplayPack(pack);

    expect(sessionStorage.getItem(ARTIFACT_WORKSPACE_STORAGE_KEY)).toContain(
      'workspace-session-1'
    );
    expect(localStorage.getItem(ARTIFACT_WORKSPACE_STORAGE_KEY)).toBeNull();

    const restored = createArtifactWorkspaceStore().listReplayPacks();
    expect(restored).toEqual([pack]);
  });

  it('exports replay packs as deterministic JSON download payloads', () => {
    const pack = createArtifactReplayPack({
      workspaceId: 'workspace/session 1',
      createdAt: '2026-05-06T01:10:00.000Z',
      envelopes: [
        createArtifactEnvelope(snapshotArtifact, {
          domainId: MONITORING_ARTIFACT_DOMAIN_ID,
          sourceMode: 'otel-static',
          dataSlot: '07:00 KST',
          traceId: 'trace-workspace-store-1',
        }),
      ],
    });

    const exported = createArtifactReplayPackExport(pack);

    expect(exported).toEqual({
      fileName:
        'artifact-replay-workspace-session-1-2026-05-06T01-10-00-000Z.json',
      mimeType: 'application/json',
      contents: expect.stringContaining('"workspaceId": "workspace/session 1"'),
    });
    expect(JSON.parse(exported!.contents)).toEqual(pack);
  });

  it('imports replay pack JSON into the session store without leaking unsupported raw payloads', () => {
    const importResult = createArtifactWorkspaceStore().importReplayPackExport(
      JSON.stringify({
        replayPackVersion: ARTIFACT_REPLAY_PACK_VERSION,
        workspaceId: 'workspace-import-1',
        createdAt: '2026-05-06T01:10:00.000Z',
        entries: [
          {
            id: 'unsafe-entry',
            schema: {
              domainId: 'sample-domain',
              familyId: 'unsafe-widget',
              artifactKind: 'unsafe-widget',
              artifactVersion: '2026-05-06-test',
            },
            generatedAt: '2026-05-06T01:00:00.000Z',
            sourceMode: 'tool-result',
            payload: {
              kind: 'unsafe-widget',
              html: '<script>alert(1)</script>',
              url: 'javascript:alert(1)',
            },
          },
        ],
      })
    );

    expect(importResult).toEqual({
      status: 'accepted',
      replayPack: expect.objectContaining({
        workspaceId: 'workspace-import-1',
        entries: [],
      }),
    });

    const restored =
      createArtifactWorkspaceStore().readReplayPack('workspace-import-1');
    expect(restored?.entries).toEqual([]);
    expect(JSON.stringify(restored)).not.toContain('<script>');
    expect(JSON.stringify(restored)).not.toContain('javascript:');
  });

  it('rejects invalid replay pack exports without mutating the store', () => {
    const store = createArtifactWorkspaceStore();

    expect(store.importReplayPackExport('{not-json')).toEqual({
      status: 'rejected',
      reason: 'invalid_json',
    });
    expect(
      store.importReplayPackExport(
        JSON.stringify({
          replayPackVersion: '2026-01-01-legacy',
          workspaceId: 'workspace-legacy',
          createdAt: '2026-05-06T01:10:00.000Z',
          entries: [],
        })
      )
    ).toEqual({
      status: 'rejected',
      reason: 'unsupported_replay_pack',
    });
    expect(readArtifactReplayPackExport('{not-json')).toEqual({
      status: 'rejected',
      reason: 'invalid_json',
    });
    expect(store.listReplayPacks()).toEqual([]);
  });

  it('summarizes replay pack comparisons for compare UX', () => {
    const expected = createArtifactReplayPack({
      workspaceId: 'workspace-compare',
      createdAt: '2026-05-06T01:10:00.000Z',
      envelopes: [
        createArtifactEnvelope(snapshotArtifact, {
          domainId: MONITORING_ARTIFACT_DOMAIN_ID,
          sourceMode: 'otel-static',
        }),
      ],
    });
    const actual = createArtifactReplayPack({
      workspaceId: 'workspace-compare',
      createdAt: '2026-05-06T01:11:00.000Z',
      envelopes: [
        createArtifactEnvelope(
          {
            ...snapshotArtifact,
            summary: '4대 서버 중 위험 2대입니다.',
          },
          {
            domainId: MONITORING_ARTIFACT_DOMAIN_ID,
            sourceMode: 'otel-static',
          }
        ),
      ],
    });

    expect(
      createArtifactReplayPackComparisonSummary(expected, expected)
    ).toEqual({
      status: 'identical',
      matchedCount: 1,
      missingCount: 0,
      addedCount: 0,
      changedCount: 0,
    });
    expect(createArtifactReplayPackComparisonSummary(expected, actual)).toEqual(
      {
        status: 'different',
        matchedCount: 0,
        missingCount: 0,
        addedCount: 0,
        changedCount: 1,
      }
    );
  });

  it('drops corrupt or unsupported replay packs without exposing unsafe raw payloads', () => {
    sessionStorage.setItem(
      ARTIFACT_WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        storeVersion: '2026-05-06-v1',
        updatedAt: '2026-05-06T01:11:00.000Z',
        replayPacks: [
          {
            replayPackVersion: ARTIFACT_REPLAY_PACK_VERSION,
            workspaceId: 'unsafe-workspace',
            createdAt: '2026-05-06T01:10:00.000Z',
            entries: [
              {
                id: 'unsafe-entry',
                schema: {
                  domainId: 'sample-domain',
                  familyId: 'unsafe-widget',
                  artifactKind: 'unsafe-widget',
                  artifactVersion: '2026-05-06-test',
                },
                generatedAt: '2026-05-06T01:00:00.000Z',
                sourceMode: 'tool-result',
                payload: {
                  kind: 'unsafe-widget',
                  html: '<script>alert(1)</script>',
                  url: 'javascript:alert(1)',
                },
              },
            ],
          },
          '{not-json',
        ],
      })
    );

    const restored = createArtifactWorkspaceStore().listReplayPacks();

    expect(restored).toEqual([
      expect.objectContaining({
        workspaceId: 'unsafe-workspace',
        entries: [],
      }),
    ]);
    expect(JSON.stringify(restored)).not.toContain('<script>');
    expect(JSON.stringify(restored)).not.toContain('javascript:');
  });

  it('degrades to an empty store when browser storage APIs throw', () => {
    const pack = createArtifactReplayPack({
      workspaceId: 'workspace-storage-failure',
      createdAt: '2026-05-06T01:12:00.000Z',
      envelopes: [
        createArtifactEnvelope(snapshotArtifact, {
          domainId: MONITORING_ARTIFACT_DOMAIN_ID,
          sourceMode: 'otel-static',
        }),
      ],
    });
    const store = createArtifactWorkspaceStore({
      storage: {
        getItem: () => {
          throw new Error('storage blocked');
        },
        setItem: () => {
          throw new Error('storage quota exceeded');
        },
        removeItem: () => {
          throw new Error('storage blocked');
        },
      },
    });

    expect(() => store.saveReplayPack(pack)).not.toThrow();
    expect(store.listReplayPacks()).toEqual([]);
    expect(store.readReplayPack('workspace-storage-failure')).toBeUndefined();
    expect(() => store.clear()).not.toThrow();
  });

  it('prefers supported artifact envelopes over duplicate legacy metadata', () => {
    const replayPack = extractArtifactReplayPackFromChatHistory({
      workspaceId: 'workspace-dedupe-1',
      createdAt: '2026-05-06T01:15:00.000Z',
      messages: [
        {
          metadata: {
            artifactEnvelopes: [
              createArtifactEnvelope(snapshotArtifact, {
                domainId: MONITORING_ARTIFACT_DOMAIN_ID,
                sourceMode: 'otel-static',
                dataSlot: '07:00 KST',
              }),
            ],
            serverSnapshotArtifact: snapshotArtifact,
          },
        },
      ],
    });

    expect(replayPack.entries).toHaveLength(1);
    expect(replayPack.entries[0]).toMatchObject({
      schema: {
        domainId: MONITORING_ARTIFACT_DOMAIN_ID,
        familyId: 'server-snapshot',
        artifactKind: 'server-snapshot',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
      },
      sourceMode: 'otel-static',
      payload: snapshotArtifact,
    });
  });

  it('extracts a deterministic replay pack from envelope and legacy chat history metadata', () => {
    const replayPack = extractArtifactReplayPackFromChatHistory({
      workspaceId: 'workspace-history-1',
      createdAt: '2026-05-06T01:20:00.000Z',
      messages: [
        {
          id: 'assistant-envelope',
          role: 'assistant',
          content: '스냅샷을 생성했습니다.',
          timestamp: '2026-05-06T01:01:00.000Z',
          metadata: {
            artifactEnvelopes: [
              createArtifactEnvelope(snapshotArtifact, {
                domainId: MONITORING_ARTIFACT_DOMAIN_ID,
                sourceMode: 'otel-static',
                dataSlot: '07:00 KST',
                traceId: 'trace-history-envelope',
              }),
            ],
          },
        },
        {
          id: 'assistant-legacy',
          role: 'assistant',
          content: '장애 보고서를 생성했습니다.',
          timestamp: '2026-05-06T01:06:00.000Z',
          metadata: {
            traceId: 'trace-history-legacy',
            incidentReportArtifact,
          },
        },
        {
          id: 'assistant-unsupported',
          role: 'assistant',
          content: '지원하지 않는 artifact입니다.',
          timestamp: '2026-05-06T01:07:00.000Z',
          metadata: {
            artifactEnvelopes: [
              {
                domainId: MONITORING_ARTIFACT_DOMAIN_ID,
                artifactVersion: '2026-01-01-legacy',
                kind: 'server-snapshot',
                generatedAt: snapshotArtifact.generatedAt,
                sourceMode: 'otel-static',
                payload: snapshotArtifact,
              },
            ],
          },
        },
      ],
    });

    expect(replayPack).toMatchObject({
      replayPackVersion: ARTIFACT_REPLAY_PACK_VERSION,
      workspaceId: 'workspace-history-1',
      createdAt: '2026-05-06T01:20:00.000Z',
    });
    expect(replayPack.entries).toHaveLength(2);
    expect(replayPack.entries.map((entry) => entry.schema)).toEqual([
      {
        domainId: MONITORING_ARTIFACT_DOMAIN_ID,
        familyId: 'server-snapshot',
        artifactKind: 'server-snapshot',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
      },
      {
        domainId: MONITORING_ARTIFACT_DOMAIN_ID,
        familyId: 'incident-report',
        artifactKind: 'incident-report',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
      },
    ]);
    expect(replayPack.entries[1]).toMatchObject({
      sourceMode: 'restored-legacy',
      traceId: 'trace-history-legacy',
      payload: incidentReportArtifact,
    });
  });
});
