/**
 * OTel Metrics Loader — OTLP Standard (Async Externalized)
 *
 * OTLP ExportMetricsServiceRequest 포맷의 시간별 데이터 로더.
 * 번들 크기를 줄이기 위해 정적 import 대신 fetch(클라이언트) 및 fs(서버)를 사용.
 *
 * @updated 2026-02-17 - Externalized to public/data/ (Bundle size optimization)
 */

import type { ExportMetricsServiceRequest } from '@/types/otel-standard';

// 메모리 캐시 (한 번 로드된 데이터는 유지)
const OTEL_HOURLY_CACHE: Record<number, ExportMetricsServiceRequest> = {};

/**
 * 특정 시간대 OTel 데이터 조회 (Async)
 * @param hour 0-23
 */
export async function getOTelHourlyData(
  hour: number
): Promise<ExportMetricsServiceRequest | null> {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const hourStr = normalizedHour.toString().padStart(2, '0');

  // 1. 캐시 확인
  if (OTEL_HOURLY_CACHE[normalizedHour]) {
    return OTEL_HOURLY_CACHE[normalizedHour];
  }

  try {
    // 2. 서버 사이드 vs 클라이언트 사이드 분기
    if (typeof window === 'undefined') {
      // 서버 사이드: fs 사용
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      // 프로젝트 루트 기준 경로 (Vercel 배포 환경 고려)
      const filePath = path.join(
        process.cwd(),
        'public',
        'data',
        'otel-data',
        'hourly',
        `hour-${hourStr}.json`
      );
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent) as ExportMetricsServiceRequest;

      OTEL_HOURLY_CACHE[normalizedHour] = data;
      return data;
    } else {
      // 클라이언트 사이드: fetch 사용
      const response = await fetch(
        `/data/otel-data/hourly/hour-${hourStr}.json`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch OTel data: ${response.statusText}`);
      }
      const data = (await response.json()) as ExportMetricsServiceRequest;

      OTEL_HOURLY_CACHE[normalizedHour] = data;
      return data;
    }
  } catch (error) {
    console.error(`[OTel Loader] Error loading hour-${hourStr}:`, error);
    return null;
  }
}

/**
 * 로드된 OTel 시간대 수 확인 (디버깅용)
 */
export function getOTelLoadedHoursCount(): number {
  return Object.keys(OTEL_HOURLY_CACHE).length;
}
