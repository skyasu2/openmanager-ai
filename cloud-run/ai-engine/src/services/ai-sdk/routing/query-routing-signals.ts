/**
 * Runtime routing SSOT for monitoring query signals.
 *
 * @module query-routing-signals
 *
 * 이 파일은 하위 호환 re-export facade입니다.
 * 실제 구현은 다음 파일에 분산되어 있습니다:
 *   - routing-keywords.ts     : 패턴 상수 및 키워드 배열
 *   - routing-signals-types.ts: 타입 및 인터페이스
 *   - routing-signals-classify.ts: 분류 함수
 *   - routing-signals-build.ts: 신호 빌드 (extractQueryRoutingSignals)
 */

export const MONITORING_RUNTIME_ROUTING_SOURCE =
  'query-routing-signals' as const;

// ─── 패턴 상수 ─────────────────────────────────────────────────────────────
export {
  ADVISOR_QUERY_PATTERN,
  ANALYST_QUERY_PATTERN,
  ATTACHMENT_VISION_PATTERN,
  COMPOSITE_QUERY_PATTERNS,
  FORCE_KB_QUERY_PATTERN,
  INFRA_CONTEXT_PATTERN,
  REPORTER_QUERY_PATTERN,
} from './routing-keywords';

// routing-patterns.ts SSOT에서 별칭 re-export
export {
  INVERSE_STATUS_PATTERN as INVERSE_STATUS_FILTER_PATTERN,
  MIN_METRIC_PATTERN as MIN_METRIC_RANKING_PATTERN,
} from './routing-patterns';
export { isRestartNeededLookupQuery as isRestartNeededLookup } from './routing-patterns';

// ─── 타입 ───────────────────────────────────────────────────────────────────
export type {
  QueryRoutingIntent,
  QueryRoutingMetric,
  QueryRoutingPreFilterSignal,
  QueryRoutingScope,
  QueryRoutingSignalOptions,
  QueryRoutingSignals,
  QueryRoutingTimeWindow,
  QueryRoutingToolIntentCategory,
} from './routing-signals-types';

// ─── 분류 함수 ──────────────────────────────────────────────────────────────
export {
  isFormattingOnlyReportRequest,
  mapQuerySignalsToIntentCategory,
  shouldPreferAdvisorForOperationalAdvice,
} from './routing-signals-classify';

// ─── 공개 API ────────────────────────────────────────────────────────────────
export { extractQueryRoutingSignals } from './routing-signals-build';
