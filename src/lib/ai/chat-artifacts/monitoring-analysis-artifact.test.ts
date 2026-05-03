import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateMonitoringAnalysisArtifact,
  parseMonitoringBatchAnalysisResponse,
} from './monitoring-analysis-artifact';
import { ARTIFACT_CONTRACT_VERSION } from './types';

const validBatchResponse = {
  success: true,
  sourceMode: 'replay-json',
  queryAsOf: '2026-05-02T00:00:00.000Z',
  slot: {
    slotIndex: 143,
    hour: 23,
    slotInHour: 5,
    minuteOfDay: 1430,
    timeLabel: '23:50 KST',
    startTime: '2026-05-02T00:00:00.000Z',
    endTime: '2026-05-02T00:10:00.000Z',
  },
  summary: '18개 서버 분석 완료',
  servers: [],
  riskSignals: [],
  evidenceRefs: [],
  dataFreshness: {
    generatedAt: null,
    sourceUpdatedAt: null,
    stale: false,
  },
};

describe('parseMonitoringBatchAnalysisResponse', () => {
  it('accepts the full monitoring batch artifact contract', () => {
    expect(parseMonitoringBatchAnalysisResponse(validBatchResponse)).toEqual(
      validBatchResponse
    );
  });

  it('rejects partial success payloads that would crash the artifact card', () => {
    expect(
      parseMonitoringBatchAnalysisResponse({
        success: true,
        servers: [],
        riskSignals: [],
      })
    ).toBeNull();
  });
});

describe('generateMonitoringAnalysisArtifact', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns an envelope-compatible versioned artifact payload', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: validBatchResponse,
      }),
    } as Response);

    const artifact = await generateMonitoringAnalysisArtifact({
      query: '전체 서버 추세 분석',
      sessionId: 'session-test',
      queryAsOfDataSlot: {
        slotIndex: 143,
        minuteOfDay: 1430,
        timeLabel: '23:50 KST',
      },
    });

    expect(artifact).toMatchObject({
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
      kind: 'monitoring-analysis',
      sourceMode: 'tool-result',
      dataSlot: '23:50 KST',
      serverCount: 0,
      riskSignalCount: 0,
    });
  });
});
