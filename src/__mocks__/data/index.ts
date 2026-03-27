/**
 * Mock 데이터 시스템 - 통합 진입점
 */

export * from './mockDataGenerator';
export * from './mockDataRotator';
export * from './mockScenarios';
export * from './mockServerConfig';

import type { Server } from '@/types/server';
import { generateMockServerData } from './mockDataGenerator';
import type { MockDataRotator } from './mockDataRotator';
import { getRotatorInstance } from './mockDataRotator';

// HourlyServerState는 fixedHourlyData.ts에서 import함

export interface MockSystemConfig {
  autoRotate?: boolean;
  rotationInterval?: number;
  startScenario?:
    | 'random'
    | 'morning_crisis'
    | 'midnight_maintenance'
    | 'peak_load';
  speed?: number;
}

class MockSystem {
  private data: ReturnType<typeof generateMockServerData>;
  private rotator: MockDataRotator | null = null;

  constructor(config: MockSystemConfig = {}) {
    // 데이터 생성
    this.data = generateMockServerData();

    // 회전 시스템 초기화
    if (config.autoRotate !== false) {
      this.rotator = getRotatorInstance(this.data.timeSeries, {
        intervalMs: config.rotationInterval || 30000,
        speed: config.speed || 1,
      });
    }
  }

  /**
   * 현재 서버 목록 가져오기
   */
  getServers(): Server[] {
    if (this.rotator) {
      return this.rotator.updateServers(this.data.servers);
    }
    return this.data.servers;
  }

  /**
   * 자동 회전 시작
   */
  startAutoRotation(callback: (servers: Server[]) => void) {
    if (!this.rotator) {
      this.rotator = getRotatorInstance(this.data.timeSeries);
    }
    this.rotator.startRotation(callback, this.data.servers);
  }

  /**
   * 자동 회전 중지
   */
  stopAutoRotation() {
    this.rotator?.stopRotation();
  }

  /**
   * 시스템 상태 정보
   */
  /**
   * 시스템 정보 반환
   * @deprecated scenario 필드는 v2에서 제거됨 (하위 호환성 위해 null 유지)
   */
  getSystemInfo() {
    return {
      scenario: null, // @deprecated - 하위 호환성 위해 유지
      metadata: this.data.metadata,
      rotatorStatus: this.rotator?.getStatus() || null,
      serverCount: this.data.servers.length,
      criticalCount: this.data.servers.filter((s) => s.status === 'critical')
        .length,
      warningCount: this.data.servers.filter((s) => s.status === 'warning')
        .length,
    };
  }

  /**
   * 특정 시간으로 이동
   */
  jumpToTime(hour: number, minute: number = 0) {
    this.rotator?.jumpToTime(hour, minute);
  }

  /**
   * 재생 속도 변경
   */
  setSpeed(speed: number) {
    this.rotator?.setSpeed(speed);
  }

  /**
   * 시스템 리셋
   */
  reset() {
    this.stopAutoRotation();
    this.data = generateMockServerData();
    this.rotator = null;
  }
}

// 싱글톤 인스턴스
let mockSystemInstance: MockSystem | null = null;

/**
 * Mock 시스템 인스턴스 가져오기
 */
export function getMockSystem(config?: MockSystemConfig): MockSystem {
  // 서버 사이드에서는 autoRotate 비활성화
  const safeConfig = {
    ...config,
    autoRotate: typeof window !== 'undefined' ? config?.autoRotate : false,
  };

  if (!mockSystemInstance) {
    mockSystemInstance = new MockSystem(safeConfig);
  }
  return mockSystemInstance;
}

/**
 * Mock 시스템 리셋
 */
export function resetMockSystem() {
  if (mockSystemInstance) {
    mockSystemInstance.reset();
    mockSystemInstance = null;
  }
}

/**
 * 데모용 헬퍼 함수들
 */
export const mockHelpers = {
  // 랜덤 장애 발생
  triggerRandomIncident: () => {
    const system = getMockSystem();
    const hour = Math.floor(Math.random() * 24);
    system.jumpToTime(hour);
    return `장애 시나리오 시작: ${hour}시`;
  },

  // 정상 시간대로 이동
  jumpToNormalTime: () => {
    const system = getMockSystem();
    system.jumpToTime(10); // 오전 10시 - 대부분 정상
    return '정상 운영 시간대로 이동';
  },

  // 피크 시간대로 이동
  jumpToPeakTime: () => {
    const system = getMockSystem();
    system.jumpToTime(12); // 점심시간
    return '피크 시간대로 이동';
  },

  // 속도 조절
  speedUp: () => {
    const system = getMockSystem();
    system.setSpeed(5); // 5배속
    return '5배속 재생';
  },

  normalSpeed: () => {
    const system = getMockSystem();
    system.setSpeed(1); // 정상 속도
    return '정상 속도 재생';
  },
};
