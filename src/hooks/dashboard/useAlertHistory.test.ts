import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAlertHistory } from './useAlertHistory';
import type { MonitoringReportResponse } from './useMonitoringReport';
import { useMonitoringReport } from './useMonitoringReport';

vi.mock('./useMonitoringReport', () => ({
  useMonitoringReport: vi.fn(),
}));

const mockedUseMonitoringReport = vi.mocked(useMonitoringReport);

function createAlert(
  id: string,
  state: 'firing' | 'resolved',
  firedAt: string,
  overrides?: Partial<MonitoringReportResponse['firingAlerts'][number]>
): MonitoringReportResponse['firingAlerts'][number] {
  return {
    id,
    serverId: 'server-1',
    instance: 'server-1:9100',
    labels: { server_type: 'web', location: 'seoul' },
    metric: 'cpu',
    value: 91,
    threshold: 80,
    severity: 'warning',
    state,
    firedAt,
    duration: 90,
    ...overrides,
  };
}

function createReport(
  overrides?: Partial<MonitoringReportResponse>
): MonitoringReportResponse {
  return {
    success: true,
    timestamp: '2026-02-13T10:00:00.000Z',
    health: {
      score: 88,
      grade: 'B',
      penalties: {
        criticalAlerts: 0,
        warningAlerts: 5,
        highCpuAvg: 0,
        highMemoryAvg: 0,
        highDiskAvg: 0,
        longFiringAlerts: 0,
      },
    },
    aggregated: {
      statusCounts: {
        total: 1,
        online: 1,
        warning: 0,
        critical: 0,
        offline: 0,
      },
      byServerType: [
        {
          serverType: 'web',
          count: 1,
          avgCpu: 50,
          avgMemory: 40,
          avgDisk: 20,
          avgNetwork: 10,
          maxCpu: 50,
          maxMemory: 40,
          onlineCount: 1,
          warningCount: 0,
          criticalCount: 0,
        },
      ],
      topCpu: [
        {
          serverId: 'server-1',
          instance: 'server-1:9100',
          serverType: 'web',
          value: 50,
        },
      ],
      topMemory: [
        {
          serverId: 'server-1',
          instance: 'server-1:9100',
          serverType: 'web',
          value: 40,
        },
      ],
      avgCpu: 50,
      avgMemory: 40,
      avgDisk: 20,
      avgNetwork: 10,
    },
    firingAlerts: [],
    resolvedAlerts: [],
    metadata: {
      dataSource: 'hourly-data',
      processingTime: 5,
    },
    ...overrides,
  };
}

describe('useAlertHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('state 필터 적용 시 resolved 알림만 반환하고 통계를 계산한다', () => {
    const firing = createAlert(
      'firing-1',
      'firing',
      '2026-02-13T09:50:00.000Z'
    );
    const resolved = createAlert(
      'resolved-1',
      'resolved',
      '2026-02-13T09:40:00.000Z',
      {
        severity: 'critical',
        duration: 180,
        resolvedAt: '2026-02-13T09:45:00.000Z',
      }
    );

    mockedUseMonitoringReport.mockReturnValue({
      data: createReport({
        firingAlerts: [firing],
        resolvedAlerts: [resolved],
      }),
      isLoading: false,
    } as ReturnType<typeof useMonitoringReport>);

    const { result } = renderHook(() => useAlertHistory({ state: 'resolved' }));

    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].id).toBe('resolved-1');
    expect(result.current.alerts[0].state).toBe('resolved');
    expect(result.current.stats.total).toBe(1);
    expect(result.current.stats.critical).toBe(1);
    expect(result.current.stats.firing).toBe(0);
    expect(result.current.stats.resolved).toBe(1);
    expect(result.current.stats.avgResolutionSec).toBe(180);
  });

  it('timeRangeMs 필터로 최근 알림만 반환한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-13T10:00:00.000Z'));

    const recent = createAlert(
      'recent-1',
      'firing',
      '2026-02-13T09:30:00.000Z'
    );
    const old = createAlert('old-1', 'firing', '2026-02-13T07:00:00.000Z');

    mockedUseMonitoringReport.mockReturnValue({
      data: createReport({ firingAlerts: [recent, old] }),
      isLoading: false,
    } as ReturnType<typeof useMonitoringReport>);

    const { result } = renderHook(() =>
      useAlertHistory({ timeRangeMs: 3_600_000 })
    );

    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0].id).toBe('recent-1');
  });

  it('모니터링 훅 에러를 errorMessage로 전달한다', () => {
    mockedUseMonitoringReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('모니터링 리포트 조회 권한이 없습니다.'),
    } as ReturnType<typeof useMonitoringReport>);

    const { result } = renderHook(() => useAlertHistory());

    expect(result.current.isError).toBe(true);
    expect(result.current.errorMessage).toBe(
      '모니터링 리포트 조회 권한이 없습니다.'
    );
    expect(result.current.alerts).toHaveLength(0);
  });
});
