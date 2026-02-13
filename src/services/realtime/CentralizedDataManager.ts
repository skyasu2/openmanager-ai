/**
 * 🚀 중앙화된 데이터 관리자 v1.0
 *
 * 프로덕션 성능 최적화를 위한 중앙 데이터 관리 시스템
 * - 단일 API 호출로 모든 구독자에게 데이터 전달
 * - 가시성 기반 업데이트 최적화
 * - 메모리 효율적인 구독 관리
 * - API 호출량 70% 감소 목표
 */

import { logger } from '@/lib/logging';
import type { Server } from '@/types/server';

type DataType = 'servers' | 'metrics' | 'network' | 'system';
type UpdateCallback<T = unknown> = (data: T) => void;

interface Subscriber {
  id: string;
  callback: UpdateCallback;
  dataType: DataType;
  isVisible: boolean;
  lastUpdate: number;
}

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class CentralizedDataManager {
  private static instance: CentralizedDataManager;
  private subscribers = new Map<string, Subscriber>();
  private cache = new Map<DataType, CacheEntry>();
  private updateInterval: NodeJS.Timeout | null = null;
  private isUpdating = false;

  // 설정
  private readonly UPDATE_INTERVAL = 30000; // 30초 (서버와 동기화)
  private readonly CACHE_TTL = 25000; // 25초 (약간 짧게 설정)
  private readonly BATCH_SIZE = 50; // 한 번에 업데이트할 최대 구독자 수

  private constructor() {
    this.startPolling();
  }

  static getInstance(): CentralizedDataManager {
    if (!CentralizedDataManager.instance) {
      CentralizedDataManager.instance = new CentralizedDataManager();
    }
    return CentralizedDataManager.instance;
  }

  /** 테스트 격리용: 싱글톤 인스턴스 리셋 */
  static resetForTesting(): void {
    if (process.env.NODE_ENV !== 'test') return;
    CentralizedDataManager.instance?.cleanup();
    CentralizedDataManager.instance =
      undefined as unknown as CentralizedDataManager;
  }

  /**
   * 구독 등록
   */
  subscribe<T = unknown>(
    id: string,
    callback: UpdateCallback<T>,
    dataType: DataType,
    _options?: { priority?: number }
  ): () => void {
    const subscriber: Subscriber = {
      id,
      callback: callback as UpdateCallback,
      dataType,
      isVisible: true,
      lastUpdate: 0,
    };

    this.subscribers.set(id, subscriber);

    // 캐시된 데이터가 있으면 즉시 전달
    const cached = this.cache.get(dataType);
    if (cached && cached.expiresAt > Date.now()) {
      callback(cached.data as T);
      subscriber.lastUpdate = Date.now();
    } else {
      // 캐시가 없으면 즉시 한 번 페치
      void this.fetchDataForType(dataType);
    }

    logger.info(
      `✅ 구독 등록: ${id} (${dataType}), 총 구독자: ${this.subscribers.size}`
    );

    // 구독 해제 함수 반환
    return () => {
      this.subscribers.delete(id);
      logger.info(`📡 구독 해제: ${id}, 남은 구독자: ${this.subscribers.size}`);

      // 구독자가 없으면 폴링 중지
      if (this.subscribers.size === 0) {
        this.stopPolling();
      }
    };
  }

  /**
   * 가시성 업데이트
   */
  updateVisibility(subscriberId: string, isVisible: boolean): void {
    const subscriber = this.subscribers.get(subscriberId);
    if (subscriber) {
      subscriber.isVisible = isVisible;
      logger.info(`👁️ 가시성 업데이트: ${subscriberId} = ${isVisible}`);
    }
  }

  /**
   * 특정 데이터 타입 강제 업데이트
   */
  async forceUpdate(dataType: DataType): Promise<void> {
    logger.info(`🔄 강제 업데이트 요청: ${dataType}`);
    await this.fetchDataForType(dataType);
  }

  /**
   * 데이터 타입별 페치
   */
  private async fetchDataForType(dataType: DataType): Promise<void> {
    try {
      let data: unknown;
      const timestamp = Date.now();

      switch (dataType) {
        case 'servers':
          data = await this.fetchServers();
          break;
        case 'metrics':
          data = await this.fetchMetrics();
          break;
        case 'network':
          data = await this.fetchNetworkData();
          break;
        case 'system':
          data = await this.fetchSystemData();
          break;
      }

      // 캐시 업데이트
      this.cache.set(dataType, {
        data,
        timestamp,
        expiresAt: timestamp + this.CACHE_TTL,
      });

      // 해당 타입의 가시적인 구독자들에게만 전달
      this.distributeToSubscribers(dataType, data);
    } catch (error) {
      logger.error(`❌ 데이터 페치 실패 (${dataType}):`, error);
    }
  }

  /**
   * 서버 데이터 페치
   * v5.87: /api/servers-unified 사용
   * - 개발/테스트 환경: auth middleware bypass
   * - 프로덕션: 인증 필요
   */
  private async fetchServers(): Promise<Server[]> {
    const response = await fetch('/api/servers-unified', {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result: { success?: boolean; data?: Server[] } =
      await response.json();
    return result.data ?? [];
  }

  /**
   * 메트릭 데이터 페치
   * v5.87: 서버 데이터에서 메트릭 추출 (type 쿼리 파라미터 미지원)
   */
  private async fetchMetrics(): Promise<unknown> {
    const servers = await this.fetchServers();
    // 서버 데이터에서 메트릭 정보 추출
    return servers.map((server) => ({
      id: server.id,
      cpu: server.cpu,
      memory: server.memory,
      disk: server.disk,
      network: server.network,
    }));
  }

  /**
   * 네트워크 데이터 페치
   * v5.87: 서버 데이터에서 네트워크 정보 추출
   */
  private async fetchNetworkData(): Promise<unknown> {
    const servers = await this.fetchServers();
    return servers.map((server) => ({
      id: server.id,
      network: server.network,
      status: server.status,
    }));
  }

  /**
   * 시스템 데이터 페치
   * v5.87: 서버 데이터에서 시스템 정보 추출
   */
  private async fetchSystemData(): Promise<unknown> {
    const servers = await this.fetchServers();
    return servers.map((server) => ({
      id: server.id,
      name: server.name,
      status: server.status,
      uptime: server.uptime,
    }));
  }

  /**
   * 구독자들에게 데이터 배포
   */
  private distributeToSubscribers(dataType: DataType, data: unknown): void {
    const now = Date.now();
    const relevantSubscribers = Array.from(this.subscribers.values())
      .filter((sub) => sub.dataType === dataType && sub.isVisible)
      .slice(0, this.BATCH_SIZE); // 배치 크기 제한

    logger.info(
      `📤 데이터 배포: ${dataType}에 ${relevantSubscribers.length}명`
    );

    relevantSubscribers.forEach((subscriber) => {
      try {
        subscriber.callback(data);
        subscriber.lastUpdate = now;
      } catch (error) {
        logger.error(`❌ 구독자 업데이트 실패 (${subscriber.id}):`, error);
      }
    });
  }

  /**
   * 폴링 시작
   */
  private startPolling(): void {
    if (this.updateInterval) return;

    this.updateInterval = setInterval(() => {
      void (async () => {
        if (this.isUpdating || this.subscribers.size === 0) return;

        this.isUpdating = true;
        logger.info(
          `🔄 정기 업데이트 시작 (구독자: ${this.subscribers.size}명)`
        );

        try {
          // 사용 중인 데이터 타입만 업데이트
          const activeDataTypes = new Set(
            Array.from(this.subscribers.values())
              .filter((sub) => sub.isVisible)
              .map((sub) => sub.dataType)
          );

          // 병렬로 데이터 페치
          await Promise.all(
            Array.from(activeDataTypes).map((type) =>
              this.fetchDataForType(type)
            )
          );
        } catch (error) {
          logger.error('❌ 정기 업데이트 실패:', error);
        } finally {
          this.isUpdating = false;
        }
      })();
    }, this.UPDATE_INTERVAL);

    logger.info('✅ 중앙 데이터 관리자 폴링 시작');
  }

  /**
   * 폴링 중지
   */
  private stopPolling(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      logger.info('⏹️ 중앙 데이터 관리자 폴링 중지');
    }
  }

  /**
   * 통계 정보
   */
  getStats() {
    const visibleCount = Array.from(this.subscribers.values()).filter(
      (sub) => sub.isVisible
    ).length;

    return {
      totalSubscribers: this.subscribers.size,
      visibleSubscribers: visibleCount,
      cacheSize: this.cache.size,
      isPolling: !!this.updateInterval,
      dataTypes: Array.from(
        new Set(
          Array.from(this.subscribers.values()).map((sub) => sub.dataType)
        )
      ),
    };
  }

  /**
   * 정리 (폴링 중지, 구독자/캐시 해제)
   */
  cleanup(): void {
    this.stopPolling();
    this.subscribers.clear();
    this.cache.clear();
    logger.info('🧹 중앙 데이터 관리자 정리 완료');
  }

  /** cleanup의 alias (일관된 lifecycle API) */
  destroy(): void {
    this.cleanup();
  }
}

// 싱글톤 인스턴스 export
export const centralDataManager = CentralizedDataManager.getInstance();

// 편의 함수들
export function useCentralizedData<T = unknown>(
  subscriberId: string,
  dataType: DataType,
  callback: UpdateCallback<T>
): () => void {
  return centralDataManager.subscribe<T>(subscriberId, callback, dataType);
}

export function updateDataVisibility(
  subscriberId: string,
  isVisible: boolean
): void {
  centralDataManager.updateVisibility(subscriberId, isVisible);
}

export function getCentralDataStats() {
  return centralDataManager.getStats();
}
