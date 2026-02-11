/**
 * HealthCalculator - 시스템 건강도 점수 계산 (0~100)
 *
 * 메트릭 + Alert → 건강도 점수
 *
 * healthScore = 100
 *   - (criticalCount * 15)
 *   - (warningCount * 5)
 *   - (avgCpuPenalty)
 *   - (longFiringPenalty)
 *
 * @created 2026-02-04
 */

import type { Alert } from './AlertManager';
import type { AggregatedMetrics } from './MetricsAggregator';

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type HealthReport = {
  score: number;
  grade: HealthGrade;
  penalties: {
    criticalAlerts: number;
    warningAlerts: number;
    highCpuAvg: number;
    highMemoryAvg: number;
    highDiskAvg: number;
    longFiringAlerts: number;
  };
};

function getGrade(score: number): HealthGrade {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export class HealthCalculator {
  calculate(
    aggregated: AggregatedMetrics,
    firingAlerts: Alert[]
  ): HealthReport {
    const criticalCount = firingAlerts.filter(
      (a) => a.severity === 'critical'
    ).length;
    const warningCount = firingAlerts.filter(
      (a) => a.severity === 'warning'
    ).length;

    // penalty: critical은 -15, warning은 -5
    const criticalPenalty = criticalCount * 15;
    const warningPenalty = warningCount * 5;

    // penalty: 평균 CPU가 70 이상이면 추가 감점
    const avgCpuPenalty =
      aggregated.avgCpu >= 70 ? Math.round((aggregated.avgCpu - 70) * 0.5) : 0;

    // penalty: 평균 Memory가 80 이상이면 추가 감점
    const avgMemoryPenalty =
      aggregated.avgMemory >= 80
        ? Math.round((aggregated.avgMemory - 80) * 0.4)
        : 0;

    // penalty: 평균 Disk가 85 이상이면 추가 감점
    const avgDiskPenalty =
      aggregated.avgDisk >= 85
        ? Math.round((aggregated.avgDisk - 85) * 0.3)
        : 0;

    // penalty: 5분 이상 firing 중인 alert에 추가 감점
    const longFiringCount = firingAlerts.filter((a) => a.duration > 300).length;
    const longFiringPenalty = longFiringCount * 3;

    const score = Math.max(
      0,
      Math.min(
        100,
        100 -
          criticalPenalty -
          warningPenalty -
          avgCpuPenalty -
          avgMemoryPenalty -
          avgDiskPenalty -
          longFiringPenalty
      )
    );

    return {
      score,
      grade: getGrade(score),
      penalties: {
        criticalAlerts: criticalPenalty,
        warningAlerts: warningPenalty,
        highCpuAvg: avgCpuPenalty,
        highMemoryAvg: avgMemoryPenalty,
        highDiskAvg: avgDiskPenalty,
        longFiringAlerts: longFiringPenalty,
      },
    };
  }
}
