/**
 * Circuit Breaker Distributed State Store
 *
 * @description
 * 분산 환경에서 Circuit Breaker 상태 공유를 위한 인터페이스 및 구현입니다.
 * 현재 AI circuit breaker request path는 in-memory 상태만 사용하며,
 * 이 모듈은 future/internal Redis 연결점으로 보존합니다.
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
 * 현재 request path에서는 사용하지 않으며, 향후 인스턴스 간 상태 공유를
 * 실제로 연결할 때 사용할 내부 계약입니다.
 *
 * @internal
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
 * 현재 request path의 AIServiceCircuitBreaker는 이 저장소도 직접 읽지 않고
 * 클래스 인스턴스 필드만 사용합니다. 이 구현은 Redis-backed store 테스트와
 * future/internal 연결점 보존을 위한 기본 구현입니다.
 *
 * @internal
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

// Redis-backed store injection을 위한 future/internal 연결점입니다.
// 현재 breaker 상태 전이는 AIServiceCircuitBreaker 인스턴스 필드만 사용합니다.
let _defaultStateStore: IDistributedStateStore = new InMemoryStateStore();
let redisInitialized = false;
let redisInitPromise: Promise<boolean> | null = null;

/** @internal */
export function setDistributedStateStore(store: IDistributedStateStore): void {
  _defaultStateStore = store;
  redisInitialized = true;
}

/** @internal */
export function isRedisStateStoreInitialized(): boolean {
  return redisInitialized;
}

/**
 * Redis Circuit Breaker Store 수동 초기화 연결점입니다.
 *
 * 현재 request path에서는 호출하지 않습니다. 향후 분산 CB 상태를 실제로
 * 연결할 때 명시적으로 호출하기 위한 내부 API로 보존합니다.
 *
 * @internal
 */
export async function ensureRedisStateStore(): Promise<boolean> {
  if (redisInitialized) return true;
  if (redisInitPromise) return redisInitPromise;

  redisInitPromise = (async () => {
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
    } finally {
      redisInitPromise = null;
    }
  })();

  return redisInitPromise;
}
