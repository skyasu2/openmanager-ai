/**
 * @vitest-environment node
 */

/**
 * 🎯 MetricsProvider - Unit Tests
 *
 * @description
 * Tests for KST-based fixed metrics data provider (Single Source of Truth)
 *
 * @date 2025-12-22
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getKSTMinuteOfDay,
  getKSTTimestamp,
  MetricsProvider,
  metricsProvider,
} from './MetricsProvider';

describe('MetricsProvider', () => {
  // Codex Review: afterEach로 fake timer 복구 보장
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getKSTMinuteOfDay', () => {
    it('should return a multiple of 10 (10-minute slots)', async () => {
      const minuteOfDay = getKSTMinuteOfDay();
      expect(minuteOfDay % 10).toBe(0);
    });

    it('should return value between 0 and 1430 (inclusive)', async () => {
      const minuteOfDay = getKSTMinuteOfDay();
      expect(minuteOfDay).toBeGreaterThanOrEqual(0);
      expect(minuteOfDay).toBeLessThanOrEqual(1430); // 23:50 = 1430
    });

    it('should calculate correct KST offset from UTC', async () => {
      // Mock a specific UTC time (e.g., 00:00 UTC = 09:00 KST)
      const mockDate = new Date('2025-12-22T00:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const minuteOfDay = getKSTMinuteOfDay();
      // 09:00 KST = 540 minutes, rounded to 10-min = 540
      expect(minuteOfDay).toBe(540);
      // afterEach에서 vi.useRealTimers() 자동 호출
    });

    it('should handle day boundary correctly', async () => {
      // Mock 23:55 KST (14:55 UTC)
      const mockDate = new Date('2025-12-22T14:55:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const minuteOfDay = getKSTMinuteOfDay();
      // 23:55 KST = 1435 minutes, rounded down to 1430
      expect(minuteOfDay).toBe(1430);
      // afterEach에서 vi.useRealTimers() 자동 호출
    });
  });

  describe('getKSTTimestamp', () => {
    it('should return ISO 8601 format with KST offset', async () => {
      const timestamp = getKSTTimestamp();
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(timestamp).toContain('+09:00');
    });

    it('should not contain Z (UTC indicator)', async () => {
      const timestamp = getKSTTimestamp();
      expect(timestamp).not.toContain('Z');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', async () => {
      const instance1 = MetricsProvider.getInstance();
      const instance2 = MetricsProvider.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should match exported singleton', async () => {
      const instance = MetricsProvider.getInstance();
      expect(instance).toBe(metricsProvider);
    });
  });

  describe('getServerList', () => {
    it('should return array of servers', async () => {
      const serverList = await metricsProvider.getServerList();
      expect(Array.isArray(serverList)).toBe(true);
      expect(serverList.length).toBeGreaterThan(0);
    });

    it('should have correct server structure', async () => {
      const serverList = await metricsProvider.getServerList();
      const server = serverList[0];

      expect(server).toHaveProperty('serverId');
      expect(server).toHaveProperty('serverType');
      expect(server).toHaveProperty('location');

      expect(typeof server.serverId).toBe('string');
      expect(typeof server.serverType).toBe('string');
      expect(typeof server.location).toBe('string');
    });

    it('should have unique server IDs', async () => {
      const serverList = await metricsProvider.getServerList();
      const serverIds = serverList.map((s) => s.serverId);
      const uniqueIds = new Set(serverIds);
      expect(uniqueIds.size).toBe(serverIds.length);
    });
  });

  describe('getServerMetrics', () => {
    it('should return null for non-existent server', async () => {
      const metrics = await metricsProvider.getServerMetrics(
        'non-existent-server'
      );
      expect(metrics).toBeNull();
    });

    it('should return valid metrics for existing server', async () => {
      const serverList = await metricsProvider.getServerList();
      const firstServerId = serverList[0].serverId;

      const metrics = await metricsProvider.getServerMetrics(firstServerId);
      expect(metrics).not.toBeNull();

      if (metrics) {
        expect(metrics.serverId).toBe(firstServerId);
        expect(typeof metrics.cpu).toBe('number');
        expect(typeof metrics.memory).toBe('number');
        expect(typeof metrics.disk).toBe('number');
        expect(typeof metrics.network).toBe('number');
        expect(['online', 'warning', 'critical', 'offline']).toContain(
          metrics.status
        );
      }
    });

    it('should have metrics in valid range (0-100)', async () => {
      const serverList = await metricsProvider.getServerList();
      const metrics = await metricsProvider.getServerMetrics(
        serverList[0].serverId
      );

      if (metrics) {
        expect(metrics.cpu).toBeGreaterThanOrEqual(0);
        expect(metrics.cpu).toBeLessThanOrEqual(100);
        expect(metrics.memory).toBeGreaterThanOrEqual(0);
        expect(metrics.memory).toBeLessThanOrEqual(100);
        expect(metrics.disk).toBeGreaterThanOrEqual(0);
        expect(metrics.disk).toBeLessThanOrEqual(100);
        expect(metrics.network).toBeGreaterThanOrEqual(0);
        expect(metrics.network).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('getAllServerMetrics', () => {
    it('should return metrics for all servers', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();
      const serverList = await metricsProvider.getServerList();

      expect(allMetrics.length).toBe(serverList.length);
    });

    it('should have consistent timestamp across all metrics', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();

      if (allMetrics.length > 1) {
        const firstTimestamp = allMetrics[0].timestamp;
        const firstMinuteOfDay = allMetrics[0].minuteOfDay;

        allMetrics.forEach((metric) => {
          // Timestamps should be close (within same second)
          expect(metric.timestamp.substring(0, 19)).toBe(
            firstTimestamp.substring(0, 19)
          );
          expect(metric.minuteOfDay).toBe(firstMinuteOfDay);
        });
      }
    });
  });

  describe('getSystemSummary', () => {
    it('should return valid summary structure', async () => {
      const summary = await metricsProvider.getSystemSummary();

      expect(summary).toHaveProperty('timestamp');
      expect(summary).toHaveProperty('minuteOfDay');
      expect(summary).toHaveProperty('totalServers');
      expect(summary).toHaveProperty('onlineServers');
      expect(summary).toHaveProperty('warningServers');
      expect(summary).toHaveProperty('criticalServers');
      expect(summary).toHaveProperty('averageCpu');
      expect(summary).toHaveProperty('averageMemory');
      expect(summary).toHaveProperty('averageDisk');
      expect(summary).toHaveProperty('averageNetwork');
    });

    it('should have correct server count', async () => {
      const summary = await metricsProvider.getSystemSummary();
      const serverList = await metricsProvider.getServerList();

      expect(summary.totalServers).toBe(serverList.length);
    });

    it('should have status counts that sum to total', async () => {
      const summary = await metricsProvider.getSystemSummary();

      const statusSum =
        summary.onlineServers +
        summary.warningServers +
        summary.criticalServers;
      // Note: offline is excluded from these counts
      expect(statusSum).toBeLessThanOrEqual(summary.totalServers);
    });

    it('should have average metrics in valid range', async () => {
      const summary = await metricsProvider.getSystemSummary();

      expect(summary.averageCpu).toBeGreaterThanOrEqual(0);
      expect(summary.averageCpu).toBeLessThanOrEqual(100);
      expect(summary.averageMemory).toBeGreaterThanOrEqual(0);
      expect(summary.averageMemory).toBeLessThanOrEqual(100);
      expect(summary.averageDisk).toBeGreaterThanOrEqual(0);
      expect(summary.averageDisk).toBeLessThanOrEqual(100);
      expect(summary.averageNetwork).toBeGreaterThanOrEqual(0);
      expect(summary.averageNetwork).toBeLessThanOrEqual(100);
    });
  });

  describe('getMetricsAtTime', () => {
    it('should return null for non-existent server', async () => {
      const metrics = await metricsProvider.getMetricsAtTime(
        'non-existent-server',
        540
      );
      expect(metrics).toBeNull();
    });

    it('should return metrics for valid server and time slot', async () => {
      const serverList = await metricsProvider.getServerList();
      const firstServerId = serverList[0].serverId;

      // 현재 시간대의 슬롯으로 테스트 (데이터 존재 보장)
      const currentMinuteOfDay = getKSTMinuteOfDay();
      const metrics = await metricsProvider.getMetricsAtTime(
        firstServerId,
        currentMinuteOfDay
      );

      // Codex Review: 정상 경로 검증 강화
      expect(metrics).not.toBeNull();
      if (metrics) {
        expect(typeof metrics.cpu).toBe('number');
        expect(typeof metrics.memory).toBe('number');
        expect(typeof metrics.disk).toBe('number');
        expect(typeof metrics.network).toBe('number');
        expect(metrics.cpu).toBeGreaterThanOrEqual(0);
        expect(metrics.cpu).toBeLessThanOrEqual(100);
      }
    });

    it('should return null for invalid time slot', async () => {
      const serverList = await metricsProvider.getServerList();
      const firstServerId = serverList[0].serverId;

      // 유효하지 않은 시간대 (1440 이상)
      const metrics = await metricsProvider.getMetricsAtTime(
        firstServerId,
        9999
      );
      expect(metrics).toBeNull();
    });
  });

  describe('getTimeInfo', () => {
    it('should return debug time information', async () => {
      const timeInfo = metricsProvider.getTimeInfo();

      expect(timeInfo).toHaveProperty('kstTime');
      expect(timeInfo).toHaveProperty('minuteOfDay');
      expect(timeInfo).toHaveProperty('slotIndex');
      expect(timeInfo).toHaveProperty('humanReadable');
    });

    it('should have consistent minuteOfDay with getKSTMinuteOfDay', async () => {
      const timeInfo = metricsProvider.getTimeInfo();
      const minuteOfDay = getKSTMinuteOfDay();

      expect(timeInfo.minuteOfDay).toBe(minuteOfDay);
    });

    it('should have correct slotIndex calculation', async () => {
      const timeInfo = metricsProvider.getTimeInfo();

      // slotIndex = Math.floor((minuteOfDay % 60) / 10) — 10분 단위 슬롯 (0-5)
      expect(timeInfo.slotIndex).toBe(
        Math.floor((timeInfo.minuteOfDay % 60) / 10)
      );
    });

    it('should have valid humanReadable format (HH:MM KST)', async () => {
      const timeInfo = metricsProvider.getTimeInfo();

      expect(timeInfo.humanReadable).toMatch(/^\d{2}:\d{2} KST$/);
    });
  });

  describe('Status Determination', () => {
    // Codex Review: 상태 판정 로직을 실제 데이터와 무관하게 검증

    it('should have valid status for all servers', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();
      const validStatuses = ['online', 'warning', 'critical', 'offline'];

      // 최소 1개 이상의 서버 메트릭 존재 확인
      expect(allMetrics.length).toBeGreaterThan(0);

      allMetrics.forEach((metric) => {
        expect(validStatuses).toContain(metric.status);
      });
    });

    it('should mark as critical when any metric >= 90%', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();
      let criticalFound = false;

      // 임계값: AI Engine과 동일 (disk 90, network 85)
      allMetrics.forEach((metric) => {
        if (
          metric.cpu >= 90 ||
          metric.memory >= 90 ||
          metric.disk >= 90 ||
          metric.network >= 85
        ) {
          expect(metric.status).toBe('critical');
          criticalFound = true;
        }
      });

      // 크리티컬 상태가 없어도 테스트는 통과 (데이터 의존성 제거)
      // 대신 로직 자체의 정합성을 검증
      if (!criticalFound) {
        // 모든 메트릭이 임계값 미만일 때 critical 상태가 없어야 함
        allMetrics.forEach((metric) => {
          if (metric.status === 'critical') {
            expect(
              metric.cpu >= 90 ||
                metric.memory >= 90 ||
                metric.disk >= 90 ||
                metric.network >= 85
            ).toBe(true);
          }
        });
      }
    });

    it('should mark as warning when any metric >= 80% (but not critical)', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();

      // 임계값: AI Engine과 동일 (disk 80, network 70)
      allMetrics.forEach((metric) => {
        const isCritical =
          metric.cpu >= 90 ||
          metric.memory >= 90 ||
          metric.disk >= 90 ||
          metric.network >= 85;
        const isWarning =
          metric.cpu >= 80 ||
          metric.memory >= 80 ||
          metric.disk >= 80 ||
          metric.network >= 70;

        if (isWarning && !isCritical) {
          expect(metric.status).toBe('warning');
        }

        // 역검증: warning 상태라면 반드시 warning 조건을 만족해야 함
        if (metric.status === 'warning') {
          expect(isWarning).toBe(true);
          expect(isCritical).toBe(false);
        }
      });
    });

    it('should mark as online when all metrics are normal', async () => {
      const allMetrics = await metricsProvider.getAllServerMetrics();

      // 임계값: system-rules.json 및 위의 warning 테스트와 동일
      // cpu: warning >= 80, memory: warning >= 80
      // disk: warning >= 80, network: warning >= 70
      allMetrics.forEach((metric) => {
        if (metric.status === 'online') {
          // online 상태는 모든 메트릭이 warning 임계값 미만
          expect(metric.cpu).toBeLessThan(80);
          expect(metric.memory).toBeLessThan(80);
          expect(metric.disk).toBeLessThan(80); // 80으로 수정 (system-rules.json 일치)
          expect(metric.network).toBeLessThan(70); // 70으로 수정 (system-rules.json 일치)
        }
      });
    });
  });
});
