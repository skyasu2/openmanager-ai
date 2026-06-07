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

describe('current metrics domain evidence providers: group regressions', () => {
  describe('P18 near-threshold: "둘 다 임계치 근처" 표현이 AND 임계 필터로 라우팅', () => {
    const nearThresholdServers = [
      // CPU·디스크 모두 임계 근처
      { id: 'db-mysql-dc1-primary', type: 'database', status: 'warning', cpu: 64, memory: 50, disk: 63 },
      // CPU만 높고 디스크는 낮음 — 제외되어야 함
      { id: 'lb-haproxy-dc1-01', type: 'loadbalancer', status: 'warning', cpu: 75, memory: 40, disk: 26 },
      // 디스크만 높고 CPU는 낮음 — 제외되어야 함
      { id: 'db-mysql-dc1-backup', type: 'database', status: 'online', cpu: 18, memory: 34, disk: 71 },
      // 둘 다 낮음 — 제외
      { id: 'web-nginx-dc1-03', type: 'web', status: 'online', cpu: 17, memory: 31, disk: 28 },
    ];

    it('"CPU와 디스크 둘 다 임계치 근처인 서버" → multi-metric-near-threshold AND filter', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('CPU와 디스크 둘 다 임계치 근처인 서버 알려줘', {
          servers: nearThresholdServers,
        })
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'multi-metric-near-threshold',
        metrics: expect.arrayContaining(['cpu', 'disk']),
        filterOperator: 'AND',
      });
      // 임계치 근처는 inferredThreshold(>= 60%)로 처리
      expect((parsed as { threshold?: number } | null)?.threshold).toBeGreaterThanOrEqual(50);
    });

    it('evidence 응답은 양쪽 메트릭이 모두 임계 근처인 서버만 노출', async () => {
      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
        createEvidenceRequest('CPU와 디스크 둘 다 임계치 근처인 서버 알려줘', {
          timeLabel: '22:50',
          servers: nearThresholdServers,
        })
      );
      expect(evidence?.fallback).toContain('db-mysql-dc1-primary');
      // 한쪽만 위반한 서버는 제외되어야 함
      expect(evidence?.fallback).not.toContain('lb-haproxy-dc1-01');
      expect(evidence?.fallback).not.toContain('db-mysql-dc1-backup');
      expect(evidence?.fallback).not.toContain('web-nginx-dc1-03');
    });

    it('"곧 위험" 표현도 동일 경로로 라우팅', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('CPU와 메모리 둘 다 곧 위험해질 서버 알려줘', {
          servers: nearThresholdServers,
        })
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'multi-metric-near-threshold',
        filterOperator: 'AND',
      });
    });
  });

  describe('group-compare: 두 그룹 비교 표현이 group-compare 경로로 라우팅 (P8)', () => {
    it('message-only 경로: web vs storage 메모리 비교는 group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('web 서버 그룹과 storage 서버 그룹 중 메모리를 더 많이 쓰는 쪽은?')
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'memory',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('web');
      expect(parsed?.groupTargets).toContain('storage');
    });

    it('intentFrame 경로: metric_current frame이 있어도 두 그룹 비교는 group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest({
        ...createEvidenceRequest('web 서버 그룹과 storage 서버 그룹 중 메모리를 더 많이 쓰는 쪽은?'),
        intentFrame: {
          domainId: MONITORING_DOMAIN_ID,
          intent: 'metric_current',
          metric: 'memory',
          confidence: 0.9,
        },
      });
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'memory',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('web');
      expect(parsed?.groupTargets).toContain('storage');
    });

    it('intentFrame 경로: DB vs Cache 비교도 group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest({
        ...createEvidenceRequest('DB 서버와 Cache 서버 중 어느 쪽이 메모리 더 높아?'),
        intentFrame: {
          domainId: MONITORING_DOMAIN_ID,
          intent: 'metric_current',
          metric: 'memory',
          confidence: 0.9,
        },
      });
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'memory',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('database');
      expect(parsed?.groupTargets).toContain('cache');
    });

    it('P22: DB vs cache CPU 평균 비교는 evidence-unavailable 대신 group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('DB vs cache CPU 평균 비교해줘')
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'cpu',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('database');
      expect(parsed?.groupTargets).toContain('cache');
    });

    it('P22: DB vs cache CPU 평균 비교는 두 그룹 평균을 모두 응답한다', async () => {
      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
        createEvidenceRequest('DB vs cache CPU 평균 비교해줘', {
          timeLabel: '13:40',
          servers: [
            {
              id: 'db-mysql-dc1-primary',
              type: 'database',
              status: 'online',
              cpu: 54,
              memory: 62,
              disk: 58,
            },
            {
              id: 'db-mysql-dc1-replica',
              type: 'database',
              status: 'online',
              cpu: 50,
              memory: 60,
              disk: 55,
            },
            {
              id: 'cache-redis-dc1-01',
              type: 'cache',
              status: 'warning',
              cpu: 41,
              memory: 91,
              disk: 45,
            },
            {
              id: 'cache-redis-dc1-02',
              type: 'cache',
              status: 'online',
              cpu: 39,
              memory: 74,
              disk: 43,
            },
          ],
        })
      );

      expect(evidence?.id).toBe('monitoring-metric-current');
      expect(evidence?.fallback).toContain('DB 서버 vs 캐시 서버 CPU 비교');
      expect(evidence?.fallback).toContain('DB 서버 52%');
      expect(evidence?.fallback).toContain('캐시 서버 40%');
      expect(evidence?.fallback).toContain('db-mysql-dc1-primary');
      expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    });
  });

  describe('P21 regression: group instability comparison', () => {
    it('api-was vs lb 불안정 비교를 양쪽 그룹 server_health 비교로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('api-was와 lb 중 더 불안정한 쪽은?')
      );

      expect(parsed).toMatchObject({
        intent: 'server_health',
        sourceIntent: 'group-health-compare',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('application');
      expect(parsed?.groupTargets).toContain('loadbalancer');
    });

    it('api-was vs lb 불안정 비교는 lb 그룹을 누락하지 않는다', async () => {
      const evidence = await monitoringServerHealthEvidenceProvider.resolve(
        createEvidenceRequest('api-was와 lb 중 더 불안정한 쪽은?', {
          timeLabel: '13:40',
          servers: [
            {
              id: 'api-was-dc1-01',
              type: 'application',
              status: 'warning',
              cpu: 76,
              memory: 68,
              disk: 47,
            },
            {
              id: 'api-was-dc1-02',
              type: 'application',
              status: 'online',
              cpu: 44,
              memory: 57,
              disk: 42,
            },
            {
              id: 'lb-haproxy-dc1-01',
              type: 'loadbalancer',
              status: 'warning',
              cpu: 62,
              memory: 55,
              disk: 33,
            },
            {
              id: 'lb-haproxy-dc1-02',
              type: 'loadbalancer',
              status: 'online',
              cpu: 31,
              memory: 45,
              disk: 28,
            },
          ],
        })
      );

      expect(evidence?.id).toBe('monitoring-server-health');
      expect(evidence?.metadata).toMatchObject({
        capabilityId: MONITORING_SERVER_HEALTH_CAPABILITY_ID,
        intent: 'server_health',
        sourceIntent: 'group-health-compare',
        groupTargets: expect.arrayContaining(['application', 'loadbalancer']),
      });
      expect(evidence?.fallback).toContain('애플리케이션 서버 vs 로드밸런서 안정성 비교');
      expect(evidence?.fallback).toContain('api-was-dc1-01');
      expect(evidence?.fallback).toContain('lb-haproxy-dc1-01');
      expect(evidence?.fallback).toContain('로드밸런서');
      expect(evidence?.fallback).not.toContain('불안정 점수');
      expect(evidence?.fallback).not.toContain('그룹 점수');
      expect(evidence?.fallback).not.toContain('상태 페널티');
    });
  });

  describe('P10 regression: backup group server filter', () => {
    const backupSnapshot = {
      timeLabel: '12:00',
      servers: [
        {
          id: 'db-mysql-dc1-primary',
          type: 'database',
          status: 'online',
          cpu: 41,
          memory: 66,
          disk: 62,
          network: 13,
        },
        {
          id: 'db-mysql-dc1-backup',
          type: 'database',
          status: 'online',
          cpu: 22,
          memory: 55,
          disk: 69,
          network: 8,
        },
        {
          id: 'web-nginx-dc1-01',
          type: 'web',
          status: 'online',
          cpu: 15,
          memory: 40,
          disk: 30,
          network: 5,
        },
      ],
    };

    it('parses backup group query with target=backup', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('backup 서버들 CPU 상태는?', backupSnapshot)
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.targets).toContain('backup');
    });

    it('resolves backup group query to only the backup server', async () => {
      const request = createEvidenceRequest(
        'backup 서버들 디스크 상태 알려줘',
        backupSnapshot
      );
      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);
      expect(evidence).not.toBeNull();
      const answer = (evidence as { fallback?: string } | null)?.fallback ?? '';
      expect(answer).toContain('db-mysql-dc1-backup');
      expect(answer).not.toContain('db-mysql-dc1-primary');
      expect(answer).not.toContain('web-nginx-dc1-01');
    });
  });

  describe('P14 regression: single-group aggregate metric query', () => {
    const dbSnapshot = {
      timeLabel: '12:00',
      servers: [
        {
          id: 'db-mysql-dc1-001',
          type: 'database',
          status: 'online',
          cpu: 40,
          memory: 70,
          disk: 55,
          network: 10,
        },
        {
          id: 'db-mysql-dc1-002',
          type: 'database',
          status: 'online',
          cpu: 35,
          memory: 80,
          disk: 60,
          network: 12,
        },
        {
          id: 'web-nginx-dc1-01',
          type: 'web',
          status: 'online',
          cpu: 15,
          memory: 40,
          disk: 30,
          network: 5,
        },
      ],
    };

    it('parses single-group average query as metric_current with group target', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('db-mysql 서버들 평균 메모리 사용량은?', dbSnapshot)
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.intent).toBe('metric_current');
      expect(parsed?.metric).toBe('memory');
      expect(parsed?.targets).toContain('database');
    });

    it('resolves single-group average query to group average answer', async () => {
      const request = createEvidenceRequest(
        'db-mysql 서버들 평균 메모리 사용량은?',
        dbSnapshot
      );
      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(request);
      expect(evidence).not.toBeNull();
      const answer = (evidence as { fallback?: string } | null)?.fallback ?? '';
      expect(answer).toContain('메모리');
      expect(answer).toContain('db-mysql-dc1-001');
      expect(answer).toContain('db-mysql-dc1-002');
      expect(answer).not.toContain('web-nginx-dc1-01');
    });

    it('also handles web server group average query', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('웹 서버들 평균 CPU 사용률은?', dbSnapshot)
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.intent).toBe('metric_current');
      expect(parsed?.metric).toBe('cpu');
      expect(parsed?.targets).toContain('web');
    });
  });

  describe('P17: api-vs-web 크로스 그룹 비교 — "보다" 조사 포함 쿼리도 group-compare 경로', () => {
    it('"api 서버들이 web 서버들보다 CPU를 더 많이 쓰고 있어?" → group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('api 서버들이 web 서버들보다 CPU를 더 많이 쓰고 있어?')
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'cpu',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('application');
      expect(parsed?.groupTargets).toContain('web');
    });

    it('"was 그룹이 web 그룹보다 메모리가 높아?" → group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('was 그룹이 web 그룹보다 메모리가 높아?')
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'memory',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('application');
      expect(parsed?.groupTargets).toContain('web');
    });

    it('"db 서버가 cache 서버보다 디스크 많이 써?" → group-compare로 파싱', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('db 서버가 cache 서버보다 디스크 많이 써?')
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-compare',
        metric: 'disk',
      });
      expect(parsed?.groupTargets).toHaveLength(2);
      expect(parsed?.groupTargets).toContain('database');
      expect(parsed?.groupTargets).toContain('cache');
    });
  });

  describe('P24 all-scope 평균 집계', () => {
    it('"전체 서버 평균 CPU 사용률 알려줘" → all-aggregate (그룹/타깃 없음)', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('전체 서버 평균 CPU 사용률 알려줘')
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        capabilityId: MONITORING_METRIC_CURRENT_CAPABILITY_ID,
        sourceIntent: 'all-aggregate',
        metric: 'cpu',
      });
      expect(parsed?.targets).toBeUndefined();
      expect(parsed?.groupTargets).toBeUndefined();
    });

    it('"전체 18대 서버의 평균 디스크 사용률은 몇 퍼센트야?" → all-aggregate', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest(
          '전체 18대 서버의 평균 디스크 사용률은 몇 퍼센트야?'
        )
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'all-aggregate',
        metric: 'disk',
      });
      expect(parsed?.targets).toBeUndefined();
    });

    it('all-aggregate를 전체 서버 평균 현황 답변으로 해소한다 (evidence-unavailable 회귀 방지)', async () => {
      const request = createEvidenceRequest('전체 서버 평균 CPU 사용률 알려줘');
      const evidence =
        await monitoringMetricCurrentEvidenceProvider.resolve(request);
      expect(evidence).not.toBeNull();
      expect(evidence?.fallback).toContain('전체 서버');
      expect(evidence?.fallback).toContain('평균');
    });

    it('그룹 한정 평균은 여전히 group-aggregate로 유지한다 (회귀 방지)', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('db 서버들 평균 메모리 알려줘')
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'group-aggregate',
        metric: 'memory',
      });
    });

    it('Q-NEW119: resolves all-scope multi-metric averages deterministically', async () => {
      const snapshot = {
        timeLabel: '01:30',
        servers: [
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 10,
            memory: 40,
            disk: 20,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 20,
            memory: 60,
            disk: 50,
          },
        ],
      };

      const request = createEvidenceRequest(
        '지금 모든 서버 평균 메모리와 평균 디스크를 동시에 알려줘',
        snapshot
      );
      const parsed = parseCurrentMetricsEvidenceRequest(request);
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'multi-metric-aggregate',
        metrics: ['memory', 'disk'],
      });
      expect(parsed?.targets).toBeUndefined();
      expect(parsed?.statusFilter).toBeUndefined();

      const evidence =
        await monitoringMetricCurrentEvidenceProvider.resolve(request);
      expect(evidence?.fallback).toContain('평균 메모리: 50%');
      expect(evidence?.fallback).toContain('평균 디스크: 35%');
      expect(evidence?.fallback).not.toContain('N/A');
    });
  });
});
