import { describe, expect, it } from 'vitest';
import {
  getDashboardAlertMetricLabel,
  getHighestServerAlertMetric,
  supportsDashboardAlertAIPrefill,
  toDashboardAlertContext,
} from './alert-ai-context';

describe('alert-ai-context', () => {
  it('지원 메트릭만 AI prefill 대상으로 판별해야 한다', () => {
    expect(supportsDashboardAlertAIPrefill('cpu')).toBe(true);
    expect(supportsDashboardAlertAIPrefill('memory')).toBe(true);
    expect(supportsDashboardAlertAIPrefill('filesystem')).toBe(true);
    expect(supportsDashboardAlertAIPrefill('network')).toBe(false);
  });

  it('metric label을 dashboard contract로 정규화해야 한다', () => {
    expect(getDashboardAlertMetricLabel('cpu_usage')).toBe('CPU');
    expect(getDashboardAlertMetricLabel('memory')).toBe('MEM');
    expect(getDashboardAlertMetricLabel('filesystem')).toBe('DISK');
    expect(getDashboardAlertMetricLabel('network')).toBeNull();
  });

  it('서버 카드 최고 사용률 메트릭을 일관되게 선택해야 한다', () => {
    expect(
      getHighestServerAlertMetric({
        cpu: 71,
        memory: 86,
        disk: 84,
      })
    ).toEqual({
      metricLabel: 'MEM',
      metricValue: 86,
    });
  });

  it('동점 상황에서 CPU를 우선 선택해야 한다', () => {
    // reduce는 strictly greater 조건이므로 첫 번째 최댓값(CPU)을 유지
    const result = getHighestServerAlertMetric({
      cpu: 90,
      memory: 90,
      disk: 90,
    });
    expect(result).toEqual({ metricLabel: 'CPU', metricValue: 90 });
  });

  it('모든 메트릭이 0일 때 CPU를 반환해야 한다', () => {
    const result = getHighestServerAlertMetric({ cpu: 0, memory: 0, disk: 0 });
    expect(result).toEqual({ metricLabel: 'CPU', metricValue: 0 });
  });

  it('null/undefined 메트릭은 0으로 처리해야 한다', () => {
    const result = getHighestServerAlertMetric({
      cpu: undefined as unknown as number,
      memory: 55,
      disk: undefined as unknown as number,
    });
    expect(result).toEqual({ metricLabel: 'MEM', metricValue: 55 });
  });

  it('지원하지 않는 메트릭은 null을 반환해야 한다', () => {
    expect(
      toDashboardAlertContext({
        serverId: 's1',
        instance: 'server-1',
        metric: 'network_bytes',
        value: 99,
      })
    ).toBeNull();
  });

  it('active(non-resolved) alert는 promptOverride 없이 반환해야 한다', () => {
    const ctx = toDashboardAlertContext({
      serverId: 's2',
      instance: 'server-2',
      metric: 'cpu_usage',
      value: 78.6,
    });
    expect(ctx).toEqual({
      serverId: 's2',
      serverName: 'server-2',
      metricLabel: 'CPU',
      metricValue: 79,
    });
    expect(ctx?.promptOverride).toBeUndefined();
  });

  it('resolved alert는 재발 방지 promptOverride를 포함해야 한다', () => {
    expect(
      toDashboardAlertContext({
        serverId: 's1',
        instance: 'server-1',
        metric: 'disk',
        value: 91.4,
        state: 'resolved',
      })
    ).toEqual(
      expect.objectContaining({
        serverId: 's1',
        serverName: 'server-1',
        metricLabel: 'DISK',
        metricValue: 91,
        promptOverride: expect.stringContaining('재발 방지'),
      })
    );
  });
});
