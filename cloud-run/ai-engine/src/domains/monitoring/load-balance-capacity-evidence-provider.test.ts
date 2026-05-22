import { describe, expect, it } from 'vitest';
import type {
  DomainEvidenceRequest,
  DomainSnapshot,
} from '../../core/assistant-runtime';
import { MONITORING_DOMAIN_ID } from './constants';
import { monitoringCapacityForecastEvidenceProvider } from './load-balance-capacity-evidence-provider';

const snapshot: DomainSnapshot = {
  timestamp: '2026-05-22T14:20:00+09:00',
  data: {
    timeLabel: '14:20',
    servers: [
      {
        id: 'capacity-test-01',
        name: 'capacity-test-01',
        type: 'db',
        status: 'warning',
        cpu: 18,
        memory: 42,
        disk: 69,
        network: 8,
      },
    ],
  },
};

function createRequest(message: string): DomainEvidenceRequest {
  return {
    requestId: 'capacity-forecast-test',
    domainId: MONITORING_DOMAIN_ID,
    message,
    messages: [{ role: 'user', content: message }],
    dataSource: {
      snapshot: async () => snapshot,
      history: async () => [],
    },
  };
}

describe('monitoring capacity forecast evidence provider', () => {
  it('matches Korean capacity forecast and threshold crossing phrases', () => {
    const queries = [
      '디스크는 언제 90%를 넘을까?',
      'db-mysql-dc1-backup 용량 예측해줘',
      '임계치 도달 시점 알려줘',
    ];

    for (const query of queries) {
      expect(
        monitoringCapacityForecastEvidenceProvider.canHandle(
          createRequest(query)
        )
      ).toBe(true);
    }
  });

  it('uses the requested future threshold instead of the current metric value', async () => {
    const result = await monitoringCapacityForecastEvidenceProvider.resolve(
      createRequest(
        'capacity-test-01 디스크가 현재 69%야. 이 추세라면 언제 90%를 넘을까? 용량 예측해줘'
      )
    );

    expect(result?.id).toBe('monitoring-capacity-forecast');
    expect(result?.metadata).toMatchObject({
      metric: 'disk',
      threshold: 90,
      responsePolicy: 'deterministic_answer',
    });
    expect(result?.fallback).toContain('디스크 90% 도달 예측');
    expect(result?.fallback).toContain('대상: 지정 서버 1대');
    expect(result?.fallback).toContain(
      '현재 24h 선형 추세로는 90% 초과 예상 서버가 없습니다.'
    );
    expect(result?.fallback).toContain('현 추세 도달 없음');
  });

  it('defaults to the standard threshold when the only percentage is a current value', async () => {
    const result = await monitoringCapacityForecastEvidenceProvider.resolve(
      createRequest(
        'capacity-test-01 현재 서버의 CPU 사용률이 45%인데 포화될까요? 용량 예측해줘'
      )
    );

    expect(result?.metadata).toMatchObject({
      metric: 'cpu',
      threshold: 90,
      responsePolicy: 'deterministic_answer',
    });
    expect(result?.fallback).toContain('CPU 90% 도달 예측');
    expect(result?.fallback).not.toContain('CPU 45% 도달 예측');
  });

  it('does not treat a past threshold crossing report as the forecast threshold', async () => {
    const result = await monitoringCapacityForecastEvidenceProvider.resolve(
      createRequest(
        'capacity-test-01 어제 CPU가 80%를 초과했는데 앞으로는 포화될까요? 용량 예측해줘'
      )
    );

    expect(result?.metadata).toMatchObject({
      metric: 'cpu',
      threshold: 90,
      responsePolicy: 'deterministic_answer',
    });
    expect(result?.fallback).toContain('CPU 90% 도달 예측');
    expect(result?.fallback).not.toContain('CPU 80% 도달 예측');
  });
});
