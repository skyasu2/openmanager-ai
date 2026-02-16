/**
 * OTel Data Loader — SSOT Primary
 *
 * 프론트엔드 대시보드의 **단일 진실 공급원(Single Source of Truth)**.
 * OTel-native 포맷(metrics + logs)으로 24시간 시계열 데이터를 제공.
 * 빌드 타임에 정적 import로 번들에 포함.
 *
 * 데이터 소스:
 *   hourly/hour-XX.json     → 10분 슬롯 × 6 = 1시간, 15서버 메트릭 + 로그
 *   resource-catalog.json   → 서버 메타데이터 (server.role, os, zone 등)
 *   timeseries.json         → 24h 집계 시계열 매트릭스 (144포인트 × 15서버)
 *
 * Public API:
 *   getHourlySlots(hour)     → OTelHourlySlot[]
 *   getResourceCatalog()     → OTelResourceCatalog
 *   getTimeSeries()          → OTelTimeSeries
 *   getOTelHourlyData(hour)  → OTelHourlyFile | null  (full hourly file)
 *
 * @created 2026-02-15
 */

import type {
  OTelHourlyFile,
  OTelHourlySlot,
  OTelResourceCatalog,
  OTelTimeSeries,
} from '@/types/otel-metrics';
import hour00 from './hourly/hour-00.json';
import hour01 from './hourly/hour-01.json';
import hour02 from './hourly/hour-02.json';
import hour03 from './hourly/hour-03.json';
import hour04 from './hourly/hour-04.json';
import hour05 from './hourly/hour-05.json';
import hour06 from './hourly/hour-06.json';
import hour07 from './hourly/hour-07.json';
import hour08 from './hourly/hour-08.json';
import hour09 from './hourly/hour-09.json';
import hour10 from './hourly/hour-10.json';
import hour11 from './hourly/hour-11.json';
import hour12 from './hourly/hour-12.json';
import hour13 from './hourly/hour-13.json';
import hour14 from './hourly/hour-14.json';
import hour15 from './hourly/hour-15.json';
import hour16 from './hourly/hour-16.json';
import hour17 from './hourly/hour-17.json';
import hour18 from './hourly/hour-18.json';
import hour19 from './hourly/hour-19.json';
import hour20 from './hourly/hour-20.json';
import hour21 from './hourly/hour-21.json';
import hour22 from './hourly/hour-22.json';
import hour23 from './hourly/hour-23.json';
// Static imports: bundled at build time
import resourceCatalog from './resource-catalog.json';
import timeseries from './timeseries.json';

// ============================================================================
// Hourly Data Map (0-23)
// ============================================================================

const OTEL_HOURLY_MAP: Record<number, OTelHourlyFile> = {
  0: hour00 as unknown as OTelHourlyFile,
  1: hour01 as unknown as OTelHourlyFile,
  2: hour02 as unknown as OTelHourlyFile,
  3: hour03 as unknown as OTelHourlyFile,
  4: hour04 as unknown as OTelHourlyFile,
  5: hour05 as unknown as OTelHourlyFile,
  6: hour06 as unknown as OTelHourlyFile,
  7: hour07 as unknown as OTelHourlyFile,
  8: hour08 as unknown as OTelHourlyFile,
  9: hour09 as unknown as OTelHourlyFile,
  10: hour10 as unknown as OTelHourlyFile,
  11: hour11 as unknown as OTelHourlyFile,
  12: hour12 as unknown as OTelHourlyFile,
  13: hour13 as unknown as OTelHourlyFile,
  14: hour14 as unknown as OTelHourlyFile,
  15: hour15 as unknown as OTelHourlyFile,
  16: hour16 as unknown as OTelHourlyFile,
  17: hour17 as unknown as OTelHourlyFile,
  18: hour18 as unknown as OTelHourlyFile,
  19: hour19 as unknown as OTelHourlyFile,
  20: hour20 as unknown as OTelHourlyFile,
  21: hour21 as unknown as OTelHourlyFile,
  22: hour22 as unknown as OTelHourlyFile,
  23: hour23 as unknown as OTelHourlyFile,
};

function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * 특정 시간대의 OTel 슬롯 배열 조회
 * @param hour 0-23
 */
export function getHourlySlots(hour: number): OTelHourlySlot[] {
  const file = OTEL_HOURLY_MAP[normalizeHour(hour)];
  return file?.slots ?? [];
}

/**
 * OTel Resource Catalog (서버 메타데이터)
 */
export function getResourceCatalog(): OTelResourceCatalog {
  return resourceCatalog as unknown as OTelResourceCatalog;
}

/**
 * OTel TimeSeries (24h 시계열 매트릭스)
 */
export function getTimeSeries(): OTelTimeSeries {
  return timeseries as unknown as OTelTimeSeries;
}

/**
 * 특정 시간대 OTel 전체 파일 조회 (O(1))
 * @param hour 0-23
 */
export function getOTelHourlyData(hour: number): OTelHourlyFile | null {
  return OTEL_HOURLY_MAP[normalizeHour(hour)] ?? null;
}

// Backward-compatible aliases
export const getOTelResourceCatalog = getResourceCatalog;
export const getOTelTimeSeries = getTimeSeries;
