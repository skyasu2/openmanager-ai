/**
 * JSON loading and caching for hourly server data files.
 *
 * Fetches `/hourly-data/hour-XX.json` with a 1-minute in-memory cache.
 *
 * @see server-data-loader.ts - Main orchestration facade
 */

import { logger } from '@/lib/logging';
import type { HourlyJsonData } from '@/services/server-data/server-data-types';

// JSON 캐시 (메모리 최적화)
const jsonCache: Map<number, { data: HourlyJsonData; timestamp: number }> =
  new Map();
const CACHE_TTL = 60000; // 1분 캐시

/**
 * JSON 파일 로드 (브라우저/서버 호환)
 */
export async function loadHourlyJsonFile(
  hour: number
): Promise<HourlyJsonData | null> {
  const paddedHour = hour.toString().padStart(2, '0');

  // 캐시 확인
  const cached = jsonCache.get(hour);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // 브라우저/서버 모두 fetch 사용
    const response = await fetch(`/hourly-data/hour-${paddedHour}.json`);
    if (!response.ok) {
      logger.error(`[ServerDataLoader] JSON 로드 실패: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as HourlyJsonData;

    // 캐시 저장
    jsonCache.set(hour, { data, timestamp: Date.now() });

    return data;
  } catch (error) {
    logger.error('[ServerDataLoader] JSON 파싱 오류:', error);
    return null;
  }
}

/**
 * 캐시 초기화 (테스트/디버깅용)
 */
export function clearJsonCache(): void {
  jsonCache.clear();
}
