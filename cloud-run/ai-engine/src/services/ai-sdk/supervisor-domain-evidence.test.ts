import { describe, expect, it, vi } from 'vitest';
import * as precomputedState from '../../data/precomputed-state';
import { monitoringDomainPack } from '../../domains/monitoring/domain-pack';
import { sampleDomainPack } from '../../test-fixtures/sample-domain-pack';
import type {
  AssistantDomain,
  DomainEvidenceProvider,
} from '../../core/assistant-runtime';
import type { SupervisorRequest } from './supervisor-types';
import {
  resolveDomainEvidenceForStream,
  resolveDomainEvidenceSupport,
} from './supervisor-domain-evidence';

const monitoringMetricPeakFrame = {
  domainId: monitoringDomainPack.id,
  intent: 'metric_peak',
  capabilityId: 'monitoring.metric_peak',
  scope: 'whole_fleet',
  targets: [],
  metric: 'load',
  timeWindow: '24h',
  aggregation: 'peak',
  topN: 3,
  ambiguity: 'low',
  confidence: 96,
} as const;

const unsupportedMetricCurrentFrame = {
  domainId: monitoringDomainPack.id,
  intent: 'metric_current',
  capabilityId: 'monitoring.metric_current',
  scope: 'whole_fleet',
  targets: [],
  metric: 'temperature',
  timeWindow: 'current',
  aggregation: 'summary',
  ambiguity: 'low',
  confidence: 0.92,
} as const;

function readCapabilities(domain: unknown) {
  return (domain as { capabilities?: unknown }).capabilities;
}

function createEvidenceRequest(message: string) {
  return {
    requestId: 'test',
    domainId: monitoringDomainPack.id,
    message,
    messages: [{ role: 'user' as const, content: message }],
    ...(monitoringDomainPack.dataSource && {
      dataSource: monitoringDomainPack.dataSource,
    }),
  };
}

