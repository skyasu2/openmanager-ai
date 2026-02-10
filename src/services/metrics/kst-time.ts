/**
 * KST Time Utilities (MetricsProvider 도메인 전용)
 *
 * 한국 시간(KST, UTC+9) 기준 시간 계산 유틸리티
 * 내부적으로 KoreanTimeUtil.getCurrentKST()를 사용하여 중복 로직 제거
 *
 * @created 2026-02-10 (MetricsProvider.ts SRP 분리)
 * @updated 2026-02-10 - KoreanTimeUtil 재사용으로 UTC+9 중복 제거
 */

import { KoreanTimeUtil } from '@/lib/utils/time';

/**
 * 한국 시간(KST) 기준 현재 minuteOfDay 계산 (10분 단위 정렬)
 */
export function getKSTMinuteOfDay(): number {
  const kst = KoreanTimeUtil.getCurrentKST();
  const kstMinutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();

  // 10분 단위로 반올림
  return Math.floor(kstMinutes / 10) * 10;
}

/**
 * 현재 KST 타임스탬프 생성 (ISO 8601 형식)
 *
 * @returns ISO 8601 문자열 (예: "2026-02-06T19:30:45.123+09:00")
 */
export function getKSTTimestamp(): string {
  const kst = KoreanTimeUtil.getCurrentKST();

  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  const hours = String(kst.getUTCHours()).padStart(2, '0');
  const minutes = String(kst.getUTCMinutes()).padStart(2, '0');
  const seconds = String(kst.getUTCSeconds()).padStart(2, '0');
  const ms = String(kst.getUTCMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+09:00`;
}

/**
 * 현재 KST 날짜/시간 정보 반환
 */
export function getKSTDateTime(): {
  date: string;
  time: string;
  slotIndex: number;
  minuteOfDay: number;
} {
  const kst = KoreanTimeUtil.getCurrentKST();

  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  const hours = String(kst.getUTCHours()).padStart(2, '0');
  const minutes = String(Math.floor(kst.getUTCMinutes() / 10) * 10).padStart(
    2,
    '0'
  );

  const minuteOfDay =
    kst.getUTCHours() * 60 + Math.floor(kst.getUTCMinutes() / 10) * 10;
  const slotIndex = Math.floor(minuteOfDay / 10);

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    slotIndex,
    minuteOfDay,
  };
}

/**
 * 상대 시간(분) 기준으로 실제 날짜/시간 계산
 * @param minutesAgo 몇 분 전 (양수 = 과거, 음수 = 미래)
 */
export function calculateRelativeDateTime(minutesAgo: number): {
  date: string;
  time: string;
  slotIndex: number;
  timestamp: string;
  isYesterday: boolean;
} {
  const currentKST = KoreanTimeUtil.getCurrentKST();
  const targetTime = new Date(currentKST.getTime() - minutesAgo * 60 * 1000);

  const year = targetTime.getUTCFullYear();
  const month = String(targetTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetTime.getUTCDate()).padStart(2, '0');
  const hours = String(targetTime.getUTCHours()).padStart(2, '0');
  const mins = Math.floor(targetTime.getUTCMinutes() / 10) * 10;
  const minutes = String(mins).padStart(2, '0');

  const minuteOfDay = targetTime.getUTCHours() * 60 + mins;
  const slotIndex = Math.floor(minuteOfDay / 10);

  // 오늘/어제 판별
  const currentDay = String(currentKST.getUTCDate()).padStart(2, '0');
  const isYesterday = day !== currentDay;

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    slotIndex,
    timestamp: `${year}-${month}-${day}T${hours}:${minutes}:00+09:00`,
    isYesterday,
  };
}
