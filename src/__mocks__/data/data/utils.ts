import { normalMetrics, SERVERS } from './constants';
import { SCENARIO_TIMELINES } from './scenarios';
import type { ScenarioPoint, ServerStatus } from './types';

/**
 * 변화 곡선 생성 함수
 */
export function generateCurve(
  startValue: number,
  endValue: number,
  points: number,
  curveType: 'linear' | 'exponential' | 'spike'
): number[] {
  const result: number[] = [];

  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    let value: number;

    switch (curveType) {
      case 'linear':
        value = startValue + (endValue - startValue) * progress;
        break;
      case 'exponential':
        // 천천히 시작, 빠르게 증가
        value = startValue + (endValue - startValue) * progress ** 2;
        break;
      case 'spike':
        // 급격한 증가 후 유지
        value =
          startValue + (endValue - startValue) * Math.min(1, progress * 2);
        break;
    }

    // 약간의 랜덤 노이즈 추가 (±2%)
    const noise = (Math.random() - 0.5) * value * 0.04;
    result.push(Math.max(0, Math.min(100, value + noise)));
  }

  return result;
}

/**
 * 24시간 데이터 생성 (5분 간격 = 288 포인트)
 * AI에게는 이 데이터만 노출됨 - 시나리오 힌트 없음!
 */
export function generate24HourData(serverId: string): ScenarioPoint[] {
  const data: ScenarioPoint[] = [];
  const server = SERVERS.find((s) => s.id === serverId);
  if (!server) throw new Error(`Server ${serverId} not found`);

  const pointsPerHour = 12; // 5분 간격

  // 각 시간대별로 적절한 시나리오 찾기
  for (let hour = 0; hour < 24; hour++) {
    // 해당 시간에 활성화된 시나리오 찾기
    const activeScenario = SCENARIO_TIMELINES.find(
      (s) => hour >= s.timeRange[0] && hour < s.timeRange[1]
    );

    if (!activeScenario) {
      // 시나리오 없음 - 정상 상태
      for (let min = 0; min < 60; min += 5) {
        const baseMetrics = normalMetrics[server.type];
        const noise = (Math.random() - 0.5) * 4;
        data.push({
          cpu: Math.max(0, Math.min(100, baseMetrics.cpu + noise)),
          memory: Math.max(0, Math.min(100, baseMetrics.memory + noise)),
          disk: baseMetrics.disk,
          network: Math.max(0, Math.min(100, baseMetrics.network + noise)),
          responseTime: baseMetrics.responseTime,
          errorRate: baseMetrics.errorRate,
        });
      }
      continue;
    }

    // 시나리오 내에서 현재 단계 찾기
    const currentHourInScenario = hour - activeScenario.timeRange[0];
    let accumulatedHours = 0;
    let currentPhase = null;
    let hourWithinPhase = 0;

    for (const phase of activeScenario.phases) {
      if (currentHourInScenario < accumulatedHours + phase.durationHours) {
        currentPhase = phase;
        hourWithinPhase = currentHourInScenario - accumulatedHours;
        break;
      }
      accumulatedHours += phase.durationHours;
    }

    if (!currentPhase) {
      // 폴백: 정상 상태
      for (let min = 0; min < 60; min += 5) {
        data.push({ ...normalMetrics[server.type] });
      }
      continue;
    }

    // 현재 단계에서 이 서버의 메트릭 찾기
    const serverMetric = currentPhase.serverMetrics.find(
      (sm) => sm.serverId === serverId
    );

    if (!serverMetric) {
      // 이 서버는 현재 단계에서 영향 없음
      for (let min = 0; min < 60; min += 5) {
        data.push({ ...normalMetrics[server.type] });
      }
      continue;
    }

    // 이 시간대(1시간)의 변화 곡선 생성
    const totalPointsInPhase = currentPhase.durationHours * pointsPerHour;
    const startPointInPhase = hourWithinPhase * pointsPerHour;

    const cpuCurve = generateCurve(
      serverMetric.metrics.cpu[0] ?? 0,
      serverMetric.metrics.cpu[1] ?? 0,
      totalPointsInPhase,
      serverMetric.curveType
    );
    const memoryCurve = generateCurve(
      serverMetric.metrics.memory[0] ?? 0,
      serverMetric.metrics.memory[1] ?? 0,
      totalPointsInPhase,
      serverMetric.curveType
    );
    const diskCurve = generateCurve(
      serverMetric.metrics.disk[0] ?? 0,
      serverMetric.metrics.disk[1] ?? 0,
      totalPointsInPhase,
      serverMetric.curveType
    );
    const networkCurve = generateCurve(
      serverMetric.metrics.network[0] ?? 0,
      serverMetric.metrics.network[1] ?? 0,
      totalPointsInPhase,
      serverMetric.curveType
    );

    let responseTimeCurve: number[] | undefined;
    let errorRateCurve: number[] | undefined;

    if (
      serverMetric.metrics.responseTime &&
      serverMetric.metrics.responseTime.length === 2
    ) {
      responseTimeCurve = generateCurve(
        serverMetric.metrics.responseTime[0] ?? 0,
        serverMetric.metrics.responseTime[1] ?? 0,
        totalPointsInPhase,
        serverMetric.curveType
      );
    }

    if (
      serverMetric.metrics.errorRate &&
      serverMetric.metrics.errorRate.length === 2
    ) {
      errorRateCurve = generateCurve(
        serverMetric.metrics.errorRate[0] ?? 0,
        serverMetric.metrics.errorRate[1] ?? 0,
        totalPointsInPhase,
        serverMetric.curveType
      );
    }

    // 이 시간의 12개 포인트 추출
    for (let i = 0; i < pointsPerHour; i++) {
      const pointIndex = startPointInPhase + i;
      data.push({
        cpu: cpuCurve[pointIndex] ?? 0,
        memory: memoryCurve[pointIndex] ?? 0,
        disk: diskCurve[pointIndex] ?? 0,
        network: networkCurve[pointIndex] ?? 0,
        responseTime: responseTimeCurve?.[pointIndex],
        errorRate: errorRateCurve?.[pointIndex],
      });
    }
  }

  return data;
}

/**
 * 서버 상태 판정 (메트릭 기반)
 * AI도 이 로직으로 상태를 추론할 수 있음
 */
export function getServerStatus(metrics: ScenarioPoint): ServerStatus {
  // Critical: CPU 85% 이상 OR Memory 90% 이상 OR Disk 92% 이상
  if (metrics.cpu >= 85 || metrics.memory >= 90 || metrics.disk >= 92) {
    return 'critical';
  }

  // Warning: CPU 70% 이상 OR Memory 75% 이상 OR Disk 85% 이상
  if (metrics.cpu >= 70 || metrics.memory >= 75 || metrics.disk >= 85) {
    return 'warning';
  }

  return 'online';
}
