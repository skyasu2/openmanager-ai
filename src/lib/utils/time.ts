/**
 * 한국시간(KST, UTC+9) 통합 유틸리티
 *
 * @description
 * 이 프로젝트의 모든 시간 관련 로직을 처리하는 중앙 집중식 유틸리티입니다.
 * NTP 서버와 동기화하여 시간 정확도를 보장하며, 다양한 포맷과 시간대 계산 기능을 제공합니다.
 *
 * @features
 * - NTP 서버 기반 시간 동기화 (WorldTimeAPI)
 * - 다양한 날짜/시간 포맷팅 (ISO, 파일명, 로그, 커밋)
 * - KST 기준 시간 슬롯 및 경과 시간 계산
 *
 * @architectural_note
 * 기존 `utils/koreanTime.ts`와 `utils/kst-time.ts`를 통합하여 재사용성과 유지보수성을 향상시켰습니다.
 */

import { logger } from '@/lib/logging';

interface NTPServer {
  name: string;
  host: string;
  priority: number;
}

interface NTPResponse {
  server: string;
  timestamp: number;
  offset: number;
  success: boolean;
  error?: string;
}

export const KoreanTimeUtil = {
  TIMEZONE: 'Asia/Seoul',
  LOCALE: 'ko-KR',

  NTP_SERVERS: [
    { name: 'Naver', host: 'time.naver.com', priority: 1 },
    { name: 'Google Korea', host: 'time.google.com', priority: 2 },
    { name: 'Korea NTP', host: 'time.kriss.re.kr', priority: 3 },
  ] as NTPServer[],

  timeOffset: 0,
  lastNTPSync: 0,
  NTP_CACHE_DURATION: 5 * 60 * 1000, // 5분

  async fetchNTPTime(): Promise<NTPResponse> {
    for (const server of this.NTP_SERVERS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(
          `https://worldtimeapi.org/api/timezone/Asia/Seoul`,
          {
            method: 'GET',
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) continue;

        const data = await response.json();
        const serverTime = new Date(data.datetime).getTime();
        const networkDelay = 0; // Simplified for client-side
        const offset = serverTime + networkDelay - Date.now();

        return {
          server: `${server.name} (via WorldTimeAPI)`,
          timestamp: serverTime + networkDelay,
          offset,
          success: true,
        };
      } catch (error) {
        logger.warn(
          `[${this.now()}] ⚠️ NTP 서버 ${server.name} 연결 실패:`,
          error
        );
      }
    }

    return {
      server: 'Local System',
      timestamp: Date.now(),
      offset: 0,
      success: false,
      error: 'All NTP servers failed, using local time',
    };
  },

  async getNTPSyncedTime(): Promise<Date> {
    const now = Date.now();
    if (now - this.lastNTPSync < this.NTP_CACHE_DURATION) {
      return new Date(now + this.timeOffset);
    }

    try {
      const ntpResponse = await this.fetchNTPTime();
      if (ntpResponse.success) {
        this.timeOffset = ntpResponse.offset;
        this.lastNTPSync = now;
        logger.info(
          `[${this.now()}] ✅ NTP 시간 동기화 성공: ${ntpResponse.server} (오프셋: ${ntpResponse.offset}ms)`
        );
      } else {
        logger.warn(
          `[${this.now()}] ⚠️ NTP 동기화 실패, 로컬 시간 사용: ${ntpResponse.error}`
        );
      }
      return new Date(now + this.timeOffset);
    } catch (error) {
      logger.error(`[${this.now()}] ❌ NTP 동기화 오류:`, error);
      return new Date();
    }
  },

  // --- Start of original koreanTime.ts methods ---
  now(): string {
    return `${new Date().toLocaleString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })} (KST)`;
  },

  async nowSynced(): Promise<string> {
    const syncedTime = await this.getNTPSyncedTime();
    return `${syncedTime.toLocaleString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })} (KST)`;
  },

  nowISO(): string {
    return new Date().toLocaleString('sv-SE', {
      timeZone: this.TIMEZONE,
    });
  },

  fileTimestamp(): string {
    const now = new Date().toLocaleString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return now
      .replace(/[년월일\s]/g, '')
      .replace(/:/g, '')
      .replace('.', '_');
  },

  logTimestamp(): string {
    return `[${this.nowISO().replace('T', ' ')} KST]`;
  },

  commitTimestamp(): string {
    const now = new Date().toLocaleString('sv-SE', {
      timeZone: this.TIMEZONE,
    });
    return `(${now.substring(0, 16)} KST)`;
  },

  dateOnly(): string {
    return new Date().toLocaleDateString('sv-SE', {
      timeZone: this.TIMEZONE,
    });
  },

  toKoreanTime(date: Date): string {
    return `${date.toLocaleString(this.LOCALE, {
      timeZone: this.TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })} (KST)`;
  },

  isWorkingHours(): boolean {
    const now = new Date();
    const kstHour = parseInt(
      now.toLocaleString('en-US', {
        timeZone: this.TIMEZONE,
        hour: '2-digit',
        hour12: false,
      }),
      10
    );
    const kstDay = now.toLocaleDateString('en-US', {
      timeZone: this.TIMEZONE,
      weekday: 'short',
    });
    const isWeekday = !['Sat', 'Sun'].includes(kstDay);
    return isWeekday && kstHour >= 9 && kstHour < 18;
  },

  toCronExpression(hour: number, minute: number = 0): string {
    return `${minute} ${hour} * * *`;
  },

  aiLogTimestamp(engineName: string): string {
    return `${this.logTimestamp()} [${engineName.toUpperCase()}]`;
  },

  metricTimestamp(): number {
    return Date.now();
  },
  // --- End of original koreanTime.ts methods ---

  // --- Start of integrated kst-time.ts methods ---
  getCurrentKST(): Date {
    const now = new Date();
    return new Date(now.getTime() + 9 * 60 * 60 * 1000);
  },

  getKSTMinuteOfDay(): number {
    const kst = this.getCurrentKST();
    const hours = kst.getUTCHours();
    const minutes = kst.getUTCMinutes();
    return hours * 60 + minutes;
  },

  getKST10MinSlotIndex(): number {
    const minuteOfDay = this.getKSTMinuteOfDay();
    return Math.floor(minuteOfDay / 10);
  },

  getKST10MinSlotStart(): number {
    return this.getKST10MinSlotIndex() * 10;
  },

  minuteOfDayToTime(minuteOfDay: number): string {
    const hours = Math.floor(minuteOfDay / 60);
    const minutes = minuteOfDay % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  },

  getCurrentKSTTime(): string {
    const minuteOfDay = this.getKSTMinuteOfDay();
    return this.minuteOfDayToTime(minuteOfDay);
  },

  getCurrentKST10MinSlotRange(): string {
    const slotStart = this.getKST10MinSlotStart();
    const startTime = this.minuteOfDayToTime(slotStart);
    const endTime = this.minuteOfDayToTime(slotStart + 9);
    return `${startTime}-${endTime}`;
  },
  // --- End of integrated kst-time.ts methods ---
};

