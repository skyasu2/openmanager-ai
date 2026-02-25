/**
 * OTel Data Loader — SSOT Primary (Async Externalized)
 *
 * 프론트엔드 대시보드의 **단일 진실 공급원(Single Source of Truth)**.
 * 번들 크기를 줄이기 위해 정적 import 대신 fetch(클라이언트) 및 fs(서버)를 사용.
 *
 * @updated 2026-02-17 - Externalized to public/data/ (Bundle size optimization)
 */

import type {
  OTelHourlyFile,
  OTelHourlySlot,
  OTelResourceCatalog,
  OTelTimeSeries,
} from '@/types/otel-metrics';
import debug from '@/utils/debug';

// 메모리 캐시
let cachedResourceCatalog: OTelResourceCatalog | null = null;
let cachedTimeSeries: OTelTimeSeries | null = null;
const OTEL_HOURLY_CACHE: Record<number, OTelHourlyFile> = {};

/**
 * 범용 비동기 로더 (서버/클라이언트 하이브리드)
 */
async function loadJsonData<T>(fileName: string): Promise<T | null> {
  try {
    if (typeof window === 'undefined') {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const filePath = path.join(
        process.cwd(),
        'public',
        'data',
        'otel-data',
        fileName
      );
      const fileContent = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(fileContent) as T;
    } else {
      const response = await fetch(`/data/otel-data/${fileName}`);
      if (!response.ok) throw new Error(`Failed to fetch: ${fileName}`);
      return (await response.json()) as T;
    }
  } catch (error) {
    debug.error(`[OTel Data Loader] Error loading ${fileName}:`, error);
    return null;
  }
}

// ============================================================================
// Public API (Async)
// ============================================================================

/**
 * 특정 시간대의 OTel 슬롯 배열 조회
 */
export async function getHourlySlots(hour: number): Promise<OTelHourlySlot[]> {
  const file = await getOTelHourlyData(hour);
  return file?.slots ?? [];
}

/**
 * OTel Resource Catalog (서버 메타데이터)
 */
export async function getResourceCatalog(): Promise<OTelResourceCatalog | null> {
  if (cachedResourceCatalog) return cachedResourceCatalog;
  const data = await loadJsonData<OTelResourceCatalog>('resource-catalog.json');
  if (data) cachedResourceCatalog = data;
  return data;
}

/**
 * OTel TimeSeries (24h 시계열 매트릭스)
 */
export async function getTimeSeries(): Promise<OTelTimeSeries | null> {
  if (cachedTimeSeries) return cachedTimeSeries;
  const data = await loadJsonData<OTelTimeSeries>('timeseries.json');
  if (data) cachedTimeSeries = data;
  return data;
}

/**
 * 특정 시간대 OTel 전체 파일 조회
 */
export async function getOTelHourlyData(
  hour: number
): Promise<OTelHourlyFile | null> {
  const normalizedHour = ((hour % 24) + 24) % 24;
  if (OTEL_HOURLY_CACHE[normalizedHour])
    return OTEL_HOURLY_CACHE[normalizedHour];

  const fileName = `hourly/hour-${normalizedHour.toString().padStart(2, '0')}.json`;
  const data = await loadJsonData<OTelHourlyFile>(fileName);
  if (data) OTEL_HOURLY_CACHE[normalizedHour] = data;
  return data;
}

// Backward-compatible aliases (Note: Now async)
export const getOTelResourceCatalog = getResourceCatalog;
export const getOTelTimeSeries = getTimeSeries;
