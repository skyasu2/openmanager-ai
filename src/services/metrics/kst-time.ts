/**
 * KST Time Utilities
 *
 * 한국 시간(KST, UTC+9) 기준 시간 계산 유틸리티
 *
 * @created 2026-02-10 (MetricsProvider.ts SRP 분리)
 */

/**
 * 한국 시간(KST) 기준 현재 minuteOfDay 계산
 */
export function getKSTMinuteOfDay(): number {
  const now = new Date();
  // UTC + 9시간 = KST
  const kstOffset = 9 * 60; // 분 단위
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const kstMinutes = (utcMinutes + kstOffset) % 1440; // 1440 = 24시간

  // 10분 단위로 반올림
  return Math.floor(kstMinutes / 10) * 10;
}

/**
 * 현재 KST 타임스탬프 생성 (ISO 8601 형식)
 *
 * @returns ISO 8601 문자열 (예: "2026-02-06T19:30:45.123+09:00")
 *
 * @note toISOString()은 항상 UTC 시간을 반환하므로 수동 포맷팅 필요
 */
export function getKSTTimestamp(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간 (ms)
  const kstDate = new Date(now.getTime() + kstOffset);

  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(kstDate.getUTCSeconds()).padStart(2, '0');
  const ms = String(kstDate.getUTCMilliseconds()).padStart(3, '0');

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
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // 9시간 (ms)
  const kstDate = new Date(now.getTime() + kstOffset);

  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(
    Math.floor(kstDate.getUTCMinutes() / 10) * 10
  ).padStart(2, '0');

  const minuteOfDay =
    kstDate.getUTCHours() * 60 + Math.floor(kstDate.getUTCMinutes() / 10) * 10;
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
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const targetTime = new Date(
    now.getTime() + kstOffset - minutesAgo * 60 * 1000
  );
  const currentKST = new Date(now.getTime() + kstOffset);

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
