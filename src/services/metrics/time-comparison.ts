/**
 * Time Comparison Utilities
 *
 * 서버 메트릭의 시간대별 비교 기능
 *
 * @created 2026-02-10 (MetricsProvider.ts SRP 분리)
 */

import { getServerStatus as getRulesServerStatus } from '@/config/rules/loader';
import { FIXED_24H_DATASETS, getDataAtMinute } from '@/data/fixed-24h-metrics';
import { calculateRelativeDateTime } from './kst-time';
import type { ApiServerMetrics, TimeComparisonResult } from './types';

/**
 * 상대 시간 기준 메트릭 조회 (날짜 포함)
 * @param serverId 서버 ID
 * @param minutesAgo 몇 분 전 (0 = 현재)
 */
export function getMetricsAtRelativeTime(
  serverId: string,
  minutesAgo: number = 0
): (ApiServerMetrics & { dateLabel: string; isYesterday: boolean }) | null {
  const { date, slotIndex, timestamp, isYesterday } =
    calculateRelativeDateTime(minutesAgo);
  const minuteOfDay = slotIndex * 10;

  const dataset = FIXED_24H_DATASETS.find((d) => d.serverId === serverId);
  if (!dataset) return null;

  const dataPoint = getDataAtMinute(dataset, minuteOfDay);
  if (!dataPoint) return null;

  const status = getRulesServerStatus({
    cpu: dataPoint.cpu,
    memory: dataPoint.memory,
    disk: dataPoint.disk,
    network: dataPoint.network,
  });

  return {
    serverId: dataset.serverId,
    serverType: dataset.serverType,
    location: dataset.location,
    timestamp,
    minuteOfDay,
    cpu: dataPoint.cpu,
    memory: dataPoint.memory,
    disk: dataPoint.disk,
    network: dataPoint.network,
    logs: dataPoint.logs,
    status,
    dateLabel: isYesterday ? `${date} (어제)` : date,
    isYesterday,
  };
}

/**
 * 서버 메트릭 시간 비교
 */
export function compareServerMetrics(
  serverId: string,
  minutesAgo: number
): TimeComparisonResult | null {
  const current = getMetricsAtRelativeTime(serverId, 0);
  const past = getMetricsAtRelativeTime(serverId, minutesAgo);

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
