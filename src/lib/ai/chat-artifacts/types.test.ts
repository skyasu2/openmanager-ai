import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_CONTRACT_VERSION,
  createArtifactEnvelope,
  readArtifactEnvelope,
  type ServerSnapshotArtifact,
  sanitizeArtifactProviderSummary,
} from './types';

const snapshotArtifact: ServerSnapshotArtifact = {
  kind: 'server-snapshot',
  generatedAt: '2026-05-03T00:00:00.000Z',
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

describe('chat artifact envelope contract', () => {
  it('creates a versioned envelope without wrapping legacy payload shape into cards', () => {
    const envelope = createArtifactEnvelope(snapshotArtifact, {
      sourceMode: 'otel-static',
      traceId: 'trace-artifact-1',
      dataSlot: '07:00 KST',
    });

    expect(envelope).toMatchObject({
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
      kind: 'server-snapshot',
      generatedAt: '2026-05-03T00:00:00.000Z',
      sourceMode: 'otel-static',
      traceId: 'trace-artifact-1',
      dataSlot: '07:00 KST',
    });
    expect(envelope.payload).toBe(snapshotArtifact);
  });

  it('reads restored legacy artifact payloads as restored-legacy envelopes', () => {
    const envelope = readArtifactEnvelope(snapshotArtifact);

    expect(envelope).toMatchObject({
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
      kind: 'server-snapshot',
      generatedAt: '2026-05-03T00:00:00.000Z',
      sourceMode: 'restored-legacy',
      dataSlot: '07:00 KST',
    });
    expect(envelope.payload).toBe(snapshotArtifact);
  });

  it('keeps provider summaries public-safe by dropping raw errors and owner metadata', () => {
    const providerSummary = sanitizeArtifactProviderSummary({
      provider: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      usedFallback: true,
      fallbackReason: 'rate_limit',
      owner: 'internal-platform',
      rawError: 'Bearer sk-live-secret should never be exposed',
      attempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          status: 'failed',
          error: 'API key sk-live-secret leaked',
          errorCode: 'rate_limit',
        },
      ],
    });

    expect(providerSummary).toEqual({
      provider: 'groq',
      modelId: 'llama-3.3-70b-versatile',
      usedFallback: true,
      fallbackReason: 'rate_limit',
      attempts: [
        {
          provider: 'cerebras',
          modelId: 'llama3.1-8b',
          status: 'failed',
          errorCode: 'rate_limit',
        },
      ],
    });
    expect(JSON.stringify(providerSummary)).not.toContain('sk-live-secret');
    expect(JSON.stringify(providerSummary)).not.toContain('internal-platform');
  });
});