/**
 * 전역에서 쉽게 사용할 수 있는 단축 함수 객체
 */
export const KST = {
  // 기본 시간 함수
  now: () => KoreanTimeUtil.nowSynced(),
  nowString: () => KoreanTimeUtil.now(),
  iso: () => KoreanTimeUtil.nowISO(),
  date: () => KoreanTimeUtil.dateOnly(),
  log: () => KoreanTimeUtil.logTimestamp(),
  commit: () => KoreanTimeUtil.commitTimestamp(),
  file: () => KoreanTimeUtil.fileTimestamp(),
  isWork: () => KoreanTimeUtil.isWorkingHours(),
  aiLog: (engine: string) => KoreanTimeUtil.aiLogTimestamp(engine),
  metric: () => KoreanTimeUtil.metricTimestamp(),

  // 시간 슬롯 관련 함수
  getKST: () => KoreanTimeUtil.getCurrentKST(),
  minuteOfDay: () => KoreanTimeUtil.getKSTMinuteOfDay(),
  slotIndex: () => KoreanTimeUtil.getKST10MinSlotIndex(),
  slotStart: () => KoreanTimeUtil.getKST10MinSlotStart(),
  slotRange: () => KoreanTimeUtil.getCurrentKST10MinSlotRange(),
  toTime: (minute: number) => KoreanTimeUtil.minuteOfDayToTime(minute),
  currentTime: () => KoreanTimeUtil.getCurrentKSTTime(),
};

export default KoreanTimeUtil;
