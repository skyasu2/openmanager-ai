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
  getReporterDegradationReasonCode,
  IncidentReportOutputSchema,
  mergeIncidentRecommendations,
  normalizeAgentIncidentReportOutput,
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

  it('structured output 스키마는 provider 호환성을 위해 timeline string[]만 허용한다', () => {
    expect(
      IncidentReportOutputSchema.safeParse({
        ...strictStructuredOutput,
        postmortem: {
          ...strictStructuredOutput.postmortem,
          timeline: [
            {
              timestamp: '2026-05-18T01:50:00.000Z',
              event: 'CPU 96% threshold breach',
              severity: 'critical',
            },
          ],
        },
      }).success
    ).toBe(false);
  });
});

describe('reporter degradation metadata helpers', () => {
  it.each([
    ['reporter_unavailable', 'reporter_unavailable'],
    ['expected schema mismatch from jsonschema', 'provider_schema_drift'],
    ['No object generated: could not parse the response.', 'provider_parse_drift'],
    ['429 rate limit exceeded', 'provider_rate_limit'],
    ['request timed out before deadline', 'provider_timeout'],
    ['503 service unavailable', 'provider_unavailable'],
    ['unexpected provider failure', 'reporter_degraded'],
  ])('%s -> %s', (reason, expected) => {
    expect(getReporterDegradationReasonCode(reason)).toBe(expected);
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

  it('CPU와 network 이상 항목에서 실행 가능한 진단 조치를 생성한다', () => {
    const anomalyData = {
      anomalies: [
        {
          server_id: 'lb-haproxy-dc1-01',
          server_name: 'lb-haproxy-dc1-01',
          metric: 'Cpu',
          value: 85,
          severity: 'warning',
        },
        {
          server_id: 'lb-haproxy-dc1-01',
          server_name: 'lb-haproxy-dc1-01',
          metric: 'Network',
          value: 86.3,
          severity: 'critical',
        },
      ],
      affectedServers: ['lb-haproxy-dc1-01'],
      hasAnomalies: true,
      anomalyCount: 2,
      summary: {
        totalServers: 18,
        onlineCount: 17,
        warningCount: 0,
        criticalCount: 1,
      },
    };

    const result = extractToolBasedData(anomalyData, null, null);
    const actions = result.recommendations.map((item) => item.action).join('\n');

    expect(result.severity).toBe('critical');
    expect(actions).toContain('CPU 상위 프로세스 확인');
    expect(actions).toContain('top -o %CPU -b -n 1 | head -20');
    expect(actions).toContain('HAProxy 세션/백엔드 상태 확인');
    expect(actions).toContain('show stat');
    expect(result.postmortem.prevention).toEqual(
      result.recommendations.map((recommendation) => recommendation.action)
    );
  });

  it('metric anomaly가 없어도 monitoring warning/critical 로그 evidence를 fallback 보고서에 반영한다', () => {
    const result = extractToolBasedData(
      {
        success: true,
        totalServers: 18,
        anomalies: [],
        hasAnomalies: false,
        anomalyCount: 0,
        summary: {
          totalServers: 18,
          onlineCount: 18,
          warningCount: 0,
          criticalCount: 0,
        },
      },
      null,
      null,
      undefined,
      {
        evidenceRefs: [
          {
            id: 'evidence-log-storage',
            kind: 'log',
            serverId: 'storage-s3gw-dc1-01',
            timeRange: {
              from: '2026-05-18T14:00:00.000Z',
              to: '2026-05-18T14:10:00.000Z',
            },
            summary:
              'storage-s3gw-dc1-01 syslog: minio[11900]: ERROR: Multipart upload stalled during backup window',
            severity: 'critical',
          },
          {
            id: 'evidence-log-db',
            kind: 'log',
            serverId: 'db-mysql-dc1-backup',
            timeRange: {
              from: '2026-05-18T14:00:00.000Z',
              to: '2026-05-18T14:10:00.000Z',
            },
            summary:
              'db-mysql-dc1-backup mysqld: [Warning] InnoDB: Write to NFS mount stalled for 1736ms',
            severity: 'warning',
          },
        ],
        timeline: {
          sourceMode: 'replay-json',
          events: [
            {
              timestamp: '2026-05-18T14:00:00.000Z',
              serverId: 'storage-s3gw-dc1-01',
              severity: 'critical',
              eventType: 'log',
              description:
                'storage-s3gw-dc1-01 syslog: minio upload stalled during backup window',
              evidenceRefId: 'evidence-log-storage',
            },
            {
              timestamp: '2026-05-18T14:00:00.000Z',
              serverId: 'db-mysql-dc1-backup',
              severity: 'warning',
              eventType: 'log',
              description:
                'db-mysql-dc1-backup mysqld: InnoDB write to NFS mount stalled',
              evidenceRefId: 'evidence-log-db',
            },
          ],
          evidenceRefs: [],
        },
      }
    );

    const actions = result.recommendations.map((item) => item.action).join('\n');

    expect(result.title).toBe('로그 이상 감지: 2건 발견');
    expect(result.severity).toBe('critical');
    expect(result.description).toContain('warning/critical');
    expect(result.affected_servers).toEqual([
      'storage-s3gw-dc1-01',
      'db-mysql-dc1-backup',
    ]);
    expect(result.system_summary.warning_servers).toBe(1);
    expect(result.system_summary.critical_servers).toBe(1);
    expect(result.pattern).toBe('로그 기반 이상 패턴 감지됨');
    expect(result.postmortem.timeline).toEqual([
      '14:00 - storage-s3gw-dc1-01 syslog: minio upload stalled during backup window',
      '14:00 - db-mysql-dc1-backup mysqld: InnoDB write to NFS mount stalled',
    ]);
    expect(actions).toContain('스토리지 I/O와 마운트 상태 확인');
    expect(actions).toContain('df -h');
    expect(actions).toContain('MySQL/InnoDB 지연 로그 확인');
    expect(actions).not.toContain('서버 리소스 업그레이드');
  });

  it('DB I/O와 WAS HikariPool 로그를 인과 체인 가설로 묶는다', () => {
    const result = extractToolBasedData(
      {
        success: true,
        totalServers: 18,
        anomalies: [],
        hasAnomalies: false,
        anomalyCount: 0,
        summary: {
          totalServers: 18,
          onlineCount: 18,
          warningCount: 0,
          criticalCount: 0,
        },
      },
      null,
      null,
      undefined,
      {
        evidenceRefs: [
          {
            id: 'evidence-db-fsync',
            kind: 'log',
            serverId: 'db-mysql-dc1-primary',
            timeRange: {
              from: '2026-05-18T16:20:00.000Z',
              to: '2026-05-18T16:21:00.000Z',
            },
            summary:
              'db-mysql-dc1-primary mysqld: InnoDB fsync latency 2255ms with disk 83%',
            value: 83,
            threshold: 80,
            severity: 'warning',
          },
          {
            id: 'evidence-hikari-timeout',
            kind: 'log',
            serverId: 'api-was-dc1-01',
            timeRange: {
              from: '2026-05-18T16:21:00.000Z',
              to: '2026-05-18T16:22:00.000Z',
            },
            summary:
              'api-was-dc1-01 java: HikariPool DB connection timeout after 1317ms',
            severity: 'critical',
          },
          {
            id: 'evidence-downstream-latency',
            kind: 'log',
            serverId: 'api-was-dc1-03',
            timeRange: {
              from: '2026-05-18T16:22:00.000Z',
              to: '2026-05-18T16:23:00.000Z',
            },
            summary:
              'api-was-dc1-03 java: downstream transaction latency 1753ms',
            severity: 'warning',
          },
        ],
        timeline: {
          sourceMode: 'replay-json',
          events: [
            {
              timestamp: '2026-05-18T16:20:00.000Z',
              serverId: 'db-mysql-dc1-primary',
              severity: 'warning',
              eventType: 'log',
              description:
                'db-mysql-dc1-primary mysqld: InnoDB fsync latency 2255ms with disk 83%',
              evidenceRefId: 'evidence-db-fsync',
            },
            {
              timestamp: '2026-05-18T16:21:00.000Z',
              serverId: 'api-was-dc1-01',
              severity: 'critical',
              eventType: 'log',
              description:
                'api-was-dc1-01 java: HikariPool DB connection timeout after 1317ms',
              evidenceRefId: 'evidence-hikari-timeout',
            },
            {
              timestamp: '2026-05-18T16:22:00.000Z',
              serverId: 'api-was-dc1-03',
              severity: 'warning',
              eventType: 'log',
              description:
                'api-was-dc1-03 java: downstream transaction latency 1753ms',
              evidenceRefId: 'evidence-downstream-latency',
            },
          ],
          evidenceRefs: [],
        },
      }
    );

    expect(result.postmortem.hypotheses).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'DB 디스크 I/O 지연이 WAS HikariPool 연결 대기/타임아웃으로 전파'
        ),
      ])
    );
    expect(result.postmortem.hypotheses.join('\n')).toContain(
      'downstream transaction 지연'
    );
    expect(result.recommendations.map((item) => item.action).join('\n')).toContain(
      'HikariPool'
    );
  });
});

