import { describe, expect, it } from 'vitest';
import { MONITORING_METRIC_TREND_CAPABILITY_ID } from './constants';
import {
  monitoringMetricCurrentEvidenceProvider,
  monitoringMetricRankingEvidenceProvider,
  monitoringServerHealthEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: status/filter regressions', () => {
  describe('25차 QA follow-up regressions: status filters and low-threshold AND filters', () => {
    it('P26: applies warning status filter before aggregating a different metric', async () => {
      const snapshot = {
        timeLabel: '01:30',
        servers: [
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'warning',
            cpu: 70,
            memory: 82,
            disk: 50,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 30,
            memory: 84,
            disk: 35,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 10,
            memory: 30,
            disk: 20,
          },
        ],
      };

      // P28 fix: "메모리 경고 상태인 서버들의 평균 CPU" → cross-metric-condition-aggregate
      // 메모리(필터 메트릭) >= 80%(경고 임계값) 조건 서버를 필터링 후 CPU 평균 집계
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('메모리 경고 상태인 서버들의 평균 CPU는?', snapshot)
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'cross-metric-condition-aggregate',
        metric: 'cpu',
        filterConditions: [{ metric: 'memory', operator: '>=', threshold: 80 }],
      });

      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
        createEvidenceRequest('메모리 경고 상태인 서버들의 평균 CPU는?', snapshot)
      );
      // memory >= 80%: db-mysql-dc1-primary(82%), cache-redis-dc1-01(84%) → CPU 평균 (70+30)/2=50%
      expect(evidence?.fallback).toContain('평균 CPU: 50%');
      expect(evidence?.fallback).toContain('db-mysql-dc1-primary');
      expect(evidence?.fallback).toContain('cache-redis-dc1-01');
      expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
    });

    it('Q-NEW96: treats current near-full disk wording as current threshold evidence, not capacity forecast', async () => {
      const snapshot = {
        timeLabel: '01:30',
        servers: [
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'warning',
            cpu: 35,
            memory: 40,
            disk: 82,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 10,
            memory: 30,
            disk: 30,
          },
        ],
      };

      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('디스크가 거의 꽉 찬 서버 있어?', snapshot)
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'current-near-full-filter',
        metric: 'disk',
        threshold: 80,
        thresholdOperator: '>=',
      });

      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
        createEvidenceRequest('디스크가 거의 꽉 찬 서버 있어?', snapshot)
      );
      expect(evidence?.id).toBe('monitoring-metric-current');
      expect(evidence?.fallback).toContain('디스크 80% 이상 서버');
      expect(evidence?.fallback).toContain('storage-nfs-dc1-01');
      expect(evidence?.fallback).not.toContain('도달 예측');
      expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
    });

    it('Q-NEW97: compares warning status server counts for two groups', async () => {
      const snapshot = {
        timeLabel: '01:30',
        servers: [
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'warning',
            cpu: 70,
            memory: 65,
            disk: 82,
          },
          {
            id: 'db-mysql-dc1-replica',
            type: 'database',
            status: 'online',
            cpu: 30,
            memory: 35,
            disk: 40,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 25,
            memory: 83,
            disk: 20,
          },
          {
            id: 'cache-redis-dc1-02',
            type: 'cache',
            status: 'warning',
            cpu: 28,
            memory: 81,
            disk: 22,
          },
          {
            id: 'cache-redis-dc1-03',
            type: 'cache',
            status: 'online',
            cpu: 20,
            memory: 45,
            disk: 18,
          },
        ],
      };

      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest(
          'DB 서버와 cache 서버 중 경고 상태 서버가 더 많은 쪽은?',
          snapshot
        )
      );
      expect(parsed).toMatchObject({
        intent: 'server_health',
        sourceIntent: 'group-health-compare',
        statusFilter: 'warning',
        groupTargets: expect.arrayContaining(['database', 'cache']),
      });

      const evidence = await monitoringServerHealthEvidenceProvider.resolve(
        createEvidenceRequest(
          'DB 서버와 cache 서버 중 경고 상태 서버가 더 많은 쪽은?',
          snapshot
        )
      );
      expect(evidence?.fallback).toContain('warning 상태 서버 수 비교');
      expect(evidence?.fallback).toContain('DB 서버 1대');
      expect(evidence?.fallback).toContain('캐시 서버 2대');
      expect(evidence?.fallback).toContain(
        '캐시 서버가 DB 서버보다 warning 상태 서버가 1대 더 많습니다.'
      );
      expect(evidence?.fallback).not.toContain('위험 신호');
    });

    it('Q-NEW121: routes fast-growing disk questions to deterministic trend ranking', async () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('디스크 사용률이 가장 빠르게 증가하고 있는 서버는?')
      );

      expect(parsed).toMatchObject({
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        sourceIntent: 'ranking-trend',
        metric: 'disk',
        trendRankBy: 'delta',
      });
    });

    it('Q-NEW122: compares warning counts for DB and cache groups even when status is classified as a metric', async () => {
      const snapshot = {
        timeLabel: '01:30',
        servers: [
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'warning',
            cpu: 70,
            memory: 65,
            disk: 82,
          },
          {
            id: 'db-mysql-dc1-replica',
            type: 'database',
            status: 'online',
            cpu: 30,
            memory: 35,
            disk: 40,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'warning',
            cpu: 25,
            memory: 83,
            disk: 20,
          },
          {
            id: 'cache-redis-dc1-02',
            type: 'cache',
            status: 'warning',
            cpu: 28,
            memory: 81,
            disk: 22,
          },
        ],
      };

      const request = createEvidenceRequest(
        'DB 서버 그룹과 cache 서버 그룹 중 어느 쪽에 경고가 더 많아?',
        snapshot
      );
      const parsed = parseCurrentMetricsEvidenceRequest(request);
      expect(parsed).toMatchObject({
        intent: 'server_health',
        sourceIntent: 'group-health-compare',
        statusFilter: 'warning',
        groupTargets: expect.arrayContaining(['database', 'cache']),
      });

      const evidence =
        await monitoringServerHealthEvidenceProvider.resolve(request);
      expect(evidence?.fallback).toContain('warning 상태 서버 수 비교');
      expect(evidence?.fallback).toContain('DB 서버 1대');
      expect(evidence?.fallback).toContain('캐시 서버 2대');
    });

    it('P27: preserves the < operator for multi-metric AND threshold filters', async () => {
      const snapshot = {
        timeLabel: '01:30',
        servers: [
          {
            id: 'lb-haproxy-dc1-01',
            type: 'loadbalancer',
            status: 'online',
            cpu: 20,
            memory: 30,
            disk: 25,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 40,
            memory: 45,
            disk: 49,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 60,
            memory: 45,
            disk: 40,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'warning',
            cpu: 40,
            memory: 45,
            disk: 55,
          },
        ],
      };

      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest(
          '전체 서버 중 CPU·메모리·디스크 모두 50% 미만인 서버 몇 대야?',
          snapshot
        )
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'multi-metric-filter',
        metrics: expect.arrayContaining(['cpu', 'memory', 'disk']),
        threshold: 50,
        thresholdOperator: '<',
        filterOperator: 'AND',
      });

      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
        createEvidenceRequest(
          '전체 서버 중 CPU·메모리·디스크 모두 50% 미만인 서버 몇 대야?',
          snapshot
        )
      );
      expect(evidence?.fallback).toContain(
        'CPU + 메모리 + 디스크 50% 미만 서버'
      );
      expect(evidence?.fallback).toContain('전체 서버 중 2대');
      expect(evidence?.fallback).toContain('lb-haproxy-dc1-01');
      expect(evidence?.fallback).toContain('web-nginx-dc1-01');
      expect(evidence?.fallback).not.toContain('api-was-dc1-01');
      expect(evidence?.fallback).not.toContain('storage-nfs-dc1-01');
      expect(evidence?.fallback).not.toContain('합산 내림차순');
    });

    it('P28: filters by one metric warning threshold before averaging another metric', async () => {
      const snapshot = {
        timeLabel: '01:30',
        servers: [
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'warning',
            cpu: 82,
            memory: 60,
            disk: 50,
          },
          {
            id: 'api-was-dc1-02',
            type: 'application',
            status: 'online',
            cpu: 88,
            memory: 55,
            disk: 70,
          },
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'warning',
            cpu: 35,
            memory: 45,
            disk: 90,
          },
        ],
      };

      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('CPU 경고 서버들의 평균 디스크는?', snapshot)
      );
      expect(parsed).toMatchObject({
        intent: 'metric_current',
        sourceIntent: 'cross-metric-condition-aggregate',
        metric: 'disk',
        filterConditions: [
          {
            metric: 'cpu',
            operator: '>=',
            threshold: 80,
            inferredThreshold: true,
          },
        ],
      });

      const evidence = await monitoringMetricCurrentEvidenceProvider.resolve(
        createEvidenceRequest('CPU 경고 서버들의 평균 디스크는?', snapshot)
      );
      expect(evidence?.fallback).toContain('CPU >= 80%');
      expect(evidence?.fallback).toContain('평균 디스크: 60%');
      expect(evidence?.fallback).toContain('api-was-dc1-01');
      expect(evidence?.fallback).toContain('api-was-dc1-02');
      expect(evidence?.fallback).not.toContain('storage-nfs-dc1-01');
    });

    it('P29: returns both top and bottom metric rankings in one deterministic answer', async () => {
      const snapshot = {
        timeLabel: '01:30',
        servers: [
          {
            id: 'storage-nfs-dc1-01',
            type: 'storage',
            status: 'warning',
            cpu: 20,
            memory: 40,
            disk: 91,
          },
          {
            id: 'db-mysql-dc1-primary',
            type: 'database',
            status: 'online',
            cpu: 40,
            memory: 60,
            disk: 82,
          },
          {
            id: 'backup-dc1-01',
            type: 'backup',
            status: 'online',
            cpu: 30,
            memory: 50,
            disk: 73,
          },
          {
            id: 'web-nginx-dc1-01',
            type: 'web',
            status: 'online',
            cpu: 15,
            memory: 35,
            disk: 20,
          },
          {
            id: 'api-was-dc1-01',
            type: 'application',
            status: 'online',
            cpu: 50,
            memory: 55,
            disk: 34,
          },
          {
            id: 'cache-redis-dc1-01',
            type: 'cache',
            status: 'online',
            cpu: 25,
            memory: 45,
            disk: 41,
          },
        ],
      };

      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('디스크 기준 상위3+하위3 서버 알려줘', snapshot)
      );
      expect(parsed).toMatchObject({
        intent: 'metric_ranking',
        sourceIntent: 'data-ranking',
        metric: 'disk',
        rankCount: 3,
        rankRange: 'top-bottom',
      });

      const evidence = await monitoringMetricRankingEvidenceProvider.resolve(
        createEvidenceRequest('디스크 기준 상위3+하위3 서버 알려줘', snapshot)
      );
      expect(evidence?.fallback).toContain('디스크 사용률 상위 3대 + 하위 3대');
      expect(evidence?.fallback).toContain('디스크 상위 3대');
      expect(evidence?.fallback).toContain('디스크 하위 3대');
      expect(evidence?.fallback).toContain('storage-nfs-dc1-01');
      expect(evidence?.fallback).toContain('db-mysql-dc1-primary');
      expect(evidence?.fallback).toContain('backup-dc1-01');
      expect(evidence?.fallback).toContain('web-nginx-dc1-01');
      expect(evidence?.fallback).toContain('api-was-dc1-01');
      expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    });
  });
});
