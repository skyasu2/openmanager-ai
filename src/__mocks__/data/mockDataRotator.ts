/**
 * 실시간 데이터 회전 메커니즘 (5분 간격 → 1분 보간)
 * 24시간 데이터 (288개 포인트)를 순환시켜 실시간 모니터링 효과 생성
 * 1분마다 UI 업데이트, 선형 보간으로 부드러운 전환
 */

import type { Server } from '@/types/server';
import type { ScenarioPoint, ServerTimeSeriesData } from './mockDataGenerator';
import { getServerStatus as getMetricBasedStatus } from './mockScenarios';

export interface RotationConfig {
  intervalMs: number; // UI 업데이트 간격 (기본: 60000ms = 1분)
  dataIntervalMs: number; // 실제 데이터 간격 (300000ms = 5분)
  startOffset: number; // 시작 오프셋 (0-287)
  speed: number; // 재생 속도 배수 (1 = 실시간, 2 = 2배속)
}

export class MockDataRotator {
  private config: RotationConfig;
  private currentDataIndex: number; // 현재 5분 구간 인덱스 (0-287)
  private startTime: number;
  private timeSeries: Record<string, ServerTimeSeriesData>;
  private rotationTimer?: NodeJS.Timeout;
  private updateCallback?: (servers: Server[]) => void;

  constructor(
    timeSeries: Record<string, ServerTimeSeriesData>,
    config: Partial<RotationConfig> = {}
  ) {
    this.config = {
      intervalMs: 60000, // 1분마다 UI 업데이트
      dataIntervalMs: 300000, // 5분 간격 데이터
      startOffset: Math.floor(Math.random() * 288), // 랜덤 시작점 (0-287)
      speed: 1,
      ...config,
    };

    this.currentDataIndex = this.config.startOffset;
    this.startTime = Date.now();
    this.timeSeries = timeSeries;
  }

  /**
   * 현재 데이터 인덱스 계산 (5분 구간)
   */
  private calculateCurrentDataIndex(): number {
    const elapsed = Date.now() - this.startTime;
    const dataIntervals = Math.floor(
      elapsed / (this.config.dataIntervalMs / this.config.speed)
    );
    return (this.config.startOffset + dataIntervals) % 288; // 288개 포인트 순환
  }

  /**
   * 5분 구간 내 진행률 계산 (0.0 ~ 1.0)
   * 1분마다 0.2씩 증가 (5분 = 1.0)
   */
  private calculateInterpolationProgress(): number {
    const elapsed = Date.now() - this.startTime;
    const progressWithinInterval =
      (elapsed % (this.config.dataIntervalMs / this.config.speed)) /
      (this.config.dataIntervalMs / this.config.speed);
    return Math.min(1.0, progressWithinInterval);
  }

  /**
   * 선형 보간 함수
   */
  private interpolate(
    current: ScenarioPoint,
    next: ScenarioPoint,
    progress: number
  ): ScenarioPoint {
    return {
      cpu: current.cpu + (next.cpu - current.cpu) * progress,
      memory: current.memory + (next.memory - current.memory) * progress,
      disk: current.disk + (next.disk - current.disk) * progress,
      network: current.network + (next.network - current.network) * progress,
      responseTime:
        (current.responseTime || 0) +
        ((next.responseTime || 0) - (current.responseTime || 0)) * progress,
      errorRate:
        (current.errorRate || 0) +
        ((next.errorRate || 0) - (current.errorRate || 0)) * progress,
    };
  }

  /**
   * 현재 시점의 메트릭 가져오기 (1분마다 보간된 값)
   */
  getCurrentMetrics(serverId: string): ScenarioPoint {
    const data = this.timeSeries[serverId]?.data;
    if (!data || data.length === 0) {
      return { cpu: 0, memory: 0, disk: 0, network: 0 };
    }

    // 현재 5분 구간 인덱스
    this.currentDataIndex = this.calculateCurrentDataIndex();

    // 현재 및 다음 데이터 포인트
    const current = data[this.currentDataIndex];
    const nextIndex = (this.currentDataIndex + 1) % data.length;
    const next = data[nextIndex];

    // 안전성 체크
    if (!current) {
      return { cpu: 0, memory: 0, disk: 0, network: 0 };
    }

    if (!next) {
      return {
        cpu: current.cpu,
        memory: current.memory,
        disk: current.disk,
        network: current.network,
        responseTime: current.responseTime ?? 0,
        errorRate: current.errorRate ?? 0,
      };
    }

    // 구간 내 진행률 (0.0 ~ 1.0)
    const progress = this.calculateInterpolationProgress();

    // 선형 보간
    return this.interpolate(current, next, progress);
  }

