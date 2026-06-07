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

describe('current metrics domain evidence providers: current metric evidence', () => {
  it('resolves cache current memory frame as deterministic group metric evidence', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve({
      ...createEvidenceRequest('캐시 서버 메모리 현황', {
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
            id: 'cache-redis-dc1-02',
            type: 'cache',
            status: 'online',
            cpu: 18,
            memory: 55,
            disk: 29,
            network: 11,
          },
          {
            id: 'cache-redis-dc1-03',
            type: 'cache',
            status: 'online',
            cpu: 20,
            memory: 49,
            disk: 33,
            network: 12,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 30,
            memory: 40,
            disk: 25,
            network: 13,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: ['cache-redis-dc1-01'],
        metric: 'memory',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.8,
      },
    });

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        metric: 'memory',
      },
    });
    expect(evidence?.fallback).toContain('캐시 서버 3대 메모리 현황');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01 61%');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('keeps exact cache server frames when the user names the server ID', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve({
      ...createEvidenceRequest('cache-redis-dc1-01 캐시 서버 메모리 현황', {
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
            id: 'cache-redis-dc1-02',
            type: 'cache',
            status: 'online',
            cpu: 18,
            memory: 55,
            disk: 29,
            network: 11,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'server',
        targets: ['cache-redis-dc1-01'],
        metric: 'memory',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.8,
      },
    });

    expect(evidence?.fallback).toContain('캐시 서버 1대 메모리 현황');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01 61%');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-02');
  });

  it('routes explicit server detail metric prompts to deterministic current metric evidence', async () => {
    const request = createEvidenceRequest(
      'cache-redis-dc1-01 메모리 상태 자세히',
      {
        timeLabel: '07:50',
        servers: [
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 22,
            memory: 83,
            disk: 31,
            network: 10,
          },
          {
            id: 'cache-redis-dc1-02',
            type: 'cache',
            status: 'online',
            cpu: 18,
            memory: 55,
            disk: 29,
            network: 11,
          },
        ],
      }
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-metric',
      metric: 'memory',
      targets: ['cache-redis-dc1-01'],
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
        sourceIntent: 'server-detail-metric',
        metric: 'memory',
        targets: ['cache-redis-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain('캐시 서버 1대 메모리 현황');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01 83%');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-02');

    const serverHealthFrameRequest = {
      ...request,
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'entity',
        targets: ['cache-redis-dc1-01'],
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.94,
      },
    };

    expect(
      parseCurrentMetricsEvidenceRequest(serverHealthFrameRequest)
    ).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-metric',
      metric: 'memory',
      targets: ['cache-redis-dc1-01'],
    });
    await expect(
      monitoringMetricCurrentEvidenceProvider.resolve(serverHealthFrameRequest)
    ).resolves.toMatchObject({
      id: 'monitoring-metric-current',
      metadata: {
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        sourceIntent: 'server-detail-metric',
        metric: 'memory',
        targets: ['cache-redis-dc1-01'],
      },
    });
  });

  it('routes explicit server-to-server metric comparisons to deterministic current metric evidence', async () => {
    const request = createEvidenceRequest(
      'api-was-dc1-01 과 api-was-dc1-02 의 CPU 사용량을 비교해줘',
      {
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
            cpu: 57,
            memory: 51,
            disk: 39,
            network: 16,
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
      }
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      metric: 'cpu',
      targets: ['api-was-dc1-01', 'api-was-dc1-02'],
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
        targets: ['api-was-dc1-01', 'api-was-dc1-02'],
      },
    });
    expect(evidence?.fallback).toContain('애플리케이션 서버 2대 CPU 현황');
    expect(evidence?.fallback).toContain('api-was-dc1-01 82%');
    expect(evidence?.fallback).toContain('api-was-dc1-02 57%');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('keeps all requested metrics for explicit server-to-server comparisons (P13)', async () => {
    const request = createEvidenceRequest(
      'api-was-dc1-01 과 api-was-dc1-02 의 CPU, 메모리, 디스크를 직접 비교해줘',
      {
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
            cpu: 57,
            memory: 51,
            disk: 39,
            network: 16,
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
      }
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-compare',
      metrics: ['cpu', 'memory', 'disk'],
      targets: ['api-was-dc1-01', 'api-was-dc1-02'],
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
        sourceIntent: 'server-compare',
        metrics: ['cpu', 'memory', 'disk'],
        targets: ['api-was-dc1-01', 'api-was-dc1-02'],
      },
    });
    expect(evidence?.fallback).toContain(
      '애플리케이션 서버 2대 CPU + 메모리 + 디스크 비교'
    );
    expect(evidence?.fallback).toContain(
      'api-was-dc1-01**: CPU 82%, 메모리 62%, 디스크 41%'
    );
    expect(evidence?.fallback).toContain(
      'api-was-dc1-02**: CPU 57%, 메모리 51%, 디스크 39%'
    );
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });

  it('keeps all requested metrics for single-server detail prompts with health frames (P13/Q-NEW34)', async () => {
    const request = {
      ...createEvidenceRequest('api-was-dc1-01의 CPU와 메모리 상태를 같이 알려줘', {
        timeLabel: '16:00',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 63,
            memory: 53,
            disk: 41,
            network: 18,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'entity',
        targets: ['api-was-dc1-01'],
        metric: 'cpu',
        timeWindow: 'current',
        aggregation: 'detail',
        ambiguity: 'low',
        executionMode: 'single',
        confidence: 0.93,
      },
    };

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'server-detail-multi-metric',
      metrics: ['cpu', 'memory'],
      targets: ['api-was-dc1-01'],
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
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        intent: 'metric_current',
        sourceIntent: 'server-detail-multi-metric',
        metrics: ['cpu', 'memory'],
        targets: ['api-was-dc1-01'],
      },
    });
    expect(evidence?.fallback).toContain(
      'api-was-dc1-01**: CPU 63%, 메모리 53%'
    );
    expect(evidence?.fallback).not.toContain('디스크 41%');
  });

  it('resolves WAS group current metric prompts through application group hints', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      createEvidenceRequest('WAS 서버 CPU 현황 알려줘', {
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
            cpu: 57,
            memory: 51,
            disk: 39,
            network: 16,
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
        metric: 'cpu',
        targets: ['application'],
      },
    });
    expect(evidence?.fallback).toContain('애플리케이션 서버 2대 CPU 현황');
    expect(evidence?.fallback).toContain('api-was-dc1-01 82%');
    expect(evidence?.fallback).toContain('api-was-dc1-02 57%');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
  });
});
