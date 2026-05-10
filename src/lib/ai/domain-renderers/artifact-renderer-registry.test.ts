import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_CONTRACT_VERSION,
  type ServerSnapshotArtifact,
} from '@/lib/ai/chat-artifacts/types';
import {
  createArtifactRendererKey,
  isArtifactRendererKeyAllowed,
  MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
  resolveArtifactRendererEntries,
} from './artifact-renderer-registry';

const snapshotArtifact: ServerSnapshotArtifact = {
  kind: 'server-snapshot',
  generatedAt: '2026-05-05T00:00:00.000Z',
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
      content: 'SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL}"\nTHRESHOLD=80',
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

describe('frontend artifact renderer registry contract', () => {
  it('allows only domain + artifact kind + version renderer keys', () => {
    const supportedKey = createArtifactRendererKey({
      domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
      artifactKind: 'server-snapshot',
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
    });
    const wrongDomainKey = createArtifactRendererKey({
      domainId: 'sample-domain',
      artifactKind: 'server-snapshot',
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
    });

    expect(isArtifactRendererKeyAllowed(supportedKey)).toBe(true);
    expect(isArtifactRendererKeyAllowed(wrongDomainKey)).toBe(false);
  });

  it('allows ops-procedure renderer keys and resolves typed envelope payloads', () => {
    const supportedKey = createArtifactRendererKey({
      domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
      artifactKind: 'ops-procedure',
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
    });

    expect(isArtifactRendererKeyAllowed(supportedKey)).toBe(true);

    const entries = resolveArtifactRendererEntries({
      artifactEnvelopes: [
        {
          domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
          kind: 'ops-procedure',
          artifactVersion: ARTIFACT_CONTRACT_VERSION,
          generatedAt: '2026-05-11T00:00:00.000Z',
          sourceMode: 'otel-static',
          payload: opsProcedureArtifact,
        },
      ],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        status: 'supported',
        domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
        artifactKind: 'ops-procedure',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
        artifact: opsProcedureArtifact,
      }),
    ]);
  });

  it('normalizes restored legacy assistant metadata into renderer entries', () => {
    const entries = resolveArtifactRendererEntries({
      serverSnapshotArtifact: snapshotArtifact,
    });

    expect(entries).toEqual([
      expect.objectContaining({
        status: 'supported',
        domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
        artifactKind: 'server-snapshot',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
        artifact: snapshotArtifact,
        envelope: expect.objectContaining({
          sourceMode: 'restored-legacy',
          payload: snapshotArtifact,
        }),
      }),
    ]);
  });

  it('keeps unsupported raw artifact envelopes out of renderer payloads', () => {
    const entries = resolveArtifactRendererEntries({
      artifactEnvelopes: [
        {
          domainId: 'sample-domain',
          kind: 'unsafe-widget',
          artifactVersion: '2026-05-05-test',
          generatedAt: '2026-05-05T00:00:00.000Z',
          sourceMode: 'tool-result',
          payload: {
            html: '<script>alert(1)</script>',
            url: 'javascript:alert(1)',
          },
        },
      ],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        status: 'unsupported',
        domainId: 'sample-domain',
        artifactKind: 'unsafe-widget',
        artifactVersion: '2026-05-05-test',
      }),
    ]);
    expect(JSON.stringify(entries)).not.toContain('<script>');
    expect(JSON.stringify(entries)).not.toContain('javascript:');
  });

  it('rejects malformed supported-kind envelopes before typed renderer cards receive them', () => {
    const entries = resolveArtifactRendererEntries({
      artifactEnvelopes: [
        {
          domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
          kind: 'server-snapshot',
          artifactVersion: ARTIFACT_CONTRACT_VERSION,
          generatedAt: '2026-05-05T00:00:00.000Z',
          sourceMode: 'tool-result',
          payload: {
            kind: 'server-snapshot',
            generatedAt: '2026-05-05T00:00:00.000Z',
            title: 'malformed snapshot',
          },
        },
      ],
    });

    expect(entries).toEqual([
      expect.objectContaining({
        status: 'unsupported',
        domainId: MONITORING_ARTIFACT_RENDERER_DOMAIN_ID,
        artifactKind: 'server-snapshot',
        artifactVersion: ARTIFACT_CONTRACT_VERSION,
        reason: 'invalid_payload',
      }),
    ]);
    expect(entries).not.toEqual([
      expect.objectContaining({
        status: 'supported',
      }),
    ]);
  });
});
