import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  monitoringServerHealthEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: server health list evidence', () => {
  it('routes clear group-only server list prompts to deterministic server health evidence', async () => {
    const request = createEvidenceRequest('WAS 서버들', {
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
    });

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'group-server-list',
      targets: ['application'],
    });

    const evidence = await monitoringServerHealthEvidenceProvider.resolve(request);

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
        sourceIntent: 'group-server-list',
        targets: ['application'],
      },
    });
    expect(evidence?.fallback).toContain('애플리케이션 서버 현황');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).toContain('api-was-dc1-02');
    expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');

    const serverHealthFrameRequest = {
      ...request,
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'group',
        targets: [],
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.92,
      },
    };

    expect(
      parseCurrentMetricsEvidenceRequest(serverHealthFrameRequest)
    ).toMatchObject({
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'group-server-list',
      targets: ['application'],
    });
    await expect(
      monitoringServerHealthEvidenceProvider.resolve(serverHealthFrameRequest)
    ).resolves.toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        sourceIntent: 'group-server-list',
        targets: ['application'],
      },
    });
  });

  it('keeps group health summary prompts on the group-server-list evidence path', () => {
    expect(
      parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('애플리케이션 서버 현황 알려줘')
      )
    ).toMatchObject({
      intent: 'server_health',
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      sourceIntent: 'group-server-list',
      targets: ['application'],
    });
  });

  it('does not treat bare server wording in metric filters as a group list', () => {
    expect(
      parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('메모리 70% 이상인 서버는?')
      )
    ).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'data-filter',
      metric: 'memory',
      threshold: 70,
    });
  });
});