  /**
   * 서버 목록 업데이트 (순수 메트릭 기반)
   */
  updateServers(servers: Server[]): Server[] {
    return servers.map((server) => {
      const metrics = this.getCurrentMetrics(server.id);

      // 메트릭 기반 상태 결정 (AI-blind)
      const status = getMetricBasedStatus(metrics);

      return {
        ...server,
        cpu: Math.round(metrics.cpu),
        memory: Math.round(metrics.memory),
        disk: Math.round(metrics.disk),
        network: Math.round(metrics.network),
        status,
        lastUpdate: new Date(),
        alerts: status !== 'online' ? 1 : 0,
      };
    });
  }

  /**
   * 자동 회전 시작 (1분마다)
   */
  startRotation(callback: (servers: Server[]) => void, servers: Server[]) {
    this.updateCallback = callback;

    // 즉시 한 번 업데이트
    callback(this.updateServers(servers));

    // 1분마다 업데이트
    this.rotationTimer = setInterval(() => {
      callback(this.updateServers(servers));
    }, this.config.intervalMs / this.config.speed);
  }

  /**
   * 자동 회전 중지
   */
  stopRotation() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }

  /**
   * 현재 시뮬레이션 시간 가져오기
   */
  getCurrentSimulationTime(): { hour: number; minute: number; second: number } {
    // 288개 포인트, 5분 간격
    const totalMinutes = this.currentDataIndex * 5;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    // 구간 내 진행률을 분으로 변환 (0-5분)
    const progress = this.calculateInterpolationProgress();
    const additionalMinutes = Math.floor(progress * 5);

    return {
      hour: hours,
      minute: minutes + additionalMinutes,
      second: 0,
    };
  }

  /**
   * 특정 시간대로 점프
   */
  jumpToTime(hour: number, minute: number = 0) {
    // 5분 간격이므로 가장 가까운 5분 단위로 반올림
    const totalMinutes = hour * 60 + minute;
    const roundedMinutes = Math.floor(totalMinutes / 5) * 5;
    const targetIndex = Math.floor(roundedMinutes / 5);

    this.currentDataIndex = Math.min(287, Math.max(0, targetIndex));
    this.startTime =
      Date.now() -
      (this.currentDataIndex * this.config.dataIntervalMs) / this.config.speed;

    // 콜백이 있으면 즉시 업데이트
    if (this.updateCallback) {
      const servers: Server[] = [];
      this.updateCallback(this.updateServers(servers));
    }
  }

  /**
   * 재생 속도 변경
   */
  setSpeed(speed: number) {
    this.config.speed = Math.max(0.1, Math.min(10, speed)); // 0.1x ~ 10x

    // 타이머 재시작
    if (this.rotationTimer && this.updateCallback) {
      this.stopRotation();
      const servers: Server[] = [];
      this.startRotation(this.updateCallback, servers);
    }
  }

  /**
   * 현재 상태 정보 (메타데이터 제거)
   */
  getStatus() {
    const simTime = this.getCurrentSimulationTime();

    return {
      currentDataIndex: this.currentDataIndex,
      totalDataPoints: 288,
      progress: (this.currentDataIndex / 288) * 100,
      interpolationProgress: this.calculateInterpolationProgress(),
      simulationTime: `${String(simTime.hour).padStart(2, '0')}:${String(simTime.minute).padStart(2, '0')}:${String(simTime.second).padStart(2, '0')}`,
      speed: this.config.speed,
      isRunning: !!this.rotationTimer,
    };
  }
}

// 싱글톤 인스턴스
let rotatorInstance: MockDataRotator | null = null;

export function getRotatorInstance(
  timeSeries?: Record<string, ServerTimeSeriesData>,
  config?: Partial<RotationConfig>
): MockDataRotator {
  if (!rotatorInstance && timeSeries) {
    rotatorInstance = new MockDataRotator(timeSeries, config);
  }

  if (!rotatorInstance) {
    throw new Error('MockDataRotator not initialized');
  }

  return rotatorInstance;
}

export function resetRotator() {
  if (rotatorInstance) {
    rotatorInstance.stopRotation();
    rotatorInstance = null;
  }
}
