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
