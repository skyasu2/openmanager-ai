/**
 * Circuit Breaker Distributed State Store
 *
 * @description 분산 환경에서 Circuit Breaker 상태 공유를 위한 인터페이스 및 구현
 * @created 2026-02-10 - Extracted from circuit-breaker.ts
 */

import { logger } from '@/lib/logging';

// ============================================================================
// Interfaces
// ============================================================================

export interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailTime: number;
  threshold: number;
  resetTimeout: number;
}

/**
 * 분산 Circuit Breaker 상태 저장소 인터페이스
 * 서버리스 환경에서 인스턴스 간 상태 공유를 위해 구현
 */
export interface IDistributedStateStore {
  getState(serviceName: string): Promise<CircuitState | null>;
  setState(serviceName: string, state: CircuitState): Promise<void>;
  incrementFailures(serviceName: string): Promise<number>;
  resetState(serviceName: string): Promise<void>;
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

/**
 * 인메모리 상태 저장소 (기본 구현)
 * 서버리스에서는 인스턴스 간 공유되지 않음 - Redis로 교체 권장
 */
export class InMemoryStateStore implements IDistributedStateStore {
  private states = new Map<string, CircuitState>();

  async getState(serviceName: string): Promise<CircuitState | null> {
    return this.states.get(serviceName) || null;
  }

  async setState(serviceName: string, state: CircuitState): Promise<void> {
    this.states.set(serviceName, state);
  }

  async incrementFailures(serviceName: string): Promise<number> {
    const state = this.states.get(serviceName);
    if (state) {
      state.failures += 1;
      state.lastFailTime = Date.now();
      return state.failures;
    }
    return 0;
  }

  async resetState(serviceName: string): Promise<void> {
    this.states.delete(serviceName);
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let defaultStateStore: IDistributedStateStore = new InMemoryStateStore();
let redisInitialized = false;

export function setDistributedStateStore(store: IDistributedStateStore): void {
  defaultStateStore = store;
  redisInitialized = true;
}

export function getDistributedStateStore(): IDistributedStateStore {
  return defaultStateStore;
}

export function isRedisStateStoreInitialized(): boolean {
  return redisInitialized;
}

/**
 * Redis Circuit Breaker Store 자동 초기화
 * Redis가 활성화되어 있으면 분산 상태 저장소로 자동 전환
 */
export async function ensureRedisStateStore(): Promise<boolean> {
  if (redisInitialized) return true;

  try {
    const { initializeRedisCircuitBreaker } = await import(
      '@/lib/redis/circuit-breaker-store'
    );
    const result = await initializeRedisCircuitBreaker();
    if (result) {
      logger.info('[CircuitBreaker] Redis 분산 상태 저장소 초기화 성공');
    }
    return result;
  } catch (error) {
    logger.warn(
      '[CircuitBreaker] Redis 초기화 실패, InMemory fallback 사용 (서버리스 인스턴스 간 상태 미공유)',
      { error }
    );
    return false;
  }
}
