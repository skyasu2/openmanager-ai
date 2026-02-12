/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  extractServerId,
  getAllServerIds,
  getHourlyData,
  getLoadedHoursCount,
  getTargetsAtTime,
} from './index';

describe('hourly-data schema', () => {
  describe('전체 로드', () => {
    it('0~23시 모든 hourly data가 로드되어야 한다', () => {
      for (let h = 0; h < 24; h++) {
        const data = getHourlyData(h);
        expect(data).not.toBeNull();
      }
    });
  });

  describe('구조 검증', () => {
    it('hour 필드가 0-23 범위여야 한다', () => {
      for (let h = 0; h < 24; h++) {
        const data = getHourlyData(h);
        expect(data?.hour).toBe(h);
      }
    });

    it('scrapeConfig가 존재해야 한다', () => {
      const data = getHourlyData(0);
      expect(data?.scrapeConfig).toBeDefined();
      expect(data?.scrapeConfig.scrapeInterval).toBeDefined();
      expect(data?.scrapeConfig.evaluationInterval).toBeDefined();
      expect(data?.scrapeConfig.source).toBeDefined();
    });

    it('dataPoints가 6개(10분 슬롯)여야 한다', () => {
      for (let h = 0; h < 24; h++) {
        const data = getHourlyData(h);
        expect(data?.dataPoints).toHaveLength(6);
      }
    });
  });

  describe('메트릭 범위', () => {
    it('up 필드가 0 또는 1이어야 한다', () => {
      for (let h = 0; h < 24; h++) {
        const data = getHourlyData(h)!;
        for (const dp of data.dataPoints) {
          for (const target of Object.values(dp.targets)) {
            expect([0, 1]).toContain(target.metrics.up);
          }
        }
      }
    });

    it('cpu/memory/disk 메트릭이 0-100 범위여야 한다', () => {
      for (let h = 0; h < 24; h++) {
        const data = getHourlyData(h)!;
        for (const dp of data.dataPoints) {
          for (const [_key, target] of Object.entries(dp.targets)) {
            expect(
              target.metrics.node_cpu_usage_percent
            ).toBeGreaterThanOrEqual(0);
            expect(target.metrics.node_cpu_usage_percent).toBeLessThanOrEqual(
              100
            );
            expect(
              target.metrics.node_memory_usage_percent
            ).toBeGreaterThanOrEqual(0);
            expect(
              target.metrics.node_memory_usage_percent
            ).toBeLessThanOrEqual(100);
            expect(
              target.metrics.node_filesystem_usage_percent
            ).toBeGreaterThanOrEqual(0);
            expect(
              target.metrics.node_filesystem_usage_percent
            ).toBeLessThanOrEqual(100);
          }
        }
      }
    });
  });

  describe('서버 일관성', () => {
    it('모든 시간대에 동일한 서버 ID 셋이 존재해야 한다', () => {
      const baseData = getHourlyData(0)!;
      const baseKeys = new Set(Object.keys(baseData.dataPoints[0].targets));

      for (let h = 1; h < 24; h++) {
        const data = getHourlyData(h)!;
        const keys = new Set(Object.keys(data.dataPoints[0].targets));
        expect(keys).toEqual(baseKeys);
      }
    });
  });

  describe('labels', () => {
    it('server_type과 datacenter가 비어있지 않아야 한다', () => {
      const data = getHourlyData(0)!;
      for (const target of Object.values(data.dataPoints[0].targets)) {
        expect(target.labels.server_type).toBeTruthy();
        expect(target.labels.datacenter).toBeTruthy();
      }
    });
  });

  describe('extractServerId', () => {
    it(':9100 포트를 제거해야 한다', () => {
      expect(extractServerId('web-nginx-icn-01:9100')).toBe('web-nginx-icn-01');
    });

    it('이미 제거된 경우 그대로 반환해야 한다', () => {
      expect(extractServerId('web-nginx-icn-01')).toBe('web-nginx-icn-01');
    });
  });

  describe('getTargetsAtTime', () => {
    it('유효한 hour/minute에 대해 targets를 반환해야 한다', () => {
      const targets = getTargetsAtTime(0, 0);
      expect(targets).not.toBeNull();
      expect(Object.keys(targets!).length).toBeGreaterThan(0);
    });

    it('minute=59 → slotIndex=5 (마지막 슬롯)', () => {
      const targets = getTargetsAtTime(0, 59);
      expect(targets).not.toBeNull();
    });

    it('minute=0 → slotIndex=0 (첫 슬롯)', () => {
      const targets = getTargetsAtTime(0, 0);
      expect(targets).not.toBeNull();
    });
  });

  describe('getAllServerIds', () => {
    it('비어있지 않은 배열을 반환해야 한다', () => {
      const ids = getAllServerIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    });

    it('포트 번호가 포함되지 않아야 한다', () => {
      const ids = getAllServerIds();
      ids.forEach((id) => {
        expect(id).not.toContain(':9100');
      });
    });
  });

  describe('getLoadedHoursCount', () => {
    it('24를 반환해야 한다', () => {
      expect(getLoadedHoursCount()).toBe(24);
    });
  });

  describe('getHourlyData 정규화', () => {
    it('hour=-1 → hour 23으로 정규화', () => {
      const data = getHourlyData(-1);
      expect(data).not.toBeNull();
      expect(data?.hour).toBe(23);
    });

    it('hour=25 → hour 1로 정규화', () => {
      const data = getHourlyData(25);
      expect(data).not.toBeNull();
      expect(data?.hour).toBe(1);
    });
  });
});
