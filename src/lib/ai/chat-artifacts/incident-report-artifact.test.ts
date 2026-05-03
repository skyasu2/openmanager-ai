import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateIncidentReportArtifact } from './incident-report-artifact';
import { ARTIFACT_CONTRACT_VERSION } from './types';

const queryAsOfDataSlot = {
  slotIndex: 42,
  minuteOfDay: 420,
  timeLabel: '07:00 KST',
};

describe('generateIncidentReportArtifact', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns an envelope-compatible versioned artifact payload', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        source: 'cloud-run',
        report: {
          id: 'incident-artifact-1',
          title: 'API CPU 포화',
          severity: 'critical',
          created_at: '2026-05-03T00:00:00.000Z',
          affected_servers: ['api-was-dc1-01'],
          root_cause_analysis: {
            primary_cause: 'API 서버 CPU가 임계치를 초과했습니다.',
          },
          _source: 'cloud-run',
        },
      }),
    } as Response);

    const artifact = await generateIncidentReportArtifact({
      query: '장애 보고서 작성해줘',
      sessionId: 'session-test',
      queryAsOfDataSlot,
    });

    expect(artifact).toMatchObject({
      artifactVersion: ARTIFACT_CONTRACT_VERSION,
      kind: 'incident-report',
      sourceMode: 'tool-result',
      dataSlot: '07:00 KST',
      source: 'cloud-run',
      report: {
        id: 'incident-artifact-1',
        title: 'API CPU 포화',
        severity: 'critical',
      },
    });
  });
});
