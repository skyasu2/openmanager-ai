/**
 * Server data public API facade — re-exports from focused submodules.
 *
 * @see scripts/data/sync-hourly-data.ts - JSON 생성 스크립트
 * @see docs/reference/architecture/data/data-architecture.md - 아키텍처 문서
 */

export type { ServerContext } from '@/services/server-data/loki-log-generator';
export {
  buildLogQL,
  buildLokiPushPayload,
  generateLokiLogs,
  groupIntoStreams,
} from '@/services/server-data/loki-log-generator';
export { generateServerLogs } from '@/services/server-data/server-data-logs';
// ── Re-exports (public API) ────────────────────────────────────────
export type {
  EnhancedServerMetrics,
  HourlyJsonData,
  PrometheusTargetData,
  RawServerData,
  ServerLogEntry,
} from '@/services/server-data/server-data-types';
export type {
  LokiLogEntry,
  LokiPushPayload,
  LokiStream,
  LokiStreamLabels,
} from '@/types/loki';
