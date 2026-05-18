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
          system_summary: {
            total_servers: 18,
            healthy_servers: 17,
            warning_servers: 1,
            critical_servers: 0,
            uptimePercent: 97.9,
            affectedDurationMinutes: 30,
            dataSlotLabel: '07:00 KST',
          },
          log_patterns: [
            {
              message:
                'redis-server[pid]: memory usage <pct>% of maxmemory limit',
              count: 23,
              severity: 'WARNING',
              serverId: 'cache-redis-dc1-01',
              firstSeen: '2026-05-03T00:00:00.000Z',
              lastSeen: '2026-05-03T00:30:00.000Z',
            },
          ],
          root_cause_analysis: {
            primary_cause: 'API 서버 CPU가 임계치를 초과했습니다.',
          },
          degraded: true,
          fallbackSource: 'tool-based',
          fallbackReasonCode: 'provider_parse_drift',
          fallbackReason: 'No object generated: could not parse the response.',
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
      degradation: {
        degraded: true,
        fallbackSource: 'tool-based',
        reasonCode: 'provider_parse_drift',
      },
      providerSummary: {
        usedFallback: true,
        fallbackReason: 'provider_parse_drift',
      },
      report: {
        id: 'incident-artifact-1',
        title: 'API CPU 포화',
        severity: 'critical',
        systemSummary: {
          uptimePercent: 97.9,
          affectedDurationMinutes: 30,
          dataSlotLabel: '07:00 KST',
        },
        logPatterns: [
          {
            count: 23,
            severity: 'WARNING',
            serverId: 'cache-redis-dc1-01',
          },
        ],
      },
    });
  });

  it('normalizes degraded report metadata from API responses before artifact exposure', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        source: 'cloud-run',
        report: {
          id: 'incident-artifact-unsafe-metadata',
          title: 'Reporter fallback',
          severity: 'warning',
          created_at: '2026-05-03T00:00:00.000Z',
          affected_servers: ['cache-redis-dc1-01'],
          degraded: true,
          fallbackSource: 'unexpected-source',
          fallbackReasonCode: 'unexpected\r\nX-Injected: true',
          fallbackReason: 'provider returned malformed output',
          _source: 'cloud-run',
        },
      }),
    } as Response);

    const artifact = await generateIncidentReportArtifact({
      query: '장애 보고서 작성해줘',
      sessionId: 'session-test',
      queryAsOfDataSlot,
    });

    expect(artifact.degradation).toEqual({
      degraded: true,
      fallbackSource: 'tool-based',
      reasonCode: 'reporter_degraded',
    });
    expect(artifact.providerSummary).toEqual({
      usedFallback: true,
      fallbackReason: 'reporter_degraded',
    });
  });
});
