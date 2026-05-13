/**
 * Analytics Report Utils Tests
 *
 * extractToolBasedData, parseAgentJsonResponse 순수 함수 테스트.
 */

import { describe, expect, it, vi } from 'vitest';

// randomUUID를 고정값으로 mock
vi.mock('crypto', () => ({
  randomUUID: () => 'test-uuid-1234',
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  extractToolBasedData,
  IncidentReportOutputSchema,
  parseAgentJsonResponse,
} from './analytics-report-utils';

describe('IncidentReportOutputSchema', () => {
  const strictStructuredOutput = {
    title: 'Redis 메모리 경고',
    severity: 'warning',
    description: 'cache-redis-dc1-01 메모리 사용률이 84%입니다.',
    affected_servers: ['cache-redis-dc1-01'],
    affectedServers: [
      {
        id: 'cache-redis-dc1-01',
        name: 'cache-redis-dc1-01',
        severity: 'warning',
        metric: null,
        value: null,
      },
    ],
    root_cause: '메모리 사용량 상승',
    recommendations: [
      {
        action: '상위 메모리 프로세스 확인',
        priority: 'high',
        expected_impact: 'OOM 위험 감소',
      },
    ],
    pattern: 'memory threshold warning',
    postmortem: {
      timeline: [],
      hypotheses: ['캐시 키 증가 또는 eviction 지연 가능성'],
      prevention: ['메모리 알림 임계값과 eviction 정책을 재검토합니다.'],
    },
  };

  it('OpenAI-compatible structured output에서 nested 필드를 명시적으로 요구한다', () => {
    expect(
      IncidentReportOutputSchema.safeParse(strictStructuredOutput).success
    ).toBe(true);

    expect(
      IncidentReportOutputSchema.safeParse({
        ...strictStructuredOutput,
        postmortem: { timeline: [] },
      }).success
    ).toBe(false);

    expect(
      IncidentReportOutputSchema.safeParse({
        ...strictStructuredOutput,
        affectedServers: [
          {
            id: 'cache-redis-dc1-01',
            name: 'cache-redis-dc1-01',
            severity: 'warning',
          },
        ],
      }).success
    ).toBe(false);
  });
});

describe('extractToolBasedData', () => {
  it('이상 징후가 없을 때 정상 상태를 반환한다', () => {
    const result = extractToolBasedData(
      { success: true, totalServers: 5, anomalies: [], hasAnomalies: false, anomalyCount: 0 },
      null,
      null,
    );

    expect(result.id).toBe('test-uuid-1234');
    expect(result.title).toBe('서버 상태 정상');
    expect(result.severity).toBe('info');
    expect(result.anomalies).toEqual([]);
    expect(result.pattern).toBe('정상 패턴');
  });

  it('이상 징후가 있을 때 감지 결과를 반환한다', () => {
    const anomalyData = {
      success: true,
      totalServers: 10,
      anomalies: [
        { server_id: 'web-01', server_name: 'web-server-01', metric: 'cpu', value: 95, severity: 'critical' },
      ],
      hasAnomalies: true,
      anomalyCount: 1,
      affectedServers: ['web-01'],
      summary: { totalServers: 10, onlineCount: 9, warningCount: 0, criticalCount: 1 },
    };

    const result = extractToolBasedData(anomalyData, null, null);

    expect(result.title).toBe('이상 감지: 1건 발견');
    expect(result.severity).toBe('critical');
    expect(result.anomalies).toHaveLength(1);
    expect(result.affected_servers).toEqual(['web-01']);
    expect(result.system_summary.critical_servers).toBe(1);
    expect(result.pattern).toBe('이상 패턴 감지됨');
  });

  it('warning 심각도를 올바르게 분류한다', () => {
    const anomalyData = {
      anomalies: [
        { server_id: 'db-01', server_name: 'db-server-01', metric: 'memory', value: 80, severity: 'warning' },
      ],
      hasAnomalies: true,
      anomalyCount: 1,
      summary: { totalServers: 5, onlineCount: 4, warningCount: 1, criticalCount: 0 },
    };

    const result = extractToolBasedData(anomalyData, null, null);

    expect(result.severity).toBe('warning');
  });

  it('트렌드 데이터에서 권장사항을 생성한다', () => {
    const trendData = {
      summary: {
        hasRisingTrends: true,
        risingMetrics: ['cpu_usage', 'memory_usage', 'disk_io', 'network_in'],
      },
    };

    const result = extractToolBasedData(null, trendData, null);

    expect(result.recommendations).toHaveLength(3); // 최대 3개
    expect(result.recommendations[0].action).toContain('cpu_usage');
    expect(result.recommendations[0].priority).toBe('medium');
  });

  it('타임라인 이벤트를 올바르게 매핑한다', () => {
    const timelineData = {
      events: [
        { timestamp: '2026-03-03T00:00:00Z', description: 'CPU spike', severity: 'warning' },
        { timestamp: '2026-03-03T00:05:00Z', description: 'Recovery', severity: 'info' },
      ],
    };

    const result = extractToolBasedData(null, null, timelineData);

    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[0].event).toBe('CPU spike');
    expect(result.timeline[1].event).toBe('Recovery');
    expect(result.postmortem.timeline).toEqual([
      '00:00 - CPU spike',
      '00:05 - Recovery',
    ]);
  });

  it('serverId가 제공되면 affected_servers에 포함된다', () => {
    const result = extractToolBasedData(
      { anomalies: [], hasAnomalies: false },
      null,
      null,
      'web-server-01',
    );

    expect(result.affected_servers).toEqual(['web-server-01']);
  });

  it('anomalyData가 undefined일 때 빈 결과를 반환한다', () => {
    const result = extractToolBasedData(undefined, undefined, undefined);

    expect(result.anomalies).toEqual([]);
    expect(result.system_summary.total_servers).toBe(0);
    expect(result.severity).toBe('info');
  });

  it('medium 심각도 이상 징후를 warning으로 분류한다', () => {
    const anomalyData = {
      anomalies: [
        { server_id: 'app-01', server_name: 'app-server', metric: 'cpu', value: 75, severity: 'medium' },
      ],
      hasAnomalies: true,
      anomalyCount: 1,
    };

    const result = extractToolBasedData(anomalyData, null, null);

    expect(result.severity).toBe('warning');
  });

  it('동일 시간대 이상 서버를 related server summary로 구성한다', () => {
    const anomalyData = {
      anomalies: [
        {
          server_id: 'web-01',
          server_name: 'web-server-01',
          metric: 'cpu',
          value: 95,
          severity: 'critical',
        },
        {
          server_id: 'db-01',
          server_name: 'db-server-01',
          metric: 'memory',
          value: 87,
          severity: 'warning',
        },
      ],
      affectedServers: ['web-01', 'db-01'],
      hasAnomalies: true,
      anomalyCount: 2,
      summary: { totalServers: 10, onlineCount: 8, warningCount: 1, criticalCount: 1 },
    };

    const result = extractToolBasedData(anomalyData, null, null);

    expect(result.affectedServers).toEqual([
      {
        id: 'web-01',
        name: 'web-server-01',
        severity: 'critical',
        metric: 'cpu',
        value: 95,
      },
      {
        id: 'db-01',
        name: 'db-server-01',
        severity: 'warning',
        metric: 'memory',
        value: 87,
      },
    ]);
  });
});

describe('parseAgentJsonResponse', () => {
  const fallback = {
    title: '기본 제목',
    severity: 'info',
    affected_servers: ['server-01'],
    affectedServers: [
      {
        id: 'server-01',
        name: 'server-01',
        severity: 'info',
      },
    ],
    recommendations: [{ action: '모니터링', priority: 'low', expected_impact: '없음' }],
    pattern: '기본 패턴',
    postmortem: {
      timeline: [],
      hypotheses: ['추가 분석 필요'],
      prevention: ['모니터링을 유지합니다.'],
    },
  };

  it('유효한 JSON을 파싱한다', () => {
    const text = '```json\n{"title":"CPU 과부하","severity":"critical","description":"설명","affected_servers":["web-01"],"affectedServers":[{"id":"db-01","name":"db-primary","severity":"warning","metric":"memory","value":82}],"root_cause":"과부하","recommendations":[{"action":"스케일업","priority":"high","expected_impact":"해소"}],"pattern":"스파이크","postmortem":{"timeline":["10:00 - CPU spike"],"hypotheses":["트래픽 급증"],"prevention":["오토스케일 정책 점검"]}}\n```';

    const result = parseAgentJsonResponse(text, fallback);

    expect(result.title).toBe('CPU 과부하');
    expect(result.severity).toBe('critical');
    expect(result.root_cause).toBe('과부하');
    expect(result.recommendations[0].action).toBe('스케일업');
    expect(result.affectedServers).toEqual([
      {
        id: 'db-01',
        name: 'db-primary',
        severity: 'warning',
        metric: 'memory',
        value: 82,
      },
    ]);
    expect(result.postmortem.timeline).toEqual(['10:00 - CPU spike']);
  });

  it('코드블록 없는 JSON도 파싱한다', () => {
    const text = '{"title":"메모리 부족","severity":"warning","description":"80% 초과","affected_servers":[],"root_cause":"메모리 누수","recommendations":[],"pattern":"점진 증가"}';

    const result = parseAgentJsonResponse(text, fallback);

    expect(result.title).toBe('메모리 부족');
    expect(result.severity).toBe('warning');
  });

  it('JSON 파싱 실패 시 fallback을 사용한다', () => {
    const text = '이것은 JSON이 아닙니다.';

    const result = parseAgentJsonResponse(text, fallback);

    expect(result.title).toBe(fallback.title);
    expect(result.severity).toBe(fallback.severity);
    expect(result.root_cause).toBe('');
  });

  it('부분적 JSON에서 누락 필드를 fallback으로 채운다', () => {
    const text = '{"title":"부분 보고서"}';

    const result = parseAgentJsonResponse(text, fallback);

    expect(result.title).toBe('부분 보고서');
    expect(result.severity).toBe(fallback.severity);
    expect(result.affected_servers).toEqual(fallback.affected_servers);
  });

  it('잘못된 JSON 구문 시 fallback을 반환한다', () => {
    const text = '```json\n{invalid json}\n```';

    const result = parseAgentJsonResponse(text, fallback);

    expect(result.title).toBe(fallback.title);
  });
});
