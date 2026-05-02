import { describe, expect, it } from 'vitest';
import { parseMonitoringBatchAnalysisResponse } from './monitoring-analysis-artifact';

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
