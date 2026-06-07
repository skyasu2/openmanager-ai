import { describe, expect, it } from 'vitest';
import { MONITORING_METRIC_TREND_CAPABILITY_ID } from './constants';
import {
  monitoringMetricTrendEvidenceProvider,
  parseCurrentMetricsEvidenceRequest,
} from './current-metrics-evidence-provider';
import { createEvidenceRequest } from './current-metrics-evidence-test-helpers';

describe('current metrics domain evidence providers: trend routing regressions', () => {
  describe('trend-routing: 상승/하락 트렌드 표현이 metric_trend intent로 라우팅', () => {
    const trendServers = [
      { id: 'cache-redis-dc1-01', type: 'cache', status: 'critical', cpu: 19, memory: 92, disk: 22 },
      { id: 'api-was-dc1-01', type: 'application', status: 'online', cpu: 63, memory: 55, disk: 30 },
    ];

    it.each([
      ['메모리 트렌드 상승 서버', 'memory'],
      ['최근 메모리 사용량이 계속 올라가는 서버 있어?', 'memory'],
      ['CPU가 계속 상승 중인 서버 알려줘', 'cpu'],
      ['디스크 사용량이 꾸준히 늘어나는 서버는?', 'disk'],
      ['메모리가 점점 높아지고 있는 서버', 'memory'],
      ['CPU 사용률이 지속적으로 상승하는 서버', 'cpu'],
    ])('"%s" → metric_trend (metric=%s)', (query, expectedMetric) => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest(query, { servers: trendServers })
      );
      expect(parsed).toMatchObject({
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        metric: expectedMetric,
      });
    });

    it('메모리 임계값 쿼리는 metric_trend로 분류되지 않음', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('메모리 70% 이상인 서버는?', { servers: trendServers })
      );
      expect(parsed?.intent).not.toBe('metric_trend');
    });

    it('"계속" 운영 명령은 metric_trend로 분류되지 않음', () => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest('서버를 계속 모니터링해줘', { servers: trendServers })
      );
      expect(parsed?.intent).not.toBe('metric_trend');
    });

    // P19a: 증가율/상승률/많이 증가한 표현이 metric_trend로 라우팅 (math intent 우회 방지)
    it.each([
      ['네트워크 트래픽이 가장 많이 증가한 서버 3개', 'network'],
      ['CPU 증가율이 가장 높은 서버 알려줘', 'cpu'],
      ['최근 CPU 증가율이 가장 높은 서버 알려줘', 'cpu'],
      ['메모리 상승률 상위 서버 보여줘', 'memory'],
      ['디스크 사용량이 많이 증가한 서버는?', 'disk'],
    ])('P19a "%s" → metric_trend (metric=%s)', (query, expectedMetric) => {
      const parsed = parseCurrentMetricsEvidenceRequest(
        createEvidenceRequest(query, { servers: trendServers })
      );
      expect(parsed?.intent).toBe('metric_trend');
      if (parsed?.intent === 'metric_trend') {
        const metrics = parsed.metric ? [parsed.metric] : (parsed.metrics ?? []);
        expect(metrics).toContain(expectedMetric);
      }
    });

    it('P19c: 증가율 랭킹은 현재값이 아니라 24h 평균 대비 delta 기준으로 정렬', async () => {
      const request = createEvidenceRequest(
        'CPU 증가율이 가장 높은 서버 3개 알려줘',
        {
          timeLabel: '22:50',
          servers: [
            {
              id: 'api-was-dc1-01',
              type: 'application',
              status: 'online',
              cpu: 65,
              memory: 55,
              disk: 30,
            },
            {
              id: 'web-nginx-dc1-01',
              type: 'web',
              status: 'online',
              cpu: 50,
              memory: 44,
              disk: 29,
            },
            {
              id: 'cache-redis-dc1-01',
              type: 'cache',
              status: 'online',
              cpu: 40,
              memory: 60,
              disk: 24,
            },
          ],
        }
      );

      expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        metric: 'cpu',
        rankCount: 3,
        trendRankBy: 'delta',
      });

      const evidence = await monitoringMetricTrendEvidenceProvider.resolve(
        request
      );

      expect(evidence?.metadata).toMatchObject({
        intent: 'metric_trend',
        metric: 'cpu',
        rankCount: 3,
        trendRankBy: 'delta',
      });
      expect(evidence?.fallback).toContain('CPU 증가폭 상위 3대');
      expect(evidence?.fallback).toMatch(
        /1\. \*\*web-nginx-dc1-01\*\*[\s\S]+2\. \*\*cache-redis-dc1-01\*\*[\s\S]+3\. \*\*api-was-dc1-01\*\*/
      );
    });

    it('P20: 증가 조건 만족 서버가 없어도 delta 랭킹을 제공한다', async () => {
      const request = createEvidenceRequest(
        'CPU 증가율이 가장 높은 서버 3개 알려줘',
        {
          timeLabel: '13:40',
          servers: [
            {
              id: 'api-was-dc1-01',
              type: 'application',
              status: 'online',
              cpu: 1,
              memory: 55,
              disk: 30,
            },
            {
              id: 'web-nginx-dc1-01',
              type: 'web',
              status: 'online',
              cpu: 1,
              memory: 44,
              disk: 29,
            },
            {
              id: 'cache-redis-dc1-01',
              type: 'cache',
              status: 'online',
              cpu: 1,
              memory: 60,
              disk: 24,
            },
          ],
        }
      );

      const evidence = await monitoringMetricTrendEvidenceProvider.resolve(
        request
      );

      expect(evidence?.fallback).toContain(
        '상승 조건을 만족하는 서버는 없습니다'
      );
      expect(evidence?.fallback).toContain('CPU 증가폭 상위 3대');
      expect(evidence?.fallback).toContain('api-was-dc1-01');
      expect(evidence?.fallback).toContain('web-nginx-dc1-01');
      expect(evidence?.fallback).toContain('cache-redis-dc1-01');
    });

    it('P21: trend + threshold 쿼리는 현재 임계값과 24h 증가 조건을 함께 적용', async () => {
      const request = createEvidenceRequest(
        '디스크 70% 이상이면서 24h 증가한 서버 알려줘',
        {
          timeLabel: '22:50',
          servers: [
            {
              id: 'storage-nfs-dc1-01',
              type: 'storage',
              status: 'warning',
              cpu: 22,
              memory: 55,
              disk: 86,
            },
            {
              id: 'db-mysql-dc1-primary',
              type: 'database',
              status: 'warning',
              cpu: 53,
              memory: 65,
              disk: 82,
            },
            {
              id: 'db-mysql-dc1-backup',
              type: 'database',
              status: 'online',
              cpu: 18,
              memory: 34,
              disk: 72,
            },
            {
              id: 'web-nginx-dc1-01',
              type: 'web',
              status: 'online',
              cpu: 36,
              memory: 45,
              disk: 60,
            },
          ],
        }
      );

      expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        metric: 'disk',
        threshold: 70,
        thresholdOperator: '>=',
        trendDirection: 'increase',
      });

      const evidence = await monitoringMetricTrendEvidenceProvider.resolve(
        request
      );

      expect(evidence?.metadata).toMatchObject({
        intent: 'metric_trend',
        metric: 'disk',
        threshold: 70,
        thresholdOperator: '>=',
        trendDirection: 'increase',
      });
      expect(evidence?.fallback).toContain('조건: 디스크 >= 70%');
      expect(evidence?.fallback).toContain('추세 조건: 24h 평균 대비 상승');
      expect(evidence?.fallback).toContain('storage-nfs-dc1-01');
      expect(evidence?.fallback).toContain('db-mysql-dc1-primary');
      expect(evidence?.fallback).not.toContain('db-mysql-dc1-backup');
      expect(evidence?.fallback).not.toContain('web-nginx-dc1-01');
    });

    it('P21: trend + threshold 결과가 0대여도 deterministic trend evidence로 fail-open하지 않음', async () => {
      const request = createEvidenceRequest(
        '디스크 70% 이상이면서 24h 증가한 서버 알려줘',
        {
          timeLabel: '07:10',
          servers: [
            {
              id: 'db-mysql-dc1-backup',
              type: 'database',
              status: 'online',
              cpu: 18,
              memory: 34,
              disk: 69,
            },
            {
              id: 'web-nginx-dc1-01',
              type: 'web',
              status: 'online',
              cpu: 36,
              memory: 45,
              disk: 29,
            },
          ],
        }
      );

      expect(parseCurrentMetricsEvidenceRequest(request)).toMatchObject({
        intent: 'metric_trend',
        capabilityId: MONITORING_METRIC_TREND_CAPABILITY_ID,
        metric: 'disk',
        threshold: 70,
        thresholdOperator: '>=',
        trendDirection: 'increase',
      });

      const evidence = await monitoringMetricTrendEvidenceProvider.resolve(
        request
      );

      expect(evidence).toMatchObject({
        id: 'monitoring-metric-trend',
        metadata: {
          responsePolicy: 'deterministic_answer',
          intent: 'metric_trend',
          metric: 'disk',
          threshold: 70,
          thresholdOperator: '>=',
          trendDirection: 'increase',
        },
      });
      expect(evidence?.fallback).toContain('조건: 디스크 >= 70%');
      expect(evidence?.fallback).toContain('추세 조건: 24h 평균 대비 상승');
      expect(evidence?.fallback).toContain(
        '조건을 동시에 만족하는 서버는 없습니다'
      );
      expect(evidence?.fallback).not.toContain('DISK 사용률 70% 이상 서버');
    });
  });
});
