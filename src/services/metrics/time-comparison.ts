/**
 * Time Comparison Utilities
 *
 * 서버 메트릭의 시간대별 비교 기능
 * OTel → hourly-data 2-tier 체계 사용 (MetricsProvider 경유)
 *
 * @created 2026-02-10 (MetricsProvider.ts SRP 분리)
 * @updated 2026-02-12 (fixed-24h-metrics 제거, OTel 단일 소스 통합)
 */

import { calculateRelativeDateTime } from './kst-time';
import { MetricsProvider } from './MetricsProvider';
import type { ApiServerMetrics, TimeComparisonResult } from './types';

/**
 * 상대 시간 기준 메트릭 조회 (날짜 포함)
 * @param serverId 서버 ID
 * @param minutesAgo 몇 분 전 (0 = 현재)
 */
export async function getMetricsAtRelativeTime(
  serverId: string,
  minutesAgo: number = 0
): Promise<
  (ApiServerMetrics & { dateLabel: string; isYesterday: boolean }) | null
> {
  const { date, slotIndex, timestamp, isYesterday } =
    calculateRelativeDateTime(minutesAgo);
  const minuteOfDay = slotIndex * 10;

  const provider = MetricsProvider.getInstance();
  const metrics = await provider.getMetricsAtTime(serverId, minuteOfDay);
  if (!metrics) return null;

  return {
    ...metrics,
    timestamp,
    minuteOfDay,
    dateLabel: isYesterday ? `${date} (어제)` : date,
    isYesterday,
  };
}

/**
 * 서버 메트릭 시간 비교
 */
export async function compareServerMetrics(
  serverId: string,
  minutesAgo: number
): Promise<TimeComparisonResult | null> {
  const current = await getMetricsAtRelativeTime(serverId, 0);
  const past = await getMetricsAtRelativeTime(serverId, minutesAgo);

  if (!current || !past) return null;

  return {
    current: {
      timestamp: current.timestamp,
      date: current.dateLabel,
      metrics: current,
    },
    past: {
      timestamp: past.timestamp,
      date: past.dateLabel,
      metrics: past,
    },
    delta: {
      cpu: Math.round((current.cpu - past.cpu) * 10) / 10,
      memory: Math.round((current.memory - past.memory) * 10) / 10,
      disk: Math.round((current.disk - past.disk) * 10) / 10,
      network: Math.round((current.network - past.network) * 10) / 10,
    },
  };
}
