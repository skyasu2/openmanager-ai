import { describe, expect, it } from 'vitest';
import { MONITORING_METRIC_CURRENT_CAPABILITY_ID } from './constants';
import {
  monitoringMetricCurrentEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: directional regressions', () => {
  it('routes "CPU와 메모리 둘 다 높은" without threshold to multi-metric-no-threshold path', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('CPU와 메모리 둘 다 높은 서버 알려줘', {
        timeLabel: '08:50',
        servers: [
          { id: 'api-was-dc1-01', type: 'application', status: 'warning', cpu: 84, memory: 62, disk: 41 },
          { id: 'api-was-dc1-02', type: 'application', status: 'online', cpu: 43, memory: 78, disk: 39 },
          { id: 'web-nginx-dc1-01', type: 'web', status: 'online', cpu: 21, memory: 45, disk: 28 },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        sourceIntent: 'multi-metric-no-threshold',
        metrics: expect.arrayContaining(['cpu', 'memory']),
        filterOperator: 'AND',
      },
    });
    // 합산 점수 기준 정렬: api-was-dc1-01(84+62=146) > api-was-dc1-02(43+78=121)
    expect(evidence?.fallback).toMatch(/api-was-dc1-01.+api-was-dc1-02/s);
    expect(evidence?.fallback).toContain('CPU + 메모리');
  });

  it('routes inverse CPU-low and memory-high filters to directional multi-metric filtering', async () => {
    const parsed = parseCurrentMetricsEvidenceRequest(
      createEvidenceRequest('CPU 낮고 메모리 높은 서버 알려줘')
    );

    expect(parsed).toMatchObject({
      intent: 'metric_current',
      sourceIntent: 'multi-metric-directional-filter',
      metrics: ['cpu', 'memory'],
      metricConditions: [
        {
          metric: 'cpu',
          operator: '<=',
          threshold: 50,
          inferredThreshold: true,
        },
        {
          metric: 'memory',
          operator: '>=',
          threshold: 80,
          inferredThreshold: true,
        },
      ],
      filterOperator: 'AND',
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('CPU 낮고 메모리 높은 서버 알려줘', {
        timeLabel: '09:10',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 19,
            memory: 92,
            disk: 22,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 84,
            memory: 86,
            disk: 41,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 34,
            memory: 55,
            disk: 28,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        sourceIntent: 'multi-metric-directional-filter',
        metrics: ['cpu', 'memory'],
        metricConditions: expect.arrayContaining([
          expect.objectContaining({ metric: 'cpu', operator: '<=', threshold: 50 }),
          expect.objectContaining({ metric: 'memory', operator: '>=', threshold: 80 }),
        ]),
        filterOperator: 'AND',
      },
    });
    expect(evidence?.fallback).toContain('CPU <= 50%');
    expect(evidence?.fallback).toContain('메모리 >= 80%');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });
});
