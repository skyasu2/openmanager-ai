/**
 * OTel Metrics Loader — Backward Compatibility Re-export
 *
 * 기존 `@/data/otel-metrics`를 참조하던 코드를 위한 하위 호환 모듈.
 * 실제 데이터 로더는 `@/data/otel-data`에 통합됨.
 *
 * @deprecated Use `@/data/otel-data` directly
 */

export {
  getOTelHourlyData,
  getResourceCatalog as getOTelResourceCatalog,
  getTimeSeries as getOTelTimeSeries,
  getHourlySlots,
} from '@/data/otel-data';
