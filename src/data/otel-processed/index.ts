/**
 * OTel Processed Data Loader - Vercel 번들 포함용
 *
 * 빌드 타임에 생성된 OTel JSON 데이터를 정적 import로 번들에 포함.
 * src/data/hourly-data/index.ts와 동일한 패턴.
 *
 * @created 2026-02-11
 */

import type { OTelHourlyFile, OTelResourceCatalog } from '@/types/otel-metrics';
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
// 정적 import: 빌드 시 번들에 포함
import resourceCatalog from './resource-catalog.json';
import timeseries from './timeseries.json';

// ============================================================================
// Hourly Data Map (0-23시)
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

// ============================================================================
// Public API
// ============================================================================

/**
 * 특정 시간대 OTel 데이터 조회 (O(1))
 * @param hour 0-23
 */
export function getOTelHourlyData(hour: number): OTelHourlyFile | null {
  const normalizedHour = ((hour % 24) + 24) % 24;
  return OTEL_HOURLY_MAP[normalizedHour] || null;
}

/**
 * OTel Resource Catalog 조회
 */
export function getOTelResourceCatalog(): OTelResourceCatalog {
  return resourceCatalog as unknown as OTelResourceCatalog;
}

/**
 * OTel TimeSeries 조회
 */
export interface OTelTimeSeries {
  schemaVersion: string;
  generatedAt: string;
  serverIds: string[];
  timestamps: string[];
  metrics: Record<string, number[][]>;
}

export function getOTelTimeSeries(): OTelTimeSeries {
  return timeseries as unknown as OTelTimeSeries;
}

/**
 * 로드된 OTel 시간대 수 확인 (디버깅용)
 */
export function getOTelLoadedHoursCount(): number {
  return Object.keys(OTEL_HOURLY_MAP).length;
}
