import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_TREND_CAPABILITY_ID,
} from './constants';
import {
  monitoringMetricTrendEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: trend evidence', () => {
  it('resolves whole-fleet disk trend frame without drifting to CPU summary', async () => {
    const evidence = await monitoringMetricTrendEvidenceProvider.resolve({
      ...createEvidenceRequest('전체 서버 디스크 추이', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 22,
            memory: 61,
            disk: 31,
            network: 10,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'warning',
            cpu: 18,
            memory: 55,
            disk: 82,
            network: 11,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'disk',
        timeWindow: 'unknown',
        aggregation: 'unknown',
        ambiguity: 'low',
        confidence: 0.8,
      },
    });

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-trend',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        intent: 'metric_trend',
        metric: 'disk',
      },
    });
    expect(evidence?.fallback).toContain('전체 서버 디스크 추이');
    expect(evidence?.fallback).toContain('대상: 2대');
    expect(evidence?.fallback).toContain('현재 디스크 상위');
    expect(evidence?.fallback).not.toContain('CPU 평균');
  });

  it('routes single-server generic 24h metric trend queries to deterministic trend evidence', async () => {
    const query = 'cache-redis-dc1-01 서버의 24시간 메트릭 추세 알려줘';
    const request = createEvidenceRequest(query, {
      timeLabel: '07:50',
      servers: [
        {
          id: 'cache-redis-dc1-01',
          type: 'cache',
          status: 'online',
          cpu: 22,
          memory: 61,
          disk: 31,
          network: 10,
        },
        {
          id: 'api-was-dc1-01',
          type: 'application',
          status: 'online',
          cpu: 63,
          memory: 55,
          disk: 30,
          network: 64,
        },
      ],
    });

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: 'generic-metric-trend',
      metrics: ['cpu', 'memory', 'disk'],
      targets: ['cache-redis-dc1-01'],
    });

    const evidence = await monitoringMetricTrendEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-trend',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        intent: 'metric_trend',
        sourceIntent: 'generic-metric-trend',
        metrics: ['cpu', 'memory', 'disk'],
        targets: ['cache-redis-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain('캐시 서버 1대 메트릭 추이');
    expect(evidence?.fallback).toContain('서버별 24h 추세');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).toContain('24h 평균');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
  });

  it('does not let metric_current intent frames preempt single-server 24h trend parsing', async () => {
    const query = 'cache-redis-dc1-01 서버의 24시간 메트릭 추세 알려줘';
    const request = {
      ...createEvidenceRequest(query, {
        timeLabel: '07:50',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 22,
            memory: 61,
            disk: 31,
            network: 10,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 63,
            memory: 55,
            disk: 30,
            network: 64,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'entity',
        targets: ['cache-redis-dc1-01'],
        metric: 'cpu',
        timeWindow: 'current',
        aggregation: 'unknown',
        ambiguity: 'low',
        confidence: 0.82,
      },
    };

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_trend',
      capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
      sourceIntent: 'generic-metric-trend',
      metrics: ['cpu', 'memory', 'disk'],
      targets: ['cache-redis-dc1-01'],
    });

    const evidence = await monitoringMetricTrendEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-trend',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        intent: 'metric_trend',
        sourceIntent: 'generic-metric-trend',
        metrics: ['cpu', 'memory', 'disk'],
        targets: ['cache-redis-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain('캐시 서버 1대 메트릭 추이');
    expect(evidence?.fallback).toContain('서버별 24h 추세');
    expect(evidence?.fallback).not.toContain('현재 CPU');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
  });
});
