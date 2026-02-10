/**
 * 🎯 **Single Source of Truth** - 24시간 시나리오 데이터 로더
 *
 * Public API facade that re-exports from focused submodules.
 *
 * **v5.85.0 개선**: Dashboard/AI Engine 데이터 동기화
 * - ✅ JSON 파일 기반 (10분 간격)
 * - ✅ Dashboard와 AI Engine 동일 데이터 사용
 * - ✅ 변형은 sync 스크립트에서 미리 적용
 *
 * @see scripts/data/sync-hourly-data.ts - JSON 생성 스크립트
 * @see docs/reference/architecture/data/data-architecture.md - 아키텍처 문서
 */

import { logger } from '@/lib/logging';
import { loadHourlyJsonFile } from '@/services/scenario/scenario-cache';
import {
  convertToEnhancedMetrics,
  targetToRawServerData,
} from '@/services/scenario/scenario-transformer';
import type { EnhancedServerMetrics } from '@/services/scenario/scenario-types';

// ── Re-exports (public API) ────────────────────────────────────────
export type {
  EnhancedServerMetrics,
  HourlyJsonData,
  PrometheusTargetData,
  RawServerData,
  ScenarioLogEntry,
} from '@/services/scenario/scenario-types';

export { clearJsonCache } from '@/services/scenario/scenario-cache';
export { generateScenarioLogs } from '@/services/scenario/scenario-logs';

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
export async function loadHourlyScenarioData(): Promise<
  EnhancedServerMetrics[]
> {
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
      logger.error(`[ScenarioLoader] hour-${currentHour} 데이터 없음`);
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
      logger.error(`[ScenarioLoader] dataPoint[${clampedIndex}] 없음`);
      return [];
    }

    // PrometheusTarget → RawServerData → EnhancedServerMetrics 변환
    return Object.values(dataPoint.targets).map((target) =>
      convertToEnhancedMetrics(targetToRawServerData(target), currentHour)
    );
  } catch (error) {
    logger.error('[ScenarioLoader] 데이터 로드 오류:', error);
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
