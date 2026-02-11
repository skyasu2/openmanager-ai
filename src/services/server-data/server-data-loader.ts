/**
 * Server data public API facade — re-exports from focused submodules.
 *
 * @see scripts/data/sync-hourly-data.ts - JSON 생성 스크립트
 * @see docs/reference/architecture/data/data-architecture.md - 아키텍처 문서
 */

import { getHourlyData } from '@/data/hourly-data';

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

// ── Functions ──────────────────────────────────────────────────────

/**
 * 현재 시나리오 정보 가져오기 (LogsTab에서 사용)
 *
 * src/data/hourly-data/ 번들 데이터의 getHourlyData()를 사용.
 * JSON의 _scenario 필드는 HourlyData 타입에 선언되지 않았으므로 캐스팅.
 */
export async function getCurrentScenario(): Promise<{
  scenario: string;
  hour: number;
} | null> {
  try {
    const koreaTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Seoul',
    });
    const koreaDate = new Date(koreaTime);
    const currentHour = koreaDate.getHours();

    const hourlyData = getHourlyData(currentHour);
    if (!hourlyData) return null;

    return {
      scenario:
        (hourlyData as unknown as { _scenario?: string })._scenario || '',
      hour: currentHour,
    };
  } catch {
    return null;
  }
}
