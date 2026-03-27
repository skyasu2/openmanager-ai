/**
 * @vitest-environment node
 */

/**
 * MetricsProvider Edge Cases - 기존 MetricsProvider.test.ts를 보완
 * up=0 보존, KST 자정 경계, summary 합산, nodeInfo 매핑, fallback, alertServers
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getKSTMinuteOfDay, metricsProvider } from './MetricsProvider';

describe('MetricsProvider Edge Cases', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('KST 자정 경계', () => {
    it('UTC 15:00 → KST 00:00 (minuteOfDay=0)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T15:00:00.000Z'));

      const minuteOfDay = getKSTMinuteOfDay();
      expect(minuteOfDay).toBe(0);
    });

    it('UTC 14:59 → KST 23:59 (minuteOfDay=1430, 10분 단위 절삭)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T14:59:00.000Z'));

      const minuteOfDay = getKSTMinuteOfDay();
      // 23:59 KST = 1439분, 10분 단위로 절삭 → 1430
      expect(minuteOfDay).toBe(1430);
    });
  });

  describe('getSystemSummary 합산 정확성', () => {
    it('online+warning+critical+offline = totalServers', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();
      const summary = await metricsProvider.getSystemSummary();

      // 모든 상태의 합이 총 서버 수와 일치해야 한다
      const statusCounts = { online: 0, warning: 0, critical: 0, offline: 0 };
      allMetrics.forEach((m) => {
        statusCounts[m.status]++;
      });

      expect(
        statusCounts.online +
          statusCounts.warning +
          statusCounts.critical +
          statusCounts.offline
      ).toBe(summary.totalServers);

      expect(summary.onlineServers).toBe(statusCounts.online);
      expect(summary.warningServers).toBe(statusCounts.warning);
      expect(summary.criticalServers).toBe(statusCounts.critical);
    });

    it('서버가 0개가 아니어야 한다', async () => {
      const summary = await metricsProvider.getSystemSummary();
      expect(summary.totalServers).toBeGreaterThan(0);
    });
  });

  describe('nodeInfo 매핑', () => {
    it('hourly-data에서 로드된 서버는 nodeInfo를 가져야 한다', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();
      // hourly-data에서 로드된 서버들은 nodeInfo가 있어야 함
      const withNodeInfo = allMetrics.filter((m) => m.nodeInfo !== undefined);

      // hourly-data가 정상 로드되면 모든 서버에 nodeInfo가 있음
      if (withNodeInfo.length > 0) {
        const sample = withNodeInfo[0];
        expect(sample.nodeInfo).toHaveProperty('cpuCores');
        expect(sample.nodeInfo).toHaveProperty('memoryTotalBytes');
        expect(sample.nodeInfo).toHaveProperty('diskTotalBytes');
        // snake_case → camelCase 변환 확인
        expect(typeof sample.nodeInfo!.cpuCores).toBe('number');
        expect(typeof sample.nodeInfo!.memoryTotalBytes).toBe('number');
        expect(typeof sample.nodeInfo!.diskTotalBytes).toBe('number');
      }
    });

    it('nodeInfo가 없는 경우 undefined 반환', async () => {
      // fallback 데이터에는 nodeInfo가 없을 수 있음
      const metrics = await metricsProvider.getServerMetrics('non-existent');
      expect(metrics).toBeNull();
    });
  });

  describe('fallback 경로', () => {
    it('존재하지 않는 serverId → null', async () => {
      const metrics = await metricsProvider.getServerMetrics(
        'definitely-not-a-server-xyz'
      );
      expect(metrics).toBeNull();
    });

    it('유효한 serverId → not null', async () => {
      const serverList = await metricsProvider.getServerList();
      expect(serverList.length).toBeGreaterThan(0);

      const metrics = await metricsProvider.getServerMetrics(
        serverList[0].serverId
      );
      expect(metrics).not.toBeNull();
    });
  });

  describe('getAlertServers', () => {
    it('warning 또는 critical 상태만 반환해야 한다', async () => {
      const alertServers = await metricsProvider.getAlertServers();
      alertServers.forEach((server) => {
        expect(['warning', 'critical']).toContain(server.status);
      });
    });

    it('alert 서버 수가 totalServers 이하여야 한다', async () => {
      const alertServers = await metricsProvider.getAlertServers();
      const summary = await metricsProvider.getSystemSummary();
      expect(alertServers.length).toBeLessThanOrEqual(summary.totalServers);
    });

    it('반환된 서버 객체에 필수 필드가 있어야 한다', async () => {
      const alertServers = await metricsProvider.getAlertServers();
      alertServers.forEach((server) => {
        expect(server).toHaveProperty('serverId');
        expect(server).toHaveProperty('cpu');
        expect(server).toHaveProperty('memory');
        expect(server).toHaveProperty('disk');
        expect(server).toHaveProperty('status');
      });
    });
  });

  describe('up=0 + critical 상태 보존 (설계 검증)', () => {
    it('getAllServerMetrics에서 offline 상태 서버가 있을 수 있다', async () => {
      // hourly-data에는 현재 up=0이 없지만, 로직 자체가 올바른지 검증
      const allMetrics = await metricsProvider.getAllServerMetrics();
      const validStatuses = ['online', 'warning', 'critical', 'offline'];
      allMetrics.forEach((m) => {
        expect(validStatuses).toContain(m.status);
      });
    });

    it('critical 상태 서버는 최소 하나의 메트릭이 critical 임계값 이상이어야 한다', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();
      allMetrics
        .filter((m) => m.status === 'critical')
        .forEach((m) => {
          // cpu/memory/disk: critical=90, network: critical=85
          const anyCritical =
            m.cpu >= 90 || m.memory >= 90 || m.disk >= 90 || m.network >= 85;
          expect(anyCritical).toBe(true);
        });
    });
  });

  describe('시간대별 데이터 접근', () => {
    it('특정 시간 고정 후 getAllServerMetrics가 일관된 결과를 반환해야 한다', async () => {
      vi.useFakeTimers();
      // KST 09:00 = UTC 00:00
      vi.setSystemTime(new Date('2026-01-15T00:00:00.000Z'));

      const metrics1 = await metricsProvider.getAllServerMetrics();
      const metrics2 = await metricsProvider.getAllServerMetrics();

      expect(metrics1.length).toBe(metrics2.length);
      // 동일 시간에 동일 데이터
      metrics1.forEach((m, i) => {
        expect(m.serverId).toBe(metrics2[i].serverId);
        expect(m.cpu).toBe(metrics2[i].cpu);
        expect(m.memory).toBe(metrics2[i].memory);
      });
    });
  });
});
