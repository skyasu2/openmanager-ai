import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  monitoringMetricCurrentEvidenceProvider,
  monitoringServerHealthEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: metric filters', () => {
  it('preserves single metric thresholds when a current metric frame is present', async () => {
    const request = {
      ...createEvidenceRequest('DB 서버 디스크 60% 이상인 곳', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'online',
            cpu: 41,
            memory: 66,
            disk: 72,
            network: 13,
          },
          {
            id: 'db-mysql-dc1-analytics',
            type: 'database',
            status: 'warning',
            cpu: 45,
            memory: 70,
            disk: 65,
            network: 14,
          },
          {
            id: 'db-mysql-dc1-replica',
            type: 'database',
            status: 'online',
            cpu: 35,
            memory: 58,
            disk: 40,
            network: 12,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'critical',
            cpu: 30,
            memory: 45,
            disk: 95,
            network: 20,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: ['db-mysql-dc1-replica'],
        metric: 'disk',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.8,
      },
    };

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      metric: 'disk',
      threshold: 60,
      thresholdOperator: '>=',
      targets: ['database'],
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      request
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metric: 'disk',
        threshold: 60,
        thresholdOperator: '>=',
        targets: ['database'],
      },
    });
    expect(evidence?.fallback).toContain('DB 서버 디스크 60% 이상 서버');
    expect(evidence?.fallback).toContain('📌 **서버별 현황**');
    expect(evidence?.fallback).toContain('1. **db-mysql-dc1-primary**: 디스크 72%');
    expect(evidence?.fallback).toContain('2. **db-mysql-dc1-analytics**: 디스크 65%');
    expect(evidence?.fallback).not.toContain('• 서버별:');
    expect(evidence?.fallback).not.toContain('db-mysql-dc1-replica');
    expect(evidence?.fallback).not.toContain('storage-nfs-dc1-01');
  });

  it('resolves role group metric comparisons deterministically', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('WAS와 DB 서버 CPU 비교해줘', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 82,
            memory: 62,
            disk: 41,
            network: 18,
          },
          {
            id: 'api-was-dc1-02',
            type: 'application',
            status: 'online',
            cpu: 58,
            memory: 51,
            disk: 39,
            network: 16,
          },
          {
            id: 'db-mysql-dc1-01',
            type: 'database',
            status: 'online',
            cpu: 42,
            memory: 71,
            disk: 65,
            network: 13,
          },
          {
            id: 'db-mysql-dc1-02',
            type: 'database',
            status: 'online',
            cpu: 38,
            memory: 68,
            disk: 61,
            network: 12,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 92,
            memory: 45,
            disk: 28,
            network: 11,
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
        sourceIntent: 'group-compare',
        metric: 'cpu',
        groupTargets: ['application', 'database'],
      },
    });
    expect(evidence?.fallback).toContain('애플리케이션 서버 vs DB 서버 CPU 비교');
    expect(evidence?.fallback).toContain('애플리케이션 서버 70%');
    expect(evidence?.fallback).toContain('DB 서버 40%');
    expect(evidence?.fallback).toContain('평균 CPU 30%p 높습니다');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('resolves multi-metric AND threshold filters deterministically', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('CPU와 메모리 모두 50% 이상인 서버 알려줘', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 82,
            memory: 62,
            disk: 41,
            network: 18,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 44,
            memory: 91,
            disk: 40,
            network: 12,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 55,
            memory: 45,
            disk: 28,
            network: 11,
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
        metrics: ['cpu', 'memory'],
        threshold: 50,
        thresholdOperator: '>=',
        filterOperator: 'AND',
      },
    });
    expect(evidence?.fallback).toContain('CPU + 메모리 50% 이상 서버');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('routes inverse directional multi-metric filters before generic health frames (Q-NEW48)', async () => {
    const request = {
      ...createEvidenceRequest('CPU는 낮고 메모리는 높은 서버 찾아줘', {
        timeLabel: '16:00',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 44,
            memory: 91,
            disk: 40,
            network: 12,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 63,
            memory: 53,
            disk: 41,
            network: 18,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 35,
            memory: 45,
            disk: 28,
            network: 11,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'fleet',
        targets: [],
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        executionMode: 'single',
        confidence: 0.9,
      },
    };

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'multi-metric-directional-filter',
      metrics: ['cpu', 'memory'],
      filterOperator: 'AND',
      metricConditions: [
        { metric: 'cpu', operator: '<=', threshold: 50 },
        { metric: 'memory', operator: '>=', threshold: 80 },
      ],
    });
    expect(monitoringServerHealthEvidenceProvider.canHandle(request)).toBe(
      false
    );

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      request
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        sourceIntent: 'multi-metric-directional-filter',
        metrics: ['cpu', 'memory'],
      },
    });
    expect(evidence?.fallback).toContain('조건: CPU <= 50% AND 메모리 >= 80%');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('keeps strict greater-than multi-metric filters exclusive', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('CPU와 메모리 모두 50% 초과인 서버 알려줘', {
        timeLabel: '07:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 51,
            memory: 52,
            disk: 41,
            network: 18,
          },
          {
            id: 'api-was-dc1-02',
            type: 'application',
            status: 'online',
            cpu: 50,
            memory: 60,
            disk: 39,
            network: 16,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 44,
            memory: 91,
            disk: 40,
            network: 12,
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
        metrics: ['cpu', 'memory'],
        threshold: 50,
        thresholdOperator: '>',
        filterOperator: 'AND',
      },
    });
    expect(evidence?.fallback).toContain('CPU + 메모리 50% 초과 서버');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('api-was-dc1-02');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
  });

  it('matches explicit server IDs case-insensitively against snapshot IDs', async () => {
    const request = createEvidenceRequest(
      'web-dc1-az1 과 web-dc1-az2 의 CPU 사용량을 비교해줘',
      {
        timeLabel: '07:50',
        servers: [
          {
            id: 'Web-DC1-AZ1',
            type: 'web',
            status: 'online',
            cpu: 44,
            memory: 52,
            disk: 31,
            network: 11,
          },
          {
            id: 'Web-DC1-AZ2',
            type: 'web',
            status: 'warning',
            cpu: 67,
            memory: 58,
            disk: 35,
            network: 15,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 92,
            memory: 45,
            disk: 28,
            network: 11,
          },
        ],
      }
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      metric: 'cpu',
      targets: ['web-dc1-az1', 'web-dc1-az2'],
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      request
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metric: 'cpu',
        targets: ['web-dc1-az1', 'web-dc1-az2'],
      },
    });
    expect(evidence?.fallback).toContain('웹 서버 2대 CPU 현황');
    expect(evidence?.fallback).toContain('Web-DC1-AZ1 44%');
    expect(evidence?.fallback).toContain('Web-DC1-AZ2 67%');
    expect(evidence?.fallback).not.toContain('api-was-dc1-01');
  });
});
