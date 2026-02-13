/**
 * 통합 시간 유틸리티 단위 테스트
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KoreanTimeUtil, KST } from './time';

describe('KoreanTimeUtil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-07-01T06:30:45.000Z')); // KST: 2025-07-01 15:30:45
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('기본 시간 포맷팅 함수', () => {
    it('now() - 현재 한국시간을 올바른 형식으로 반환해야 함', () => {
      const result = KoreanTimeUtil.now();
      expect(result).toMatch(
        /2025\. 07\. 01\. ((오후|PM) 03:30:45|15:30:45) \(KST\)/
      );
    });

    it('nowISO() - ISO 형식으로 한국시간을 반환해야 함', () => {
      const result = KoreanTimeUtil.nowISO();
      expect(result).toBe('2025-07-01 15:30:45');
    });

    it('dateOnly() - 날짜만 반환해야 함', () => {
      const result = KoreanTimeUtil.dateOnly();
      expect(result).toBe('2025-07-01');
    });

    it('fileTimestamp() - 파일명용 타임스탬프를 반환해야 함', () => {
      const result = KoreanTimeUtil.fileTimestamp();
      expect(result).toMatch(
        /2025.*07.*01.*15.*30.*45|2025.*07.*01.*03.*30.*45/
      );
    });

    it('logTimestamp() - 로그용 타임스탬프를 반환해야 함', () => {
      const result = KoreanTimeUtil.logTimestamp();
      expect(result).toBe('[2025-07-01 15:30:45 KST]');
    });

    it('commitTimestamp() - 커밋 메시지용 타임스탬프를 반환해야 함', () => {
      const result = KoreanTimeUtil.commitTimestamp();
      expect(result).toBe('(2025-07-01 15:30 KST)');
    });
  });

  describe('시간 변환 및 계산 함수', () => {
    it('toKoreanTime() - Date 객체를 한국시간으로 변환해야 함', () => {
      const testDate = new Date('2025-06-15T10:00:00.000Z'); // UTC
      const result = KoreanTimeUtil.toKoreanTime(testDate);
      expect(result).toMatch(
        /2025\. 06\. 15\. ((오후|PM) 07:00:00|19:00:00) \(KST\)/
      );
    });

    it('toCronExpression() - 한국시간 기준 cron 표현식을 생성해야 함', () => {
      const result = KoreanTimeUtil.toCronExpression(9, 30);
      expect(result).toBe('30 9 * * *');
    });

    it('isWorkingHours() - 평일 업무시간(9-18시)에 true를 반환해야 함', () => {
      const result = KoreanTimeUtil.isWorkingHours();
      expect(result).toBe(true);
    });
  });

  describe('통합된 KST 시간 슬롯 함수', () => {
    it('getKSTMinuteOfDay() - KST 자정부터 경과한 분을 반환해야 함', () => {
      // KST 15:30 -> 15 * 60 + 30 = 930
      const minuteOfDay = KoreanTimeUtil.getKSTMinuteOfDay();
      expect(minuteOfDay).toBe(930);
    });

    it('getKST10MinSlotIndex() - KST 10분 슬롯 인덱스를 반환해야 함', () => {
      // 930 / 10 = 93
      const slotIndex = KoreanTimeUtil.getKST10MinSlotIndex();
      expect(slotIndex).toBe(93);
    });

    it('minuteOfDayToTime() - 분을 HH:MM 형식으로 변환해야 함', () => {
      expect(KoreanTimeUtil.minuteOfDayToTime(0)).toBe('00:00');
      expect(KoreanTimeUtil.minuteOfDayToTime(59)).toBe('00:59');
      expect(KoreanTimeUtil.minuteOfDayToTime(60)).toBe('01:00');
      expect(KoreanTimeUtil.minuteOfDayToTime(930)).toBe('15:30');
      expect(KoreanTimeUtil.minuteOfDayToTime(1439)).toBe('23:59');
    });
  });

  describe('KST 단축 함수 객체', () => {
    it('기본 시간 함수들이 정상 작동해야 함', () => {
      expect(KST.iso()).toBe('2025-07-01 15:30:45');
      expect(KST.date()).toBe('2025-07-01');
      expect(KST.log()).toBe('[2025-07-01 15:30:45 KST]');
      expect(KST.isWork()).toBe(true);
    });

    it('시간 슬롯 함수들이 정상 작동해야 함', () => {
      expect(KST.minuteOfDay()).toBe(930);
      expect(KST.slotIndex()).toBe(93);
      expect(KST.slotStart()).toBe(930);
      expect(KST.slotRange()).toBe('15:30-15:39');
      expect(KST.toTime(930)).toBe('15:30');
      expect(KST.currentTime()).toBe('15:30');
    });
  });

  describe('NTP 관련 함수 (네트워크 모킹 필요)', () => {
    it('nowSynced()는 Promise를 반환해야 함', async () => {
      const nowSyncedPromise = KoreanTimeUtil.nowSynced();
      expect(nowSyncedPromise).toBeInstanceOf(Promise);
    });
    it('KST.now()는 Promise를 반환해야 함', async () => {
      const nowPromise = KST.now();
      expect(nowPromise).toBeInstanceOf(Promise);
    });
  });
});
