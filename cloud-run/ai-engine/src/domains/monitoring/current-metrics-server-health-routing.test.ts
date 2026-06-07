import { describe, expect, it } from 'vitest';
import {
  MONITORING_DOMAIN_ID,
  MONITORING_METRIC_CURRENT_CAPABILITY_ID,
  MONITORING_METRIC_RANKING_CAPABILITY_ID,
  MONITORING_PEAK_METRIC_CAPABILITY_ID,
  MONITORING_SERVER_HEALTH_CAPABILITY_ID,
} from './constants';
import {
  monitoringMetricCurrentEvidenceProvider,
  monitoringMetricRankingEvidenceProvider,
  monitoringServerHealthEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: server health routing', () => {
  it('resolves current server health summaries as deterministic evidence', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('현재 모든 서버 상태 요약해줘')
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
      },
    });
    expect(evidence?.fallback).toContain('서버 현황 요약');
    expect(evidence?.fallback).toContain('전체');
    expect(evidence?.prompt).toContain('현재 서버 상태');
  });

  it('resolves healthy-only server list queries as deterministic server health evidence', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('현재 정상 범위인 서버 목록 보여줘', {
        timeLabel: '08:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 43,
            memory: 66,
            disk: 44,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 45,
            memory: 91,
            disk: 44,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'online',
            cpu: 22,
            memory: 61,
            disk: 89,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
        sourceIntent: 'healthy-only',
        statusFilter: 'healthy-only',
      },
    });
    expect(evidence?.fallback).toContain('정상 범위 서버');
    expect(evidence?.fallback).toContain('📌 **서버별 현황**');
    expect(evidence?.fallback).toContain('1. **api-was-dc1-01**');
    expect(evidence?.fallback).not.toContain('• 서버별:');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).not.toContain('storage-nfs-dc1-01');
  });

  it('preserves healthy-only intent when metadata frame is whole-fleet server health', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve({
      ...createEvidenceRequest('현재 정상 범위인 서버 목록 보여줘', {
        timeLabel: '08:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 43,
            memory: 66,
            disk: 44,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 45,
            memory: 91,
            disk: 44,
          },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
        sourceIntent: 'healthy-only',
        statusFilter: 'healthy-only',
      },
    });
    expect(evidence?.fallback).toContain('정상 범위 서버');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
    expect(evidence?.fallback).not.toContain('cache-redis-dc1-01');
  });

  it('resolves lowest composite load queries as deterministic ranking evidence', async () => {
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(
      createEvidenceRequest('지금 부하가 가장 낮은 서버는?', {
        timeLabel: '08:50',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 60,
            memory: 70,
            disk: 30,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 20,
            memory: 30,
            disk: 25,
          },
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'warning',
            cpu: 80,
            memory: 60,
            disk: 70,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-metric-ranking',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
        intent: 'metric_ranking',
        sourceIntent: 'composite-load-ranking',
        rankBasis: 'composite-load',
        rankOrder: 'asc',
        rankCount: 1,
      },
    });
    expect(evidence?.fallback).toContain('복합 부하 하위 1대');
    expect(evidence?.fallback).toMatch(/1\. web-nginx-dc1-01/s);
    expect(evidence?.fallback).toContain('CPU 20%');
    expect(evidence?.fallback).toContain('메모리 30%');
    expect(evidence?.fallback).toContain('디스크 25%');
    expect(evidence?.fallback).toContain('안정적 수치');
    expect(evidence?.fallback).not.toContain('배치/트래픽 이동 후보');
  });

  it('Q-NEW106: resolves cross-metric lookup over ranked source metric servers', async () => {
    const snapshot = {
      timeLabel: '09:10',
      servers: [
        {
          id: 'cache-redis-dc1-01',
          type: 'cache',
          status: 'warning',
          cpu: 40,
          memory: 92,
          disk: 46,
        },
        {
          id: 'api-was-dc1-01',
          type: 'application',
          status: 'online',
          cpu: 58,
          memory: 86,
          disk: 73,
        },
        {
          id: 'storage-nfs-dc1-01',
          type: 'storage',
          status: 'critical',
          cpu: 35,
          memory: 42,
          disk: 94,
        },
      ],
    };
    const request = createEvidenceRequest(
      '메모리 상위 2개 서버들의 디스크 사용량 알려줘',
      snapshot
    );

    expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'ranking-cross-metric',
      sourceMetric: 'memory',
      metric: 'disk',
      rankCount: 2,
      rankOrder: 'desc',
    });

    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
      request
    );

    expect(evidence?.metadata).toMatchObject({
      responsePolicy: 'deterministic_answer',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      intent: 'metric_current',
      sourceIntent: 'ranking-cross-metric',
      sourceMetric: 'memory',
      metric: 'disk',
      rankCount: 2,
      rankOrder: 'desc',
      targets: ['cache-redis-dc1-01', 'api-was-dc1-01'],
    });
    expect(evidence?.fallback).toContain('메모리 상위 2대 서버의 디스크 현황');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).toContain('디스크 46%');
    expect(evidence?.fallback).toContain('api-was-dc1-01');
    expect(evidence?.fallback).toContain('디스크 73%');
    expect(evidence?.fallback).not.toContain('storage-nfs-dc1-01');
  });

  it('resolves available-server TOP-N queries by composite load ascending', async () => {
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve(
      createEvidenceRequest('여유 있는 서버 TOP 3 알려줘', {
        timeLabel: '08:50',
        servers: [
          { id: 'api-was-dc1-01', status: 'online', cpu: 60, memory: 70, disk: 30 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 20, memory: 30, disk: 25 },
          { id: 'cache-redis-dc1-01', status: 'online', cpu: 35, memory: 42, disk: 30 },
          { id: 'db-mysql-dc1-primary', status: 'warning', cpu: 80, memory: 60, disk: 70 },
        ],
      })
    );

    expect(evidence?.metadata).toMatchObject({
      rankBasis: 'composite-load',
      rankOrder: 'asc',
      rankCount: 3,
    });
    expect(evidence?.fallback).toContain('복합 부하 하위 3대');
    expect(evidence?.fallback).toMatch(
      /1\. web-nginx-dc1-01[\s\S]+2\. cache-redis-dc1-01[\s\S]+3\. api-was-dc1-01/
    );
    expect(evidence?.fallback).not.toContain('db-mysql-dc1-primary');
  });

  it('resolves current resource pressure ranking by composite load descending', async () => {
    const parsed = parseCurrentMetricsEvidenceRequest(
      createEvidenceRequest('전체 서버 리소스 압박 순위 알려줘')
    );
    const evidence = await monitoringMetricRankingEvidenceProvider.resolve({
      ...createEvidenceRequest('전체 서버 리소스 압박 순위 알려줘', {
        timeLabel: '08:50',
        servers: [
          { id: 'api-was-dc1-01', status: 'online', cpu: 65, memory: 70, disk: 30 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 20, memory: 30, disk: 25 },
          { id: 'storage-nfs-dc1-01', status: 'critical', cpu: 70, memory: 75, disk: 93 },
          { id: 'db-mysql-dc1-primary', status: 'warning', cpu: 80, memory: 60, disk: 70 },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_peak',
        capabilityId: MONITORING_PEAK_METRIC_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'load',
        timeWindow: 'current',
        aggregation: 'peak',
        topN: 5,
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(parsed).toMatchObject({
      intent: 'metric_ranking',
      sourceIntent: 'composite-pressure-ranking',
      rankBasis: 'composite-load',
      rankOrder: 'desc',
      rankCount: 5,
    });
    expect(evidence?.metadata).toMatchObject({
      capabilityId: MONITORING_METRIC_RANKING_CAPABILITY_ID,
      intent: 'metric_ranking',
      sourceIntent: 'composite-pressure-ranking',
      rankBasis: 'composite-load',
      rankOrder: 'desc',
      rankCount: 5,
    });
    expect(evidence?.fallback).toContain('리소스 압박 상위 5대');
    expect(evidence?.fallback).toMatch(
      /1\. storage-nfs-dc1-01[\s\S]+2\. db-mysql-dc1-primary[\s\S]+3\. api-was-dc1-01/
    );
    expect(evidence?.fallback).not.toContain('최고 시간대');
  });

  it('Q-NEW72: compares CPU/MEM/DISK risk directly instead of falling through to Analyst', async () => {
    const request = createEvidenceRequest('CPU/MEM/DISK 중 가장 위험 메트릭은?', {
      timeLabel: '15:20',
      servers: [
        { id: 'api-was-dc1-01', status: 'online', cpu: 65, memory: 70, disk: 30 },
        { id: 'web-nginx-dc1-01', status: 'online', cpu: 20, memory: 30, disk: 25 },
        { id: 'storage-nfs-dc1-01', status: 'critical', cpu: 70, memory: 75, disk: 93 },
        { id: 'db-mysql-dc1-primary', status: 'warning', cpu: 80, memory: 60, disk: 70 },
      ],
    });
    const parsed = parseCurrentMetricsEvidenceRequest(request);
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);

    expect(parsed).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'metric-risk-compare',
      metrics: ['cpu', 'memory', 'disk'],
      rankOrder: 'desc',
      rankCount: 3,
    });
    expect(evidence?.metadata).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'metric-risk-compare',
      metrics: ['cpu', 'memory', 'disk'],
    });
    expect(evidence?.fallback).toContain('메트릭 위험도 비교');
    expect(evidence?.fallback).toContain('가장 위험한 메트릭은 **디스크**');
    expect(evidence?.fallback).toMatch(
      /1\. 디스크: critical 1대 · warning 0대 · 최고 storage-nfs-dc1-01 93%/
    );
    expect(evidence?.fallback).toMatch(/2\. CPU:/);
    expect(evidence?.fallback).toMatch(/3\. 메모리:/);
    expect(evidence?.fallback).not.toContain('서버별 현황');
  });

  it('Q-NEW76: compares CPU/메모리/디스크 risk when the query omits the metric noun', async () => {
    const request = createEvidenceRequest(
      'CPU/메모리/디스크 중 어느 게 가장 위험?',
      {
        timeLabel: '18:40',
        servers: [
          { id: 'api-was-dc1-01', status: 'online', cpu: 65, memory: 70, disk: 30 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 20, memory: 30, disk: 25 },
          { id: 'storage-nfs-dc1-01', status: 'critical', cpu: 70, memory: 75, disk: 93 },
          { id: 'cache-redis-dc1-01', status: 'warning', cpu: 45, memory: 88, disk: 40 },
        ],
      }
    );
    const parsed = parseCurrentMetricsEvidenceRequest(request);
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);

    expect(parsed).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'metric-risk-compare',
      metrics: ['cpu', 'memory', 'disk'],
      rankOrder: 'desc',
      rankCount: 3,
    });
    expect(evidence?.metadata).toMatchObject({
      intent: 'metric_current',
      capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
      sourceIntent: 'metric-risk-compare',
      metrics: ['cpu', 'memory', 'disk'],
    });
    expect(evidence?.fallback).toContain('메트릭 위험도 비교');
    expect(evidence?.fallback).toContain('가장 위험한 메트릭은 **디스크**');
    expect(evidence?.fallback).toMatch(/1\. 디스크:/);
    expect(evidence?.fallback).toMatch(/2\. 메모리:/);
    expect(evidence?.fallback).toMatch(/3\. CPU:/);
  });

  it('Q-NEW72: preserves metric risk comparison when a metric_current frame names only CPU', async () => {
    const evidence = await monitoringMetricCurrentEvidenceProvider.resolve({
      ...createEvidenceRequest('CPU/MEM/DISK 중 가장 위험 메트릭은?', {
        timeLabel: '15:20',
        servers: [
          { id: 'api-was-dc1-01', status: 'online', cpu: 65, memory: 70, disk: 30 },
          { id: 'storage-nfs-dc1-01', status: 'critical', cpu: 70, memory: 75, disk: 93 },
          { id: 'db-mysql-dc1-primary', status: 'warning', cpu: 80, memory: 60, disk: 70 },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        metric: 'cpu',
        timeWindow: 'current',
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(evidence?.metadata).toMatchObject({
      intent: 'metric_current',
      sourceIntent: 'metric-risk-compare',
      metrics: ['cpu', 'memory', 'disk'],
    });
    expect(evidence?.fallback).toContain('가장 위험한 메트릭은 **디스크**');
    expect(evidence?.fallback).not.toContain('CPU 현황');
  });

  it('resolves server alias detail prompts without falling back to whole-fleet summaries', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('web-server-01 상태를 자세히 알려줘')
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
      },
    });
    expect(evidence?.fallback).toContain('web-nginx-dc1-01');
    expect(evidence?.fallback).toContain('요청 별칭: web-server-01');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
  });

  it('preserves raw server detail intent when metadata frame is whole-fleet server health', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve({
      ...createEvidenceRequest('web-server-01 상태를 자세히 알려줘', {
        servers: [
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 41, memory: 52, disk: 31 },
          { id: 'api-was-dc1-01', status: 'critical', cpu: 93, memory: 66, disk: 44 },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(evidence?.fallback).toContain('web-nginx-dc1-01');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
  });

  it('resolves action-needed prompts with a single deterministic conclusion', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('지금 당장 조치가 필요한 서버가 있어?', {
        servers: [
          { id: 'api-was-dc1-01', status: 'critical', cpu: 93, memory: 66, disk: 44 },
          { id: 'api-was-dc1-02', status: 'warning', cpu: 89, memory: 62, disk: 41 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 41, memory: 52, disk: 31 },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
      },
    });
    expect(evidence?.fallback).toContain('즉시 조치');
    expect(evidence?.fallback).toContain('즉시 조치 대상은 1대입니다');
    expect(evidence?.fallback).toContain('주의 관찰 대상은 1대입니다');
    expect(evidence?.fallback).not.toMatch(/즉시 조치[^\n]+없(?:습니다|음)/);
  });

  it('resolves urgent action ranking wording with a deterministic priority summary', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('지금 당장 조치 시급한 서버 순위', {
        servers: [
          {
            id: 'cache-redis-dc1-01',
            status: 'critical',
            cpu: 45,
            memory: 91,
            disk: 44,
          },
          {
            id: 'api-was-dc1-01',
            status: 'warning',
            cpu: 43,
            memory: 66,
            disk: 44,
          },
          {
            id: 'web-nginx-dc1-01',
            status: 'online',
            cpu: 41,
            memory: 52,
            disk: 31,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
      },
    });
    expect(evidence?.fallback).toContain('즉시 조치 대상은 1대입니다');
    expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    expect(evidence?.fallback).toContain('주의 관찰 대상은 1대입니다');
    expect(evidence?.fallback).not.toContain('CPU 92%');
  });

  it('preserves raw action-needed intent when metadata frame is whole-fleet server health', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve({
      ...createEvidenceRequest('지금 당장 조치가 필요한 서버가 있어?', {
        servers: [
          { id: 'api-was-dc1-01', status: 'critical', cpu: 93, memory: 66, disk: 44 },
          { id: 'api-was-dc1-02', status: 'warning', cpu: 89, memory: 62, disk: 41 },
          { id: 'web-nginx-dc1-01', status: 'online', cpu: 41, memory: 52, disk: 31 },
        ],
      }),
      intentFrame: {
        domainId: MONITORING_DOMAIN_ID,
        intent: 'server_health',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        scope: 'whole_fleet',
        targets: [],
        aggregation: 'summary',
        ambiguity: 'low',
        confidence: 0.9,
      },
    });

    expect(evidence?.fallback).toContain('즉시 조치 대상은 1대입니다');
    expect(evidence?.fallback).not.toContain('서버 현황 요약');
  });

  it('routes "가장 위험한 서버" wording to server health evidence via ACTION_NEEDED_PATTERN', async () => {
    for (const message of [
      '지금 현재 메트릭 기준으로 가장 위험한 서버는?',
      '어떤 서버가 가장 위험한가요?',
      '현재 어떤 서버가 가장 위험한가요?',
    ]) {
      const evidence = await monitoringServerHealthEvidenceProvider.resolve(
        createEvidenceRequest(message, {
          servers: [
            { id: 'api-was-dc1-01', status: 'warning', cpu: 84, memory: 62, disk: 41 },
            { id: 'api-was-dc1-02', status: 'online', cpu: 43, memory: 51, disk: 39 },
            { id: 'web-nginx-dc1-01', status: 'online', cpu: 21, memory: 45, disk: 28 },
          ],
        })
      );

      expect(evidence, message).toMatchObject({
        id: 'monitoring-server-health',
        metadata: {
          responsePolicy: 'deterministic_answer',
          capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
          intent: 'server_health',
          sourceIntent: 'action-needed',
        },
      });
      expect(evidence?.fallback, message).toContain('api-was-dc1-01');
      expect(evidence?.fallback, message).not.toContain('CPU 84% 창작');
    }
  });

  it('P25: resolves risky and stable server dual queries as deterministic server health evidence', async () => {
    const evidence = await monitoringServerHealthEvidenceProvider.resolve(
      createEvidenceRequest('가장 위험한 서버와 가장 안정적인 서버를 같이 알려줘', {
        timeLabel: '23:00',
        servers: [
          {
            id: 'api-was-dc1-01',
            status: 'warning',
            cpu: 84,
            memory: 62,
            disk: 41,
          },
          {
            id: 'cache-redis-dc1-01',
            status: 'online',
            cpu: 35,
            memory: 88,
            disk: 30,
          },
          {
            id: 'web-nginx-dc1-01',
            status: 'online',
            cpu: 21,
            memory: 45,
            disk: 28,
          },
        ],
      })
    );

    expect(evidence).toMatchObject({
      id: 'monitoring-server-health',
      metadata: {
        responsePolicy: 'deterministic_answer',
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
        sourceIntent: 'top-bottom-health',
      },
    });
    expect(evidence?.fallback).toContain('위험 서버');
    expect(evidence?.fallback).toContain('안정 서버');
    expect(evidence?.fallback).toMatch(/위험 서버[\s\S]+api-was-dc1-01/);
    expect(evidence?.fallback).toMatch(/안정 서버[\s\S]+web-nginx-dc1-01/);
    expect(evidence?.fallback).not.toContain('불안정 점수');
    expect(evidence?.fallback).not.toContain('상태 페널티');
    expect(evidence?.fallback).not.toContain('warning +20');
    expect(evidence?.fallback).not.toContain('안정 서버 BOTTOM');
    expect(evidence?.fallback).not.toContain('evidence-unavailable');
  });

  it('routes "문제 있는 서버" wording to server health evidence via ACTION_NEEDED_PATTERN', async () => {
    for (const message of [
      '현재 문제 있는 서버가 무엇인지 알려줘',
      '지금 문제가 있는 서버 알려줘',
      '문제 있는 서버가 어디야?',
      '이상 있는 서버 목록',
      '비정상 서버 뭐 있어?',
      '장애가 있는 서버 알려줘',
    ]) {
      const evidence = await monitoringServerHealthEvidenceProvider.resolve(
        createEvidenceRequest(message, {
          servers: [
            { id: 'lb-haproxy-dc1-01', status: 'warning', cpu: 55, memory: 61, disk: 39, network: 72.6 },
            { id: 'api-was-dc1-01', status: 'online', cpu: 43, memory: 51, disk: 37 },
            { id: 'web-nginx-dc1-01', status: 'online', cpu: 21, memory: 45, disk: 28 },
          ],
        })
      );

      expect(evidence, message).toMatchObject({
        id: 'monitoring-server-health',
        metadata: {
          responsePolicy: 'deterministic_answer',
          capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
          intent: 'server_health',
          sourceIntent: 'action-needed',
        },
      });
      expect(evidence?.fallback, message).toContain('lb-haproxy-dc1-01');
    }
  });

  it('routes "WAS 서버 그룹 상태" to server_health with application group target', async () => {
    // "WAS 서버 그룹 전체 CPU 상태 요약해줘"는 cpu 메트릭이 명시되어 metric_current로 파싱됨
    // server_health 라우팅은 특정 메트릭 없이 상태/현황을 묻는 쿼리에만 적용됨
    const parsed = parseCurrentMetricsEvidenceRequest(
      createEvidenceRequest('WAS 서버 그룹 상태 어때요?')
    );

    expect(parsed).toMatchObject({
      capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
      intent: 'server_health',
      targets: ['application'],
    });
  });
});
