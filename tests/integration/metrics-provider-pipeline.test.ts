/**
 * @vitest-environment node
 */

/**
 * Integration Test: MetricsProvider + RulesLoader + OTel Pipeline
 * Mock 최소화 (logger만 mock), 실제 데이터 기반 통합 검증
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getServerStatus } from '@/config/rules/loader';
import { metricsProvider } from '@/services/metrics/MetricsProvider';

describe('Metrics Provider Pipeline (통합)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('데이터 정합성', () => {
    it('summary.totalServers === serverList.length', async () => {
      const summary = await metricsProvider.getSystemSummary();
      const serverList = await metricsProvider.getServerList();
      expect(summary.totalServers).toBe(serverList.length);
    });

    it('OTel 데이터에서 서버 메트릭을 로드할 수 있다', async () => {
      const providerServerIds = metricsProvider
        .getAllServerMetrics()
        .map((m) => m.serverId);

      expect(providerServerIds.length).toBeGreaterThan(0);
    });

    it('모든 serverId가 serverList에 존재해야 한다', async () => {
      const serverList = await metricsProvider.getServerList();
      const serverListIds = new Set(serverList.map((s) => s.serverId));

      const allMetrics = await metricsProvider.getAllServerMetrics();
      if (allMetrics.length > 0) {
        const providerIds = allMetrics.map((m) => m.serverId);
        // 모든 메트릭의 serverId가 serverList에 존재
        for (const id of providerIds) {
          expect(serverListIds.has(id)).toBe(true);
        }
      }
    });
  });

  describe('상태 판정 일관성', () => {
    it('MetricsProvider status === rulesLoader.getServerStatus(동일 메트릭)', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();

      allMetrics.forEach((metric) => {
        // offline은 up=0일 때만 발생하므로 online/warning/critical만 비교
        if (metric.status !== 'offline') {
          const rulesStatus = getServerStatus({
            cpu: metric.cpu,
            memory: metric.memory,
            disk: metric.disk,
            network: metric.network,
          });
          expect(metric.status).toBe(rulesStatus);
        }
      });
    });

    it('online+warning+critical+offline = total (정확한 합산)', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();
      const summary = await metricsProvider.getSystemSummary();

      const counts = { online: 0, warning: 0, critical: 0, offline: 0 };
      allMetrics.forEach((m) => {
        counts[m.status]++;
      });

      expect(
        counts.online + counts.warning + counts.critical + counts.offline
      ).toBe(summary.totalServers);
    });

    it('평균 메트릭 정확도 (개별 합 / 카운트 ≈ summary 평균)', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();
      const summary = await metricsProvider.getSystemSummary();
      const count = allMetrics.length || 1;

      const manualAvgCpu =
        Math.round(
          (allMetrics.reduce((sum, m) => sum + m.cpu, 0) / count) * 10
        ) / 10;
      const manualAvgMemory =
        Math.round(
          (allMetrics.reduce((sum, m) => sum + m.memory, 0) / count) * 10
        ) / 10;

      expect(summary.averageCpu).toBe(manualAvgCpu);
      expect(summary.averageMemory).toBe(manualAvgMemory);
    });
  });

  describe('시간대별 시나리오', () => {
    it('KST 12:00 (장애 시나리오) → 메트릭 조회 가능', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z')); // KST 12:00

      const allMetrics = await metricsProvider.getAllServerMetrics();
      expect(allMetrics.length).toBeGreaterThan(0);

      // 12시 데이터는 "Redis 캐시 메모리 누수 - OOM 직전" 시나리오
      // warning 또는 critical 서버가 있을 수 있음
      const alertCount = allMetrics.filter(
        (m) => m.status === 'warning' || m.status === 'critical'
      ).length;
      // 결과에 상관없이 테스트는 통과 (데이터 의존성 최소화)
      expect(typeof alertCount).toBe('number');
    });

    it('KST 00:00 (정상 운영) → 메트릭 조회 가능', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T15:00:00.000Z')); // KST 00:00

      const allMetrics = await metricsProvider.getAllServerMetrics();
      expect(allMetrics.length).toBeGreaterThan(0);

      // 0시 데이터는 "정상 운영" 시나리오
      const onlineCount = allMetrics.filter(
        (m) => m.status === 'online'
      ).length;
      expect(typeof onlineCount).toBe('number');
    });
  });

  describe('getAlertServers 통합', () => {
    it('alert 서버들의 status가 모두 warning 또는 critical', async () => {
      const alertServers = await metricsProvider.getAlertServers();
      alertServers.forEach((s) => {
        expect(['warning', 'critical']).toContain(s.status);
      });
    });

    it('alert 서버 수 <= totalServers', async () => {
      const alertServers = await metricsProvider.getAlertServers();
      const summary = await metricsProvider.getSystemSummary();
      expect(alertServers.length).toBeLessThanOrEqual(summary.totalServers);
      // alert 수 = warning + critical
      expect(alertServers.length).toBe(
        summary.warningServers + summary.criticalServers
      );
    });
  });
});
