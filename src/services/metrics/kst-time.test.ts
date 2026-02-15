/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock KoreanTimeUtil to control time
vi.mock('@/lib/utils/time', () => ({
  KoreanTimeUtil: {
    getCurrentKST: vi.fn(),
  },
}));

import { KoreanTimeUtil } from '@/lib/utils/time';
import {
  calculateRelativeDateTime,
  getKSTDateTime,
  getKSTMinuteOfDay,
  getKSTTimestamp,
} from './kst-time';

const mockGetCurrentKST = vi.mocked(KoreanTimeUtil.getCurrentKST);

function makeKST(hours: number, minutes: number, seconds = 0): Date {
  // KST uses UTC internally (getCurrentKST returns a Date where UTC methods = KST values)
  return new Date(Date.UTC(2026, 1, 15, hours, minutes, seconds, 0));
}

describe('kst-time', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getKSTMinuteOfDay', () => {
    it('returns 0 for midnight', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(0, 0));
      expect(getKSTMinuteOfDay()).toBe(0);
    });

    it('rounds down to 10-minute intervals', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(14, 37));
      // 14*60+37 = 877 → floor(877/10)*10 = 870
      expect(getKSTMinuteOfDay()).toBe(870);
    });

    it('handles exact 10-minute boundary', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(10, 30));
      expect(getKSTMinuteOfDay()).toBe(630);
    });

    it('returns 1430 for 23:50', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(23, 59));
      // 23*60+59 = 1439 → floor(1439/10)*10 = 1430
      expect(getKSTMinuteOfDay()).toBe(1430);
    });
  });

  describe('getKSTTimestamp', () => {
    it('returns ISO 8601 with +09:00 offset', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(19, 30, 45));
      const result = getKSTTimestamp();
      expect(result).toBe('2026-02-15T19:30:45.000+09:00');
    });

    it('zero-pads single digit values', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(1, 5, 3));
      const result = getKSTTimestamp();
      expect(result).toMatch(/^2026-02-15T01:05:03/);
    });
  });

  describe('getKSTDateTime', () => {
    it('returns structured date/time with slot info', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(14, 25));
      const result = getKSTDateTime();

      expect(result.date).toBe('2026-02-15');
      expect(result.time).toBe('14:20'); // rounded to 10min
      // minuteOfDay = 14*60 + 20 = 860
      expect(result.minuteOfDay).toBe(860);
      expect(result.slotIndex).toBe(86);
    });

    it('rounds minutes to 10-minute boundary', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(9, 59));
      const result = getKSTDateTime();
      expect(result.time).toBe('09:50');
    });
  });

  describe('calculateRelativeDateTime', () => {
    it('returns current time when minutesAgo is 0', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(15, 30));
      const result = calculateRelativeDateTime(0);
      expect(result.time).toBe('15:30');
      expect(result.isYesterday).toBe(false);
    });

    it('calculates 30 minutes ago correctly', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(15, 30));
      const result = calculateRelativeDateTime(30);
      expect(result.time).toBe('15:00');
    });

    it('detects yesterday when crossing midnight', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(0, 15));
      const result = calculateRelativeDateTime(30);
      // 00:15 - 30min = 23:45 (yesterday)
      expect(result.isYesterday).toBe(true);
    });

    it('returns future time for negative minutesAgo', () => {
      mockGetCurrentKST.mockReturnValue(makeKST(10, 0));
      const result = calculateRelativeDateTime(-60);
      expect(result.time).toBe('11:00');
    });
  });
});
