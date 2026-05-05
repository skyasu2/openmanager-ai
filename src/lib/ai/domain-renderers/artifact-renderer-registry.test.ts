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
});