describe('supervisor domain evidence support', () => {
  it('lets the monitoring domain decide which peak-load questions it handles', () => {
    const provider = monitoringDomainPack.evidenceProviders?.[0];

    expect(
      provider?.canHandle(
        createEvidenceRequest('지난 24시간 중 가장 부하가 높았던 시간대는 언제야?')
      )
    ).toBe(true);
    expect(
      provider?.canHandle(
        createEvidenceRequest(
          '24h 기준 load1 peak가 언제였고 어떤 서버가 가장 영향을 줬어?'
        )
      )
    ).toBe(true);
    expect(
      provider?.canHandle(
        createEvidenceRequest(
          '서버명은 일부러 안 줄게. 전체 기준으로 최근 하루 중 1분 load가 제일 튄 시각이 언제야? 근거 숫자도.'
        )
      )
    ).toBe(true);
    expect(
      provider?.canHandle(
        createEvidenceRequest(
          '최근 하루 동안 전체 서버가 제일 버거웠던 때가 언제야? CPU 말고 시스템 load 기준으로, 주범 서버까지.'
        )
      )
    ).toBe(true);
    expect(
      provider?.canHandle(createEvidenceRequest('부하가 높으면 조치 방법 알려줘'))
    ).toBe(false);
    expect(
      provider?.canHandle(
        createEvidenceRequest('최근 하루 load 높아서 힘들 때 조치 방법 알려줘')
      )
    ).toBe(false);
  });

  it('exposes monitoring peak metric as a domain capability instead of a provider name', () => {
    const capabilities = readCapabilities(monitoringDomainPack) as {
      domainId: string;
      capabilities: Array<{
        id: string;
        intents: string[];
        requiredSlots?: string[];
      }>;
    };

    expect(capabilities.domainId).toBe(monitoringDomainPack.id);
    expect(capabilities.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'monitoring.metric_peak',
          intents: ['metric_peak'],
          requiredSlots: ['metric', 'timeWindow', 'aggregation'],
        }),
        expect.objectContaining({
          id: 'monitoring.metric_ranking',
          intents: ['metric_ranking', 'metric_current'],
          requiredSlots: ['metric', 'aggregation'],
        }),
        expect.objectContaining({
          id: 'monitoring.server_health',
          intents: ['server_health'],
          requiredSlots: ['aggregation'],
        }),
      ])
    );
  });

  it('passes metadata intent frames into providers before raw message fallback', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'frame only request without load keywords',
      domain: monitoringDomainPack,
      sessionId: 'session-frame-peak',
      metadata: {
        intentFrame: monitoringMetricPeakFrame,
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support?.id).toBe('monitoring-peak-metric');
    expect(support?.metadata).toMatchObject({
      capabilityId: 'monitoring.metric_peak',
      intent: 'metric_peak',
      metric: 'load',
      windowHours: 24,
    });
  });

  it('passes stream request metadata frames into domain evidence resolution', async () => {
    const support = await resolveDomainEvidenceForStream({
      request: {
        messages: [
          { role: 'user', content: 'frame only request without load keywords' },
        ],
        sessionId: 'session-stream-frame-peak',
        metadata: {
          intentFrame: monitoringMetricPeakFrame,
        },
      } as SupervisorRequest,
      query: 'frame only request without load keywords',
      domain: monitoringDomainPack,
    });

    expect(support?.id).toBe('monitoring-peak-metric');
    expect(support?.metadata).toMatchObject({
      capabilityId: 'monitoring.metric_peak',
      intent: 'metric_peak',
    });
  });

  it('preserves stream conversation messages for contextual evidence providers', async () => {
    const contextualProvider: DomainEvidenceProvider = {
      id: 'sample-context-history-evidence',
      canHandle(request) {
        return request.messages.some(
          (message) =>
            message.role === 'assistant' &&
            message.content.includes('lb-haproxy-dc1-01')
        );
      },
      async resolve(request) {
        const previousAssistant = request.messages.find(
          (message) => message.role === 'assistant'
        );
        return {
          id: 'sample-context-history-evidence',
          prompt: 'Use preserved conversation context.',
          fallback: 'Preserved conversation context.',
          metadata: {
            messageCount: request.messages.length,
            previousAssistant: previousAssistant?.content,
          },
        };
      },
    };
    const contextualDomain: AssistantDomain = {
      ...sampleDomainPack,
      evidenceProviders: [contextualProvider],
    };

    const support = await resolveDomainEvidenceForStream({
      request: {
        messages: [
          { role: 'user', content: '현재 문제 있는 서버가 무엇인지 알려줘' },
          {
            role: 'assistant',
            content: '주의 관찰 대상: lb-haproxy-dc1-01 입니다.',
          },
          {
            role: 'user',
            content: '방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘',
          },
        ],
        sessionId: 'session-contextual-follow-up',
      } as SupervisorRequest,
      query: '방금 분석한 서버 중 네트워크 문제가 있는 것만 골라줘',
      domain: contextualDomain,
    });

    expect(support?.id).toBe('sample-context-history-evidence');
    expect(support?.metadata).toMatchObject({
      messageCount: 3,
      previousAssistant: '주의 관찰 대상: lb-haproxy-dc1-01 입니다.',
    });
  });

  it('lets providers handle capability intent frames without matching raw regex text', () => {
    const provider = monitoringDomainPack.evidenceProviders?.[0];
    const request = {
      ...createEvidenceRequest('frame only request without load keywords'),
      intentFrame: monitoringMetricPeakFrame,
      capability: {
        id: 'monitoring.metric_peak',
        description: 'Peak metric evidence',
        intents: ['metric_peak'],
        requiredSlots: ['metric', 'timeWindow', 'aggregation'],
      },
    };

    expect(provider?.canHandle(request)).toBe(true);
  });

  it('resolves exact domain evidence while leaving short analysis to the LLM', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '지난 24시간 중 가장 부하가 높았던 시간대는 언제야?',
      domain: monitoringDomainPack,
      sessionId: 'session-peak-metric',
      traceId: 'trace-peak-metric',
    });

    expect(support?.id).toBe('monitoring-peak-metric');
    expect(support?.prompt).toContain('[결정적 monitoring 피크 지표 근거]');
    expect(support?.prompt).toContain('첫 문장에 결론');
    expect(support?.prompt).toContain('1-2문장으로 운영 관점 해석');
    expect(support?.fallback).toContain('최고 시간대');
    expect(support?.fallback).toContain('상위 서버');
    expect(support?.fallback).toContain('운영 해석');
    expect(support?.metadata).toMatchObject({
      metric: 'load',
      windowHours: 24,
      semanticQueryTrace: {
        selectedDomain: monitoringDomainPack.id,
        selectedCapability: 'monitoring.metric_peak',
        selectedEvidenceProvider: 'monitoring-peak-metric',
        evidenceAvailable: true,
        reasonCodes: expect.arrayContaining([
          'semantic_frame_evidence_validated',
        ]),
      },
    });
  });

  it('resolves the 24h CPU load peak QA query as deterministic domain evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query:
        '지난 24시간 동안 전체 서버에서 CPU load가 가장 높았던 시간대는 언제야?',
      domain: monitoringDomainPack,
      sessionId: 'session-qa-24h-cpu-load-peak',
      traceId: 'trace-qa-24h-cpu-load-peak',
    });

    expect(support?.id).toBe('monitoring-peak-metric');
    expect(support?.fallback).toContain('지난 24시간 기준');
    expect(support?.fallback).toContain('상위 서버');
    expect(support?.fallback).toMatch(/\d{4}-\d{2}-\d{2}.*\d{2}:\d{2}/);
    expect(support?.fallback).not.toContain('CPU 사용률 상위 3대');
    expect(support?.metadata).toMatchObject({
      metric: 'load',
      sourceMetric: 'load1',
      windowHours: 24,
      responsePolicy: 'deterministic_answer',
      semanticQueryTrace: {
        selectedDomain: monitoringDomainPack.id,
        selectedCapability: 'monitoring.metric_peak',
        selectedEvidenceProvider: 'monitoring-peak-metric',
        evidenceAvailable: true,
      },
    });
  });

  it('resolves current metric ranking as deterministic domain evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '현재 CPU 사용률 상위 3대 알려줘',
      domain: monitoringDomainPack,
      sessionId: 'session-current-ranking',
      traceId: 'trace-current-ranking',
    });

    expect(support?.id).toBe('monitoring-metric-ranking');
    expect(support?.fallback).toContain('CPU 사용률 상위 3대');
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.metric_ranking',
      intent: 'metric_ranking',
      metric: 'cpu',
      semanticQueryTrace: {
        selectedDomain: monitoringDomainPack.id,
        selectedCapability: 'monitoring.metric_ranking',
        selectedEvidenceProvider: 'monitoring-metric-ranking',
        evidenceAvailable: true,
        reasonCodes: expect.arrayContaining([
          'semantic_frame_evidence_validated',
        ]),
      },
    });
  });

  it('resolves current server health as deterministic domain evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '현재 모든 서버 상태 요약해줘',
      domain: monitoringDomainPack,
      sessionId: 'session-server-health',
      traceId: 'trace-server-health',
    });

    expect(support?.id).toBe('monitoring-server-health');
    expect(support?.fallback).toContain('서버 현황 요약');
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.server_health',
      intent: 'server_health',
      semanticQueryTrace: {
        selectedDomain: monitoringDomainPack.id,
        selectedCapability: 'monitoring.server_health',
        selectedEvidenceProvider: 'monitoring-server-health',
        evidenceAvailable: true,
        reasonCodes: expect.arrayContaining([
          'semantic_frame_evidence_validated',
        ]),
      },
    });
  });

  it('resolves urgent action ranking prompts as deterministic server health evidence', async () => {
    const spy = vi.spyOn(precomputedState, 'getCurrentState').mockReturnValue({
      slotIndex: 0,
      timeLabel: '00:00 KST',
      minuteOfDay: 0,
      summary: {
        total: 1,
        online: 0,
        warning: 1,
        critical: 0,
        offline: 0,
      },
      alerts: [
        {
          serverId: 'web-nginx-dc1-01',
          metric: 'cpu',
          value: 85,
          level: 'warning',
          message: 'CPU usage is high',
          timestamp: '2026-05-22T00:00:00Z',
        },
      ],
      activePatterns: [],
      servers: [
        {
          id: 'web-nginx-dc1-01',
          name: 'web-nginx-dc1-01',
          type: 'web',
          status: 'warning',
          cpu: 85,
          memory: 45,
          disk: 28,
          network: 11,
        },
      ],
      serverLogs: {},
    });

    try {
      const support = await resolveDomainEvidenceSupport({
        query: '지금 당장 조치 시급한 서버 순위',
        domain: monitoringDomainPack,
        sessionId: 'session-urgent-action-ranking',
        traceId: 'trace-urgent-action-ranking',
      });

      expect(support?.id).toBe('monitoring-server-health');
      expect(support?.fallback).toContain('즉시 조치');
      expect(support?.fallback).toMatch(
        /(?:즉시 조치 대상은 \d+대입니다|즉시 조치 대상은 없습니다)/
      );
      expect(support?.fallback).toContain('우선순위');
      expect(support?.metadata).toMatchObject({
        responsePolicy: 'deterministic_answer',
        capabilityId: 'monitoring.server_health',
        intent: 'server_health',
      });
    } finally {
      spy.mockRestore();
    }
  });

  it('resolves availability-zone load balance as deterministic domain evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '가용 영역별 부하 균형을 비교해줘',
      domain: monitoringDomainPack,
      sessionId: 'session-az-load-balance',
      traceId: 'trace-az-load-balance',
    });

    expect(support?.id).toBe('monitoring-location-load-balance');
    expect(support?.fallback).toContain('AZ별 부하 균형');
    expect(support?.fallback).toContain('DC1-AZ1');
    expect(support?.fallback).toContain('DC1-AZ2');
    expect(support?.fallback).toContain('DC1-AZ3');
    expect(support?.fallback).toContain('전체 18대');
    expect(support?.fallback.trim().length).toBeGreaterThan(80);
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.location_load_balance',
      intent: 'location_load_balance',
    });
  });

  it('resolves data-center load comparison as deterministic domain evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'DC1과 DC2 어느 데이터센터 부하 높아',
      domain: monitoringDomainPack,
      sessionId: 'session-dc-load-balance',
      traceId: 'trace-dc-load-balance',
    });

    expect(support?.id).toBe('monitoring-location-load-balance');
    expect(support?.fallback).toContain('부하 균형');
    expect(support?.fallback).toContain(
      'DC2는 현재 snapshot에 포함되지 않았습니다'
    );
    expect(support?.fallback.trim().length).toBeGreaterThan(80);
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.location_load_balance',
      intent: 'location_load_balance',
    });
  });

  it('resolves metric threshold crossing capacity forecasts as deterministic domain evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '디스크 사용률 언제 90% 넘을까?',
      domain: monitoringDomainPack,
      sessionId: 'session-capacity-forecast',
      traceId: 'trace-capacity-forecast',
    });

    expect(support?.id).toBe('monitoring-capacity-forecast');
    expect(support?.fallback).toContain('디스크');
    expect(support?.fallback).toContain('90%');
    expect(support?.fallback).toContain('24h 선형 추세');
    expect(support?.fallback.trim().length).toBeGreaterThan(80);
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.capacity_forecast',
      intent: 'capacity_forecast',
      metric: 'disk',
      threshold: 90,
    });
  });

  it('resolves danger-level capacity forecast wording as deterministic domain evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'api-was-dc1-01 CPU 언제 위험 수준 도달해',
      domain: monitoringDomainPack,
      sessionId: 'session-capacity-danger-level',
      traceId: 'trace-capacity-danger-level',
    });

    expect(support?.id).toBe('monitoring-capacity-forecast');
    expect(support?.fallback).toContain('CPU 90% 도달 예측');
    expect(support?.fallback).toContain('api-was-dc1-01');
    expect(support?.fallback).not.toContain('지정 서버 1대 1대');
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.capacity_forecast',
      intent: 'capacity_forecast',
      metric: 'cpu',
      threshold: 90,
    });
  });

  it('keeps mixed current-value and threshold capacity forecasts on deterministic evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query:
        'db-mysql-dc1-backup 디스크가 현재 69%야. 이 추세라면 언제 90%를 넘을까? 용량 예측해줘',
      domain: monitoringDomainPack,
      sessionId: 'session-capacity-forecast-current-and-target',
      traceId: 'trace-capacity-forecast-current-and-target',
    });

    expect(support?.id).toBe('monitoring-capacity-forecast');
    expect(support?.fallback).toContain('디스크 90% 도달 예측');
    expect(support?.fallback).toContain('db-mysql-dc1-backup');
    expect(support?.fallback).toContain('대상: 지정 서버 1대');
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.capacity_forecast',
      intent: 'capacity_forecast',
      metric: 'disk',
      threshold: 90,
    });
  });

  it('resolves English capacity forecast wording with metric typos as deterministic evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'cache-redis-dc1-01 memori when will it exceed 90%',
      domain: monitoringDomainPack,
      sessionId: 'session-capacity-forecast-english-typo',
      traceId: 'trace-capacity-forecast-english-typo',
    });

    expect(support?.id).toBe('monitoring-capacity-forecast');
    expect(support?.fallback).toContain('메모리 90% 도달 예측');
    expect(support?.fallback).toContain('cache-redis-dc1-01');
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.capacity_forecast',
      intent: 'capacity_forecast',
      metric: 'memory',
      threshold: 90,
    });
  });

  it('does not let KRL/SSOT wording collapse into current server health evidence', async () => {
    const support = await resolveDomainEvidenceSupport({
      query:
        'OpenManager OTel 데이터 SSOT와 18대 서버 상태 판단 기준을 KRL 근거로 요약해줘.',
      domain: monitoringDomainPack,
      sessionId: 'session-krl-ssot-boundary',
      traceId: 'trace-krl-ssot-boundary',
    });

    expect(support?.id).not.toBe('monitoring-server-health');
    expect(support).toBeNull();
  });

  it('keeps natural load phrasing on the load peak evidence path instead of generic CPU metrics', async () => {
    const queries = [
      '서버명은 일부러 안 줄게. 전체 기준으로 최근 하루 중 1분 load가 제일 튄 시각이 언제야? 근거 숫자도.',
      '최근 하루 동안 전체 서버가 제일 버거웠던 때가 언제야? CPU 말고 시스템 load 기준으로, 주범 서버까지.',
      '전체 서버 기준 지난 하루 중 load average가 가장 높았던 시간은?',
      '전체 서버가 최근 24시간 중 제일 힘들었던 순간은? CPU 빼고 로드 기준',
      '최근 24시간 load가 가장 높았던 구간',
      '최근 하루 부하 최고점 top server',
      '최근 하루 load 피크 시간과 대응 방법 알려줘',
    ];

    for (const query of queries) {
      const support = await resolveDomainEvidenceSupport({
        query,
        domain: monitoringDomainPack,
        sessionId: 'fragile-load-phrasing',
      });

      expect(support?.id).toBe('monitoring-peak-metric');
      expect(support?.prompt).toContain('1분 평균 로드(load1)');
      expect(support?.prompt).not.toContain('CPU 사용률');
      expect(support?.metadata).toMatchObject({
        metric: 'load',
        sourceMetric: 'load1',
        windowHours: 24,
      });
    }
  });

  it.each([
    {
      persona: 'server monitoring expert',
      query:
        '모니터링 전문가처럼 최근 하루 시스템 load 병목이 발생한 구간과 영향 서버를 짚어줘',
    },
    {
      persona: 'ai quality expert',
      query:
        'AI 품질 검증용으로 last 24h node_load1 outlier timestamp and top server evidence를 알려줘',
    },
    {
      persona: 'qc qa tester',
      query:
        'QC/QA 관점에서 AI가 실제 서버 모니터링 데이터를 쓰는지 확인하려고 해. 최근 24시간 load1 이상치 구간과 상위 서버 근거를 보여줘',
    },
    {
      persona: 'security vulnerability investigator',
      query:
        '보안 취약점 탐색 관점에서 비정상 부하 징후를 보려 한다. 지난 하루 load anomaly 구간과 어느 서버가 영향이 컸는지 읽기 전용 근거만 알려줘',
    },
    {
      persona: 'error-hunting user',
      query:
        '오류 잡으려고 묻는다. 최근 24시간 전체 서버 부하 이상치 구간과 범인 서버는?',
    },
    {
      persona: 'exploratory operator',
      query:
        '장애 재현 관점에서 지난 하루 load saturation 구간과 어느 서버가 영향이 컸는지, 대응 체크만 알려줘',
    },
  ])(
    'routes $persona natural language peak questions to monitoring evidence',
    async ({ query }) => {
      const support = await resolveDomainEvidenceSupport({
        query,
        domain: monitoringDomainPack,
        sessionId: 'expert-natural-language-peak',
      });

      expect(support?.id).toBe('monitoring-peak-metric');
      expect(support?.prompt).toContain('[결정적 monitoring 피크 지표 근거]');
      expect(support?.prompt).toContain('읽기 전용 확인 항목');
      expect(support?.metadata).toMatchObject({
        metric: 'load',
        sourceMetric: 'load1',
        windowHours: 24,
        semanticQueryTrace: {
          selectedDomain: monitoringDomainPack.id,
          selectedCapability: 'monitoring.metric_peak',
          selectedEvidenceProvider: 'monitoring-peak-metric',
          evidenceAvailable: true,
          reasonCodes: expect.arrayContaining([
            'semantic_frame_evidence_validated',
          ]),
        },
      });
    }
  );

  it('keeps raw-only, frame-only, and frame-plus-raw peak evidence in parity', async () => {
    const rawQuery = '지난 24시간 중 가장 부하가 높았던 시간대는 언제야?';
    const rawOnly = await resolveDomainEvidenceSupport({
      query: rawQuery,
      domain: monitoringDomainPack,
      sessionId: 'raw-only',
    });
    const frameOnly = await resolveDomainEvidenceSupport({
      query: 'frame only request without load keywords',
      domain: monitoringDomainPack,
      sessionId: 'frame-only',
      metadata: {
        intentFrame: monitoringMetricPeakFrame,
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });
    const framePlusRaw = await resolveDomainEvidenceSupport({
      query: rawQuery,
      domain: monitoringDomainPack,
      sessionId: 'frame-plus-raw',
      metadata: {
        intentFrame: monitoringMetricPeakFrame,
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(frameOnly?.metadata).toMatchObject({
      slotIndex: rawOnly?.metadata?.slotIndex,
      timestamp: rawOnly?.metadata?.timestamp,
      sourceMetric: rawOnly?.metadata?.sourceMetric,
      windowHours: rawOnly?.metadata?.windowHours,
    });
    expect(framePlusRaw?.metadata).toMatchObject({
      slotIndex: rawOnly?.metadata?.slotIndex,
      timestamp: rawOnly?.metadata?.timestamp,
      sourceMetric: rawOnly?.metadata?.sourceMetric,
      windowHours: rawOnly?.metadata?.windowHours,
    });
  });

  it('records semantic query trace metadata when deterministic evidence is validated', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'frame only request without load keywords',
      domain: monitoringDomainPack,
      sessionId: 'semantic-trace',
      metadata: {
        intentFrame: monitoringMetricPeakFrame,
        semanticQueryTrace: {
          originalQuery: '최근 24시간 load1 피크 알려줘',
          reasonCodes: [],
        },
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support?.metadata).toMatchObject({
      semanticQueryTrace: {
        originalQuery: '최근 24시간 load1 피크 알려줘',
        selectedDomain: monitoringDomainPack.id,
        selectedCapability: 'monitoring.metric_peak',
        selectedEvidenceProvider: 'monitoring-peak-metric',
        evidenceAvailable: true,
        reasonCodes: expect.arrayContaining([
          'semantic_frame_evidence_validated',
        ]),
      },
    });
  });

  it('fail-closes high-confidence evidence-required monitoring frames when no provider can ground the metric', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '전체 서버 temperature 현재값 순위 알려줘',
      domain: monitoringDomainPack,
      sessionId: 'semantic-fail-closed',
      metadata: {
        intentFrame: unsupportedMetricCurrentFrame,
        semanticQueryTrace: {
          originalQuery: '전체 서버 temperature 현재값 순위 알려줘',
          reasonCodes: [],
        },
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support?.id).toBe('monitoring-evidence-unavailable');
    expect(support?.fallback).toContain('모니터링 근거를 찾지 못했습니다');
    expect(support?.fallback).toContain('임의 수치');
    expect(support?.metadata).toMatchObject({
      responsePolicy: 'deterministic_fail_closed',
      capabilityId: 'monitoring.metric_current',
      intent: 'metric_current',
      semanticQueryTrace: {
        originalQuery: '전체 서버 temperature 현재값 순위 알려줘',
        selectedDomain: monitoringDomainPack.id,
        selectedCapability: 'monitoring.metric_current',
        selectedEvidenceProvider: 'monitoring-evidence-unavailable',
        evidenceAvailable: false,
        clarificationRequired: true,
        reasonCodes: expect.arrayContaining([
          'semantic_frame_provider_miss',
          'semantic_frame_fail_closed',
        ]),
      },
    });
  });

  it('keeps low-confidence monitoring evidence misses on the normal fallback path', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '전체 서버 temperature 현재값 순위 알려줘',
      domain: monitoringDomainPack,
      sessionId: 'semantic-low-confidence-miss',
      metadata: {
        intentFrame: {
          ...unsupportedMetricCurrentFrame,
          confidence: 0.42,
        },
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support).toBeNull();
  });

  it('does not fail-close non-evidence-required monitoring capabilities', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: '전체 장애 위험 예측해줘',
      domain: monitoringDomainPack,
      sessionId: 'semantic-analyst-capability-miss',
      metadata: {
        intentFrame: {
          domainId: monitoringDomainPack.id,
          intent: 'anomaly_detection',
          capabilityId: 'monitoring.anomaly_detection',
          scope: 'whole_fleet',
          targets: [],
          ambiguity: 'low',
          confidence: 0.95,
        },
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support).toBeNull();
  });

  it('uses the same runtime hook for a non-monitoring sample domain', async () => {
    const support = await resolveDomainEvidenceSupport({
      query: 'Which account has the highest renewal risk?',
      domain: sampleDomainPack,
      sessionId: 'sample-session',
    });

    expect(support?.id).toBe('sample-renewal-risk-evidence');
    expect(support?.prompt).toContain(
      '[Deterministic sample renewal-risk evidence]'
    );
    expect(support?.fallback).toContain('acct-123');
    expect(support?.metadata).toMatchObject({
      accountId: 'acct-123',
      risk: 'high',
      source: 'sample-fixture',
      semanticQueryTrace: {
        selectedDomain: sampleDomainPack.id,
        selectedEvidenceProvider: 'sample-renewal-risk-evidence',
        evidenceAvailable: true,
        reasonCodes: expect.arrayContaining([
          'semantic_frame_evidence_validated',
        ]),
      },
    });
  });

  it('uses the same capability frame contract for a non-monitoring sample domain', async () => {
    expect(readCapabilities(sampleDomainPack)).toMatchObject({
      domainId: sampleDomainPack.id,
      capabilities: [
        expect.objectContaining({
          id: 'sample.renewal_risk',
          intents: ['renewal_risk'],
        }),
      ],
    });

    const support = await resolveDomainEvidenceSupport({
      query: 'frame only sample request',
      domain: sampleDomainPack,
      sessionId: 'sample-frame-session',
      metadata: {
        intentFrame: {
          domainId: sampleDomainPack.id,
          intent: 'renewal_risk',
          capabilityId: 'sample.renewal_risk',
          scope: 'entity',
          targets: ['acct-123'],
          aggregation: 'max',
          ambiguity: 'low',
          confidence: 93,
        },
      },
    } as Parameters<typeof resolveDomainEvidenceSupport>[0] & {
      metadata: Record<string, unknown>;
    });

    expect(support?.id).toBe('sample-renewal-risk-evidence');
    expect(support?.metadata).toMatchObject({
      capabilityId: 'sample.renewal_risk',
      accountId: 'acct-123',
      risk: 'high',
    });
  });
});
