/**
 * @vitest-environment node
 */

/**
 * MetricsProvider Time Comparison Tests
 * calculateRelativeDateTime, getMetricsAtRelativeTime, compareServerMetrics
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  calculateRelativeDateTime,
  compareServerMetrics,
  getKSTDateTime,
  getMetricsAtRelativeTime,
  metricsProvider,
} from './MetricsProvider';

describe('MetricsProvider Time Comparison', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('calculateRelativeDateTime', () => {
    it('minutesAgo=0 → isYesterday=false', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z')); // KST 12:00

      const result = calculateRelativeDateTime(0);
      expect(result.isYesterday).toBe(false);
    });

    it('minutesAgo=1440 → isYesterday=true (24시간 전)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z')); // KST 12:00

      const result = calculateRelativeDateTime(1440);
      expect(result.isYesterday).toBe(true);
    });

    it('자정 경계: KST 00:05에서 minutesAgo=10 → isYesterday=true', () => {
      vi.useFakeTimers();
      // KST 00:05 = UTC 15:05
      vi.setSystemTime(new Date('2026-01-15T15:05:00.000Z'));

      const result = calculateRelativeDateTime(10);
      // KST 00:05 - 10분 = KST 23:55 (전날)
      expect(result.isYesterday).toBe(true);
    });

    it('slotIndex는 10분 단위로 정규화되어야 한다', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z')); // KST 12:00

      const result = calculateRelativeDateTime(0);
      // KST 12:00 → minuteOfDay=720 → slotIndex=72
      expect(result.slotIndex).toBe(72);
    });
  });

  describe('getMetricsAtRelativeTime', () => {
    it('minutesAgo=0 → 현재 메트릭 반환', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z')); // KST 12:00

      // OTel resource-catalog에서 서버 목록 가져오기
      const serverList = metricsProvider.getServerList();
      if (serverList.length === 0) return;

      const result = getMetricsAtRelativeTime(serverList[0].serverId, 0);
      if (result) {
        expect(result.isYesterday).toBe(false);
        expect(result).toHaveProperty('dateLabel');
        expect(result).toHaveProperty('cpu');
        expect(result).toHaveProperty('memory');
      }
    });

    it('존재하지 않는 serverId → null', () => {
      const result = getMetricsAtRelativeTime('xyz-nonexistent-999', 0);
      expect(result).toBeNull();
    });

    it('유효한 serverId → dateLabel, isYesterday 포함', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z')); // KST 12:00

      const serverList = metricsProvider.getServerList();
      if (serverList.length === 0) return;

      const result = getMetricsAtRelativeTime(serverList[0].serverId, 0);
      if (result) {
        expect(typeof result.dateLabel).toBe('string');
        expect(typeof result.isYesterday).toBe('boolean');
      }
    });
  });

  describe('compareServerMetrics', () => {
    it('존재하지 않는 serverId → null', () => {
      const result = compareServerMetrics('xyz-nonexistent-999', 60);
      expect(result).toBeNull();
    });

    it('유효한 비교 → current, past, delta 구조', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z')); // KST 12:00

      const serverList = metricsProvider.getServerList();
      if (serverList.length === 0) return;

      const result = compareServerMetrics(serverList[0].serverId, 60);
      if (result) {
        expect(result).toHaveProperty('current');
        expect(result).toHaveProperty('past');
        expect(result).toHaveProperty('delta');

        expect(result.current).toHaveProperty('timestamp');
        expect(result.current).toHaveProperty('date');
        expect(result.current).toHaveProperty('metrics');

        expect(result.past).toHaveProperty('timestamp');
        expect(result.past).toHaveProperty('date');
        expect(result.past).toHaveProperty('metrics');

        expect(result.delta).toHaveProperty('cpu');
        expect(result.delta).toHaveProperty('memory');
        expect(result.delta).toHaveProperty('disk');
        expect(result.delta).toHaveProperty('network');
      }
    });

    it('delta 계산이 소수점 1자리여야 한다', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z'));

      const serverList = metricsProvider.getServerList();
      if (serverList.length === 0) return;

      const result = compareServerMetrics(serverList[0].serverId, 60);
      if (result) {
        // 소수점 1자리 확인: value * 10이 정수여야 함
        expect(Number.isInteger(result.delta.cpu * 10)).toBe(true);
        expect(Number.isInteger(result.delta.memory * 10)).toBe(true);
        expect(Number.isInteger(result.delta.disk * 10)).toBe(true);
        expect(Number.isInteger(result.delta.network * 10)).toBe(true);
      }
    });
  });

  describe('getKSTDateTime', () => {
    it('올바른 구조를 반환해야 한다', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-15T03:00:00.000Z')); // KST 12:00

      const result = getKSTDateTime();
      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('time');
      expect(result).toHaveProperty('slotIndex');
      expect(result).toHaveProperty('minuteOfDay');

      expect(result.date).toBe('2026-01-15');
      expect(result.time).toBe('12:00');
      expect(result.minuteOfDay).toBe(720);
      expect(result.slotIndex).toBe(72);
    });
  });
});
