import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createArtifactExecutionWorkspaceId,
  executeChatArtifact,
  saveArtifactExecutionReplayPack,
} from './artifact-execution';
import { generateIncidentReportArtifact } from './incident-report-artifact';
import { generateMonitoringAnalysisArtifact } from './monitoring-analysis-artifact';

vi.mock('./incident-report-artifact', () => ({
  generateIncidentReportArtifact: vi.fn(),
}));

vi.mock('./monitoring-analysis-artifact', () => ({
  generateMonitoringAnalysisArtifact: vi.fn(),
}));

const mockGenerateIncidentReportArtifact = vi.mocked(
  generateIncidentReportArtifact
);
const mockGenerateMonitoringAnalysisArtifact = vi.mocked(
  generateMonitoringAnalysisArtifact
);

describe('artifact execution layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes incident report execution through the existing artifact generator', async () => {
    const artifact = {
      kind: 'incident-report',
      generatedAt: '2026-05-13T00:00:00.000Z',
      report: {
        id: 'report-1',
        title: 'Redis memory warning',
        severity: 'warning',
        timestamp: new Date('2026-05-13T00:00:00.000Z'),
        affectedServers: ['cache-redis-dc1-01'],
        description: 'memory warning',
        status: 'active',
      },
    } as const;
    mockGenerateIncidentReportArtifact.mockResolvedValue(artifact);

    await expect(
      executeChatArtifact({
        kind: 'incident-report',
        query: '장애 보고서 작성',
        sessionId: 'surface-session',
      })
    ).resolves.toBe(artifact);

    expect(mockGenerateIncidentReportArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '장애 보고서 작성',
        sessionId: 'surface-session',
      })
    );
    expect(mockGenerateMonitoringAnalysisArtifact).not.toHaveBeenCalled();
  });

  it('routes monitoring analysis execution through the existing artifact generator', async () => {
    const artifact = {
      kind: 'monitoring-analysis',
      generatedAt: '2026-05-13T00:00:00.000Z',
      title: '전체 서버 이상감지/추세 분석',
      summary: '18개 서버 분석 완료',
      serverCount: 18,
      riskSignalCount: 1,
      warningServers: 1,
      criticalServers: 0,
      analysis: {
        success: true,
        sourceMode: 'replay-json',
        queryAsOf: '2026-05-13T00:00:00.000Z',
        slot: {
          slotIndex: 85,
          hour: 14,
          slotInHour: 1,
          minuteOfDay: 850,
          timeLabel: '14:10 KST',
          startTime: '2026-05-13T00:00:00.000Z',
          endTime: '2026-05-13T00:10:00.000Z',
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
      },
    } as const;
    mockGenerateMonitoringAnalysisArtifact.mockResolvedValue(artifact);

    await expect(
      executeChatArtifact({
        kind: 'monitoring-analysis',
        query: '전체 시스템 추세 분석',
      })
    ).resolves.toBe(artifact);

    expect(mockGenerateMonitoringAnalysisArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        query: '전체 시스템 추세 분석',
      })
    );
    expect(mockGenerateIncidentReportArtifact).not.toHaveBeenCalled();
  });

  it('stores generated artifacts as local-session replay packs', () => {
    let storedReplayPack: unknown;
    const saveReplayPack = vi.fn();
    const artifact = {
      kind: 'incident-report',
      generatedAt: '2026-05-13T00:00:00.000Z',
      sourceMode: 'tool-result',
      artifactVersion: '2026-05-03-v1',
      report: {
        id: 'report-1',
        title: 'Redis memory warning',
        severity: 'warning',
        timestamp: new Date('2026-05-13T00:00:00.000Z'),
        affectedServers: ['cache-redis-dc1-01'],
        description: 'memory warning',
        status: 'active',
      },
    } as const;

    const result = saveArtifactExecutionReplayPack({
      artifact,
      workspaceId: 'surface:incident-report:test',
      store: {
        policy: {
          persistence: 'local-session-first',
          allowsDatabaseWritesByDefault: false,
        },
        saveReplayPack: (pack) => {
          storedReplayPack = pack;
          saveReplayPack(pack);
        },
        importReplayPackExport: vi.fn(),
        readReplayPack: vi.fn(() => storedReplayPack),
        listReplayPacks: vi.fn(() => []),
        clear: vi.fn(),
      },
    });

    expect(result.saved).toBe(true);
    expect(saveReplayPack).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'surface:incident-report:test',
        entries: [
          expect.objectContaining({
            schema: expect.objectContaining({
              artifactKind: 'incident-report',
            }),
            payload: artifact,
          }),
        ],
      })
    );
  });

  it('reports storage_unavailable when the store silently drops the replay pack', () => {
    const artifact = {
      kind: 'incident-report',
      generatedAt: '2026-05-13T00:00:00.000Z',
      sourceMode: 'tool-result',
      artifactVersion: '2026-05-03-v1',
      report: {
        id: 'report-1',
        title: 'Redis memory warning',
        severity: 'warning',
        timestamp: new Date('2026-05-13T00:00:00.000Z'),
        affectedServers: ['cache-redis-dc1-01'],
        description: 'memory warning',
        status: 'active',
      },
    } as const;

    const result = saveArtifactExecutionReplayPack({
      artifact,
      workspaceId: 'surface:incident-report:test',
      store: {
        policy: {
          persistence: 'local-session-first',
          allowsDatabaseWritesByDefault: false,
        },
        saveReplayPack: vi.fn(),
        importReplayPackExport: vi.fn(),
        readReplayPack: vi.fn(() => undefined),
        listReplayPacks: vi.fn(() => []),
        clear: vi.fn(),
      },
    });

    expect(result).toEqual({
      saved: false,
      reason: 'storage_unavailable',
    });
  });

  it('creates delimiter-safe workspace ids from artifact metadata', () => {
    const artifact = {
      kind: 'incident-report',
      generatedAt: '2026-05-13T00:00:00.000Z',
      dataSlot: '07:00 KST',
      report: {
        id: 'report-1',
        title: 'Redis memory warning',
        severity: 'warning',
        timestamp: new Date('2026-05-13T00:00:00.000Z'),
        affectedServers: ['cache-redis-dc1-01'],
        description: 'memory warning',
        status: 'active',
      },
    } as const;

    expect(createArtifactExecutionWorkspaceId(artifact)).toBe(
      'surface:incident-report:07-00-KST:2026-05-13T00-00-00-000Z'
    );
  });
});
