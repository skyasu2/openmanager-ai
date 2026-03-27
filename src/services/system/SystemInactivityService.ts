/**
 * 시스템 비활성 서비스 v1.0
 * OpenManager AI - 베르셀 사용량 최적화
 *
 * 기능:
 * 1. 사용자 비활성 상태 감지
 * 2. 백그라운드 작업 중지/재개
 * 3. 베르셀 함수 호출 최소화
 * 4. 실시간 모니터링 중지
 */

import { logger } from '@/lib/logging';

interface BackgroundTask {
  id: string;
  name: string;
  intervalId?: NodeJS.Timeout;
  isActive: boolean;
  originalInterval: number;
}

class SystemInactivityService {
  private static instance: SystemInactivityService | null = null;
  private backgroundTasks: Map<string, BackgroundTask> = new Map();
  private isSystemActive: boolean = true;
  private inactivityCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this._initializeInactivityMonitoring();
  }

  static getInstance(): SystemInactivityService {
    if (!SystemInactivityService.instance) {
      SystemInactivityService.instance = new SystemInactivityService();
    }
    return SystemInactivityService.instance;
  }

  /**
   * 비활성 상태 모니터링 초기화
   */
  private _initializeInactivityMonitoring(): void {
    // 5초마다 localStorage 확인
    this.inactivityCheckInterval = setInterval(() => {
      this.checkSystemInactivity();
    }, 5000);

    logger.info('🔍 시스템 비활성 모니터링 시작');
  }

  /**
   * 시스템 비활성 상태 확인
   */
  private checkSystemInactivity(): void {
    if (typeof window === 'undefined') return;

    const systemInactive = localStorage.getItem('system_inactive') === 'true';

    if (systemInactive) {
      if (this.isSystemActive) {
        logger.info('⏸️ 시스템 비활성 감지 - 백그라운드 작업 중지');
        this.pauseAllBackgroundTasks();
        this.isSystemActive = false;
      }
    } else {
      if (!this.isSystemActive) {
        logger.info('▶️ 시스템 활성 복귀 - 백그라운드 작업 재개');
        this.resumeAllBackgroundTasks();
        this.isSystemActive = true;
      }
    }
  }

  /**
   * 백그라운드 작업 등록
   */
  registerBackgroundTask(
    id: string,
    name: string,
    callback: () => void,
    intervalMs: number
  ): void {
    // 기존 작업이 있으면 정리
    this.unregisterBackgroundTask(id);

    const task: BackgroundTask = {
      id,
      name,
      isActive: this.isSystemActive,
      originalInterval: intervalMs,
      intervalId: this.isSystemActive
        ? setInterval(callback, intervalMs)
        : undefined,
    };

    this.backgroundTasks.set(id, task);

    logger.info(`📝 백그라운드 작업 등록: ${name} (${intervalMs}ms)`);
  }

  /**
   * 백그라운드 작업 해제
   */
  unregisterBackgroundTask(id: string): void {
    const task = this.backgroundTasks.get(id);
    if (task) {
      if (task.intervalId) {
        clearInterval(task.intervalId);
      }
      this.backgroundTasks.delete(id);
      logger.info(`🗑️ 백그라운드 작업 해제: ${task.name}`);
    }
  }

  /**
   * 모든 백그라운드 작업 일시 중지
   */
  private pauseAllBackgroundTasks(): void {
    this.backgroundTasks.forEach((task, _id) => {
      if (task.intervalId) {
        clearInterval(task.intervalId);
        task.intervalId = undefined;
        task.isActive = false;
      }
    });

    logger.info(`⏸️ ${this.backgroundTasks.size}개 백그라운드 작업 일시 중지`);
  }

  /**
   * 모든 백그라운드 작업 재개
   */
  private resumeAllBackgroundTasks(): void {
    this.backgroundTasks.forEach((task, _id) => {
      if (!task.isActive && !task.intervalId) {
        // 원래 콜백 함수를 다시 얻어야 하므로, 실제로는 각 서비스에서 재등록하도록 신호를 보냄
        this.sendResumeSignal(task.id, task.name);
        task.isActive = true;
      }
    });

    logger.info(
      `▶️ ${this.backgroundTasks.size}개 백그라운드 작업 재개 신호 전송`
    );
  }

  /**
   * 재개 신호 전송 (CustomEvent 사용)
   */
  private sendResumeSignal(taskId: string, taskName: string): void {
    if (typeof window === 'undefined') return;

    const event = new CustomEvent('system-resume', {
      detail: { taskId, taskName },
    });
    window.dispatchEvent(event);
  }

  /**
   * 시스템 활성 상태 복귀 신호
   */
  resumeSystem(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem('system_inactive');
    localStorage.removeItem('auto_logout_time');

    logger.info('🔄 시스템 활성 상태 복귀');
  }

  /**
   * 시스템 비활성 상태 설정
   */
  pauseSystem(): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem('system_inactive', 'true');
    localStorage.setItem('auto_logout_time', new Date().toISOString());

    logger.info('⏸️ 시스템 비활성 상태 설정');
  }

  /**
   * 현재 시스템 상태 확인
   */
  isActive(): boolean {
    return this.isSystemActive;
  }

  /**
   * 등록된 백그라운드 작업 목록
   */
  getBackgroundTasks(): BackgroundTask[] {
    return Array.from(this.backgroundTasks.values());
  }

  /**
   * 베르셀 사용량 최적화를 위한 API 호출 제한
   */
  shouldMakeApiCall(endpoint: string): boolean {
    // 시스템이 비활성 상태면 중요한 API만 허용
    if (!this.isSystemActive) {
      const criticalEndpoints = ['/api/auth', '/api/health', '/api/emergency'];

      return criticalEndpoints.some((critical) => endpoint.includes(critical));
    }

    return true;
  }

  /**
   * 서비스 정리
   */
  destroy(): void {
    if (this.inactivityCheckInterval) {
      clearInterval(this.inactivityCheckInterval);
    }

    this.backgroundTasks.forEach((task) => {
      if (task.intervalId) {
        clearInterval(task.intervalId);
      }
    });

    this.backgroundTasks.clear();
    SystemInactivityService.instance = null;

    logger.info('🧹 시스템 비활성 서비스 정리 완료');
  }
}

// 전역 인스턴스 생성
export const systemInactivityService = SystemInactivityService.getInstance();

// NOTE: BackgroundTask 타입은 이 파일 내 정의를 직접 참조하세요.
// 일부 변환 환경에서 type 재내보내기를 런타임 값으로 해석할 수 있어 직접 참조 유지
