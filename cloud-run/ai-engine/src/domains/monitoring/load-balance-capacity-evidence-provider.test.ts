import { describe, expect, it } from 'vitest';
import type {
  DomainEvidenceRequest,
  DomainSnapshot,
} from '../../core/assistant-runtime';
import { MONITORING_DOMAIN_ID } from './constants';
import {
  monitoringCapacityForecastEvidenceProvider,
  monitoringLocationLoadBalanceEvidenceProvider,
} from './load-balance-capacity-evidence-provider';

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

const locationSnapshot: DomainSnapshot = {
  timestamp: '2026-05-22T14:20:00+09:00',
  data: {
    timeLabel: '14:20',
    servers: [
      {
        id: 'web-dc1-01',
        name: 'web-dc1-01',
        type: 'web',
        status: 'online',
        cpu: 36,
        memory: 52,
        disk: 34,
        network: 11,
        location: 'DC1',
      },
      {
        id: 'api-dc2-01',
        name: 'api-dc2-01',
        type: 'application',
        status: 'warning',
        cpu: 61,
        memory: 68,
        disk: 41,
        network: 18,
        location: 'DC2',
      },
    ],
  },
};

const singleDataCenterSnapshot: DomainSnapshot = {
  timestamp: '2026-05-22T14:20:00+09:00',
  data: {
    timeLabel: '14:20',
    servers: [
      {
        id: 'web-dc1-01',
        name: 'web-dc1-01',
        type: 'web',
        status: 'online',
        cpu: 36,
        memory: 52,
        disk: 34,
        network: 11,
        location: 'DC1-AZ1',
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

function createLocationRequest(message: string): DomainEvidenceRequest {
  return {
    requestId: 'location-load-balance-test',
    domainId: MONITORING_DOMAIN_ID,
    message,
    messages: [{ role: 'user', content: message }],
    dataSource: {
      snapshot: async () => locationSnapshot,
      history: async () => [],
    },
  };
}

function createSingleDataCenterRequest(
  message: string
): DomainEvidenceRequest {
  return {
    requestId: 'single-dc-load-balance-test',
    domainId: MONITORING_DOMAIN_ID,
    message,
    messages: [{ role: 'user', content: message }],
    dataSource: {
      snapshot: async () => singleDataCenterSnapshot,
      history: async () => [],
    },
  };
}

describe('monitoring location load balance evidence provider', () => {
  it('matches data-center load comparison phrasing', async () => {
    const request = createLocationRequest(
      'DC1과 DC2 어느 데이터센터 부하 높아?'
    );

    expect(
      monitoringLocationLoadBalanceEvidenceProvider.canHandle(request)
    ).toBe(true);

    const result = await monitoringLocationLoadBalanceEvidenceProvider.resolve(
      request
    );

    expect(result?.id).toBe('monitoring-location-load-balance');
    expect(result?.fallback).toContain('부하 균형');
    expect(result?.fallback).toContain('DC1');
    expect(result?.fallback).toContain('DC2');
    expect(result?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: 'monitoring.location_load_balance',
      intent: 'location_load_balance',
    });
  });

  it('does not fire for a server-name containing dc\\d+ with advisor keywords', () => {
    const advisorQueries = [
      'db-mysql-dc1-primary 서버 디스크 사용량이 높은데 성능 개선 조언 해줘',
      'web-dc2-proxy CPU 높은데 튜닝 방법 알려줘',
      'cache-dc1-primary 메모리 많이 쓰는데 해결 방법',
    ];
    for (const message of advisorQueries) {
      expect(
        monitoringLocationLoadBalanceEvidenceProvider.canHandle(
          createLocationRequest(message)
        ),
        `should not match: "${message}"`
      ).toBe(false);
    }
  });

  it('names requested data centers that are absent from the current snapshot', async () => {
    const result = await monitoringLocationLoadBalanceEvidenceProvider.resolve(
      createSingleDataCenterRequest('DC1과 DC2 어느 데이터센터 부하 높아?')
    );

    expect(result?.id).toBe('monitoring-location-load-balance');
    expect(result?.fallback).toContain('DC1 1대');
    expect(result?.fallback).toContain(
      'DC2는 현재 snapshot에 포함되지 않았습니다'
    );
  });
});

describe('monitoring capacity forecast evidence provider', () => {
  it('matches Korean capacity forecast and threshold crossing phrases', () => {
    const queries = [
      '디스크는 언제 90%를 넘을까?',
      'db-mysql-dc1-backup 용량 예측해줘',
      '임계치 도달 시점 알려줘',
      'cache-redis-dc1-01 메모리가 100%에 도달하는 시점 예측해줘',
      'cache-redis-dc1-01 메모리 포화 예측해줘',
      'api-was-dc1-01 CPU 언제 위험 수준 도달해',
      'capacity-test-01 memori when will it exceed 90%',
      '48시간 이내에 디스크 꽉 찰 서버 있어?',
      '2일 안에 storage disk 가득 찰까?',
    ];

    for (const query of queries) {
      expect(
        monitoringCapacityForecastEvidenceProvider.canHandle(
          createRequest(query)
        )
      ).toBe(true);
    }
  });

  it('does not claim current near-full wording without a forecast time window', () => {
    expect(
      monitoringCapacityForecastEvidenceProvider.canHandle(
        createRequest('디스크가 거의 꽉 찬 서버 있어?')
      )
    ).toBe(false);

    expect(
      monitoringCapacityForecastEvidenceProvider.canHandle(
        createRequest('48시간 이내에 디스크 꽉 찰 서버 있어?')
      )
    ).toBe(true);
  });

  it('resolves English threshold wording and memory typos to deterministic evidence', async () => {
    const result = await monitoringCapacityForecastEvidenceProvider.resolve(
      createRequest('capacity-test-01 memori when will it exceed 90%')
    );

    expect(result?.id).toBe('monitoring-capacity-forecast');
    expect(result?.metadata).toMatchObject({
      metric: 'memory',
      threshold: 90,
      responsePolicy: 'deterministic_answer',
    });
    expect(result?.fallback).toContain('메모리 90% 도달 예측');
    expect(result?.fallback).toContain('대상: 지정 서버 1대');
  });

  it('resolves danger-level wording to the default forecast threshold', async () => {
    const result = await monitoringCapacityForecastEvidenceProvider.resolve(
      createRequest('capacity-test-01 CPU 언제 위험 수준 도달해')
    );

    expect(result?.id).toBe('monitoring-capacity-forecast');
    expect(result?.metadata).toMatchObject({
      metric: 'cpu',
      threshold: 90,
      responsePolicy: 'deterministic_answer',
    });
    expect(result?.fallback).toContain('CPU 90% 도달 예측');
    expect(result?.fallback).toContain('대상: 지정 서버 1대');
    expect(result?.fallback).not.toContain('지정 서버 1대 1대');
  });

  it('resolves n-hour disk-full wording to deterministic evidence', async () => {
    const result = await monitoringCapacityForecastEvidenceProvider.resolve(
      createRequest('capacity-test-01 48시간 이내에 디스크 꽉 찰까?')
    );

    expect(result?.id).toBe('monitoring-capacity-forecast');
    expect(result?.metadata).toMatchObject({
      metric: 'disk',
      threshold: 90,
      responsePolicy: 'deterministic_answer',
    });
    expect(result?.fallback).toContain('디스크 90% 도달 예측');
    expect(result?.fallback).toContain('대상: 지정 서버 1대');
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