describe('mergeIncidentRecommendations', () => {
  it('deterministic 진단 조치를 일반적인 업그레이드 조치보다 먼저 배치한다', () => {
    const result = mergeIncidentRecommendations(
      [
        {
          action:
            'lb-haproxy-dc1-01 CPU 상위 프로세스 확인 (85%)\n명령어: `top -o %CPU -b -n 1 | head -20`',
          priority: 'medium',
          expected_impact: '부하 프로세스 식별',
        },
      ],
      [
        {
          action: '서버 리소스 업그레이드',
          priority: 'high',
          expected_impact: '성능 개선',
        },
        {
          action: '로드 밸런싱 조정',
          priority: 'medium',
          expected_impact: '트래픽 분산',
        },
      ]
    );

    expect(result.map((item) => item.action)).toEqual([
      expect.stringContaining('CPU 상위 프로세스 확인'),
      '서버 리소스 업그레이드',
      '로드 밸런싱 조정',
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

  it('객체형 postmortem timeline 항목을 문자열로 정규화한다', () => {
    const result = normalizeAgentIncidentReportOutput(
      {
        title: 'CPU 과부하',
        severity: 'critical',
        description: '설명',
        affected_servers: ['web-01'],
        affectedServers: [],
        root_cause: '과부하',
        recommendations: [],
        pattern: '스파이크',
        postmortem: {
          timeline: [
            {
              timestamp: '2026-05-18T01:50:00.000Z',
              event: 'CPU 96% threshold breach',
              severity: 'critical',
            },
          ],
          hypotheses: ['트래픽 급증'],
          prevention: ['오토스케일 정책 점검'],
        },
      },
      fallback
    );

    expect(result.postmortem.timeline).toEqual([
      '2026-05-18T01:50:00.000Z - CPU 96% threshold breach - (critical)',
    ]);
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
