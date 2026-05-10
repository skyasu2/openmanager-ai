import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_REPLAY_PACK_VERSION,
  compareArtifactReplayPacks,
  createArtifactReplayPack,
  listArtifactSchemaEntries,
  MONITORING_ARTIFACT_DOMAIN_ID,
  readArtifactReplayPack,
  resolveArtifactSchemaEntry,
} from './artifact-workspace-registry';
import {
  ARTIFACT_CONTRACT_VERSION,
  createArtifactEnvelope,
  type ServerSnapshotArtifact,
} from './types';

const snapshotArtifact: ServerSnapshotArtifact = {
  kind: 'server-snapshot',
  generatedAt: '2026-05-06T00:00:00.000Z',
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

const opsProcedureArtifact = {
  kind: 'ops-procedure',
  generatedAt: '2026-05-11T00:00:00.000Z',
  title: 'CPU 80% Slack 알림 운영 절차',
  summary: 'CPU 80% 이상 서버를 확인하고 Slack 알림 템플릿을 제공합니다.',
  procedureType: 'script',
  source: 'otel-static',
  inputs: {
    metric: 'cpu',
    threshold: 80,
    serverScope: 'all',
    timeWindowMinutes: 10,
    notificationTarget: 'slack-webhook',
  },
  evidence: [
    {
      id: 'metric-cpu-threshold',
      kind: 'metric',
      summary: '현재 OTel snapshot 기준 CPU 상위 서버를 확인했습니다.',
      metric: 'cpu',
      severity: 'warning',
    },
  ],
  runbook: {
    symptoms: ['CPU 80% 이상 서버가 Slack 알림 대상입니다.'],
    likelyCauses: ['트래픽 증가 또는 프로세스 과점유'],
    responseSteps: ['CPU 상위 프로세스를 확인합니다.'],
    validationSteps: ['알림 발송 후 CPU 사용률을 재확인합니다.'],
    rollbackOrStopConditions: [
      '잘못된 webhook 또는 과도한 알림이면 중단합니다.',
    ],
    limitations: ['자동 실행되지 않는 템플릿입니다.'],
  },
  codeBlocks: [
    {
      id: 'slack-cpu-alert-bash',
      title: 'Slack CPU threshold alert script',
      language: 'bash',
      content: 'SLACK_WEBHOOK_URL="$SLACK_WEBHOOK_URL"\nTHRESHOLD=80',
      executable: false,
      requiredEnv: ['SLACK_WEBHOOK_URL'],
      safetyLevel: 'notification-only',
      notes: ['Webhook URL은 secret으로 주입합니다.'],
    },
  ],
  validation: {
    noFakeFunctions: true,
    noHardcodedSecrets: true,
    requiresManualReview: true,
  },
} as const;

describe('artifact workspace registry and replay pack contract', () => {
  it('lists monitoring artifact families with local/session-first replay policy', () => {
    expect(listArtifactSchemaEntries()).toEqual([
      expect.objectContaining({
        domainId: MONITORING_ARTIFACT_DOMAIN_ID,
        familyId: 'incident-report',
        artifactKind: 'incident-report',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
        legacyMetadataKey: 'incidentReportArtifact',
        replayPolicy: {
          persistence: 'local-session-first',
          allowsDatabaseWritesByDefault: false,
          compareStrategy: 'stable-json',
        },
      }),
      expect.objectContaining({
        familyId: 'monitoring-analysis',
        legacyMetadataKey: 'monitoringAnalysisArtifact',
      }),
      expect.objectContaining({
        familyId: 'server-snapshot',
        legacyMetadataKey: 'serverSnapshotArtifact',
      }),
      expect.objectContaining({
        familyId: 'ops-procedure',
        artifactKind: 'ops-procedure',
        legacyMetadataKey: 'opsProcedureArtifact',
      }),
    ]);
  });

  it('resolves only supported domain/kind/version schema entries', () => {
    expect(
      resolveArtifactSchemaEntry({
        domainId: MONITORING_ARTIFACT_DOMAIN_ID,
        artifactKind: 'server-snapshot',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
      })
    ).toMatchObject({
      familyId: 'server-snapshot',
      artifactKind: 'server-snapshot',
    });

    expect(
      resolveArtifactSchemaEntry({
        domainId: MONITORING_ARTIFACT_DOMAIN_ID,
        artifactKind: 'server-snapshot',
        artifactVersion: '2026-01-01-legacy',
      })
    ).toBeUndefined();
  });

  it('creates, restores, and compares deterministic replay packs', () => {
    const envelope = createArtifactEnvelope(snapshotArtifact, {
      domainId: MONITORING_ARTIFACT_DOMAIN_ID,
      sourceMode: 'otel-static',
      dataSlot: '07:00 KST',
      traceId: 'trace-artifact-workspace-1',
    });
    const replayPack = createArtifactReplayPack({
      workspaceId: 'workspace-local-session-1',
      createdAt: '2026-05-06T00:01:00.000Z',
      envelopes: [envelope],
    });

    expect(replayPack).toEqual({
      replayPackVersion: ARTIFACT_REPLAY_PACK_VERSION,
      workspaceId: 'workspace-local-session-1',
      createdAt: '2026-05-06T00:01:00.000Z',
      entries: [
        expect.objectContaining({
          schema: {
            domainId: MONITORING_ARTIFACT_DOMAIN_ID,
            familyId: 'server-snapshot',
            artifactKind: 'server-snapshot',
            artifactVersion: ARTIFACT_CONTRACT_VERSION,
          },
          generatedAt: '2026-05-06T00:00:00.000Z',
          sourceMode: 'otel-static',
          dataSlot: '07:00 KST',
          traceId: 'trace-artifact-workspace-1',
          payload: snapshotArtifact,
        }),
      ],
    });

    expect(readArtifactReplayPack(replayPack)).toEqual(replayPack);
    expect(compareArtifactReplayPacks(replayPack, replayPack)).toEqual({
      matched: [replayPack.entries[0].id],
      missing: [],
      added: [],
      changed: [],
    });
  });

  it('includes ops-procedure artifacts in replay packs without database writes', () => {
    const envelope = createArtifactEnvelope(opsProcedureArtifact, {
      domainId: MONITORING_ARTIFACT_DOMAIN_ID,
      sourceMode: 'otel-static',
      dataSlot: '07:00 KST',
      traceId: 'trace-ops-procedure-1',
    });
    const replayPack = createArtifactReplayPack({
      workspaceId: 'workspace-ops-procedure',
      createdAt: '2026-05-11T00:01:00.000Z',
      envelopes: [envelope],
    });

    expect(replayPack.entries).toHaveLength(1);
    expect(replayPack.entries[0]).toMatchObject({
      schema: {
        domainId: MONITORING_ARTIFACT_DOMAIN_ID,
        familyId: 'ops-procedure',
        artifactKind: 'ops-procedure',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
      },
      sourceMode: 'otel-static',
      dataSlot: '07:00 KST',
      payload: opsProcedureArtifact,
    });
    expect(readArtifactReplayPack(replayPack)).toEqual(replayPack);
  });

  it('drops unsupported replay entries without leaking raw unsafe payloads', () => {
    const restored = readArtifactReplayPack({
      replayPackVersion: ARTIFACT_REPLAY_PACK_VERSION,
      workspaceId: 'workspace-local-session-1',
      createdAt: '2026-05-06T00:01:00.000Z',
      entries: [
        {
          id: 'unsafe-entry',
          schema: {
            domainId: 'sample-domain',
            familyId: 'unsafe-widget',
            artifactKind: 'unsafe-widget',
            artifactVersion: '2026-05-06-test',
          },
          generatedAt: '2026-05-06T00:00:00.000Z',
          sourceMode: 'tool-result',
          payload: {
            kind: 'unsafe-widget',
            html: '<script>alert(1)</script>',
            url: 'javascript:alert(1)',
          },
        },
      ],
    });

    expect(restored?.entries).toEqual([]);
    expect(JSON.stringify(restored)).not.toContain('<script>');
    expect(JSON.stringify(restored)).not.toContain('javascript:');
  });
});
