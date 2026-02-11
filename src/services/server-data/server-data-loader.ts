/**
 * Single Source of Truth - 24시간 서버 데이터 로더
 *
 * Public API facade that re-exports from focused submodules.
 *
 * @see scripts/data/sync-hourly-data.ts - JSON 생성 스크립트
 * @see docs/reference/architecture/data/data-architecture.md - 아키텍처 문서
 */

import { logger } from '@/lib/logging';
import { loadHourlyJsonFile } from '@/services/server-data/server-data-cache';
import {
  convertToEnhancedMetrics,
  targetToRawServerData,
} from '@/services/server-data/server-data-transformer';
import type { EnhancedServerMetrics } from '@/services/server-data/server-data-types';

export { clearJsonCache } from '@/services/server-data/server-data-cache';
export { generateServerLogs } from '@/services/server-data/server-data-logs';
export {
  buildLogQL,
  buildLokiPushPayload,
  generateLokiLogs,
  groupIntoStreams,
} from '@/services/server-data/loki-log-generator';
export type { ServerContext } from '@/services/server-data/loki-log-generator';
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

// ── Main orchestration functions ───────────────────────────────────

/**
 * 🎯 Load Server Data from JSON Files (SSOT)
 *
 * Dashboard와 AI Engine이 동일한 데이터를 사용합니다.
 * - 데이터 소스: `/hourly-data/hour-XX.json`
 * - 간격: 10분 (6개 dataPoints/시간)
 * - 변형: sync 스크립트에서 미리 적용됨
 *
 * @returns {Promise<EnhancedServerMetrics[]>} 15개 서버 메트릭스
 */
export async function loadHourlyServerData(): Promise<EnhancedServerMetrics[]> {
  try {
    // 🇰🇷 KST (Asia/Seoul) 기준 시간 사용
    const koreaTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Seoul',
    });
    const koreaDate = new Date(koreaTime);

    const currentHour = koreaDate.getHours(); // 0-23
    const currentMinute = koreaDate.getMinutes(); // 0-59

    // JSON 파일 로드
    const hourlyData = await loadHourlyJsonFile(currentHour);
    if (!hourlyData) {
      logger.error(`[ServerDataLoader] hour-${currentHour} 데이터 없음`);
      return [];
    }

    // 10분 간격 dataPoint 선택 (0-5 인덱스)
    const dataPointIndex = Math.floor(currentMinute / 10);
    const clampedIndex = Math.min(
      dataPointIndex,
      hourlyData.dataPoints.length - 1
    );
    const dataPoint = hourlyData.dataPoints[clampedIndex];

    if (!dataPoint?.targets) {
      logger.error(`[ServerDataLoader] dataPoint[${clampedIndex}] 없음`);
      return [];
    }

    // PrometheusTarget → RawServerData → EnhancedServerMetrics 변환
    return Object.values(dataPoint.targets).map((target) =>
      convertToEnhancedMetrics(targetToRawServerData(target), currentHour)
    );
  } catch (error) {
    logger.error('[ServerDataLoader] 데이터 로드 오류:', error);
    return [];
  }
}

/**
 * 🎯 현재 시나리오 정보 가져오기
 *
 * @returns {Promise<{scenario: string, hour: number} | null>}
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

    const hourlyData = await loadHourlyJsonFile(currentHour);
    if (!hourlyData) return null;

    return {
      scenario: hourlyData._scenario || '', // _scenario에서 읽어서 내부 scenario로 매핑
      hour: currentHour,
    };
  } catch {
    return null;
  }
}
