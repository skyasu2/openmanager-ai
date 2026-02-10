/**
 * AI 서비스 Circuit Breaker 패턴 구현
 *
 * Architecture (split into sub-modules):
 * - circuit-breaker/state-store.ts: 분산 상태 관리 (IDistributedStateStore, InMemory, Redis)
 * - circuit-breaker/events.ts: 이벤트 시스템 (CircuitBreakerEventEmitter)
 * - circuit-breaker.ts (this): Breaker 클래스 + Manager + Executor + Status
 *
 * @see https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker
 * @updated 2026-02-10 - Split into sub-modules (704 → ~440 lines)
 */

import { logger } from '@/lib/logging';

export type {
  CircuitBreakerEvent,
  CircuitBreakerEventType,
} from './circuit-breaker/events';
export { circuitBreakerEvents } from './circuit-breaker/events';
// ============================================================================
// Re-exports from sub-modules (backward compatibility)
// ============================================================================
export type {
  CircuitState,
  IDistributedStateStore,
} from './circuit-breaker/state-store';
export {
  ensureRedisStateStore,
  getDistributedStateStore,
  InMemoryStateStore,
  isRedisStateStoreInitialized,
  setDistributedStateStore,
} from './circuit-breaker/state-store';

import { circuitBreakerEvents } from './circuit-breaker/events';
// Internal imports
import {
  ensureRedisStateStore,
  isRedisStateStoreInitialized,
} from './circuit-breaker/state-store';

// ============================================================================
// Circuit Breaker 구현
// ============================================================================

/**
 * AI 서비스 Circuit Breaker
 *
 * ⚠️ 서버리스 한계: 이 클래스는 인스턴스별 로컬 상태를 사용합니다.
 * Vercel 멀티 인스턴스 환경에서는 인스턴스 간 상태가 공유되지 않으므로,
 * 인스턴스 A가 OPEN이어도 인스턴스 B는 CLOSED일 수 있습니다.
 */
export class AIServiceCircuitBreaker {
  private failures = 0;
  private readonly threshold: number;
  private lastFailTime = 0;
  private readonly resetTimeout: number;
  private readonly serviceName: string;
  private currentState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  constructor(serviceName: string, threshold = 3, resetTimeoutMs = 60000) {
    this.serviceName = serviceName;
    this.threshold = threshold;
    this.resetTimeout = resetTimeoutMs;
  }

  private transitionTo(newState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    if (this.currentState === newState) return;

    const previousState = this.currentState;
    this.currentState = newState;

    const eventTypeMap = {
      CLOSED: 'circuit_close',
      OPEN: 'circuit_open',
      HALF_OPEN: 'circuit_half_open',
    } as const;

    circuitBreakerEvents.emit({
      type: eventTypeMap[newState],
      service: this.serviceName,
      timestamp: Date.now(),
      details: {
        previousState,
        newState,
        failures: this.failures,
        threshold: this.threshold,
        resetTimeMs: this.resetTimeout,
      },
    });
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      const remainingTime = Math.ceil(
        (this.resetTimeout - (Date.now() - this.lastFailTime)) / 1000
      );
      throw new Error(
        `${this.serviceName} 서비스가 일시적으로 중단되었습니다. ${remainingTime}초 후 다시 시도해주세요.`
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      this.onFailure(errorInstance);

      const enhancedError = new Error(
        `${this.serviceName} 실행 실패 (${this.failures}/${this.threshold} 실패): ${errorInstance.message}`
      );
      enhancedError.stack = errorInstance.stack;

      throw enhancedError;
    }
  }

  private isOpen(): boolean {
    const isFailureThresholdExceeded = this.failures >= this.threshold;
    const isWithinResetTimeout =
      Date.now() - this.lastFailTime < this.resetTimeout;

    if (isFailureThresholdExceeded && !isWithinResetTimeout) {
      this.failures = this.threshold - 1;
      this.transitionTo('HALF_OPEN');
    }

    return isFailureThresholdExceeded && isWithinResetTimeout;
  }

  private onSuccess(): void {
    const wasOpen = this.currentState === 'HALF_OPEN';
    this.failures = 0;
    this.lastFailTime = 0;

    if (wasOpen) {
      this.transitionTo('CLOSED');
    }

    circuitBreakerEvents.emit({
      type: 'success',
      service: this.serviceName,
      timestamp: Date.now(),
      details: {
        newState: 'CLOSED',
        failures: 0,
      },
    });
  }

  private onFailure(error?: Error): void {
    this.failures += 1;
    this.lastFailTime = Date.now();

    circuitBreakerEvents.emit({
      type: 'failure',
      service: this.serviceName,
      timestamp: Date.now(),
      details: {
        failures: this.failures,
        threshold: this.threshold,
        error: error?.message,
      },
    });

    if (this.failures >= this.threshold) {
      this.transitionTo('OPEN');
    }
  }

  getStatus(): {
    serviceName: string;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    threshold: number;
    lastFailTime: number;
    resetTimeRemaining?: number;
  } {
    const now = Date.now();
    const isOpen = this.isOpen();
    const isHalfOpen =
      this.failures >= this.threshold - 1 && this.failures < this.threshold;

    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    if (isOpen) {
      state = 'OPEN';
    } else if (isHalfOpen) {
      state = 'HALF_OPEN';
    } else {
      state = 'CLOSED';
    }

    const result: ReturnType<typeof this.getStatus> = {
      serviceName: this.serviceName,
      state,
      failures: this.failures,
      threshold: this.threshold,
      lastFailTime: this.lastFailTime,
    };

    if (isOpen && this.lastFailTime > 0) {
      result.resetTimeRemaining = Math.max(
        0,
        this.resetTimeout - (now - this.lastFailTime)
      );
    }

    return result;
  }

  reset(): void {
    this.failures = 0;
    this.lastFailTime = 0;
    this.transitionTo('CLOSED');
  }
}

// ============================================================================
// Manager
// ============================================================================

class AICircuitBreakerManager {
  private breakers = new Map<string, AIServiceCircuitBreaker>();

  getBreaker(serviceName: string): AIServiceCircuitBreaker {
    let breaker = this.breakers.get(serviceName);
    if (!breaker) {
      breaker = new AIServiceCircuitBreaker(serviceName);
      this.breakers.set(serviceName, breaker);
    }
    return breaker;
  }

  getAllStatus() {
    const status: Record<
      string,
      ReturnType<AIServiceCircuitBreaker['getStatus']>
    > = {};

    for (const [serviceName, breaker] of this.breakers.entries()) {
      status[serviceName] = breaker.getStatus();
    }

    return status;
  }

  resetBreaker(serviceName: string): boolean {
    const breaker = this.breakers.get(serviceName);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}

export const aiCircuitBreaker = new AICircuitBreakerManager();

// ============================================================================
// Executor with Fallback
// ============================================================================

export interface ExecutionResult<T> {
  data: T;
  source: 'primary' | 'fallback';
  originalError?: Error;
}

export async function executeWithCircuitBreakerAndFallback<T>(
  serviceName: string,
  primaryFn: () => Promise<T>,
  fallbackFn: () => T | Promise<T>
): Promise<ExecutionResult<T>> {
  await ensureRedisStateStore();

  const breaker = aiCircuitBreaker.getBreaker(serviceName);
  const status = breaker.getStatus();

  if (status.state === 'OPEN') {
    logger.info(
      `[CircuitBreaker] ${serviceName}: OPEN 상태, 폴백 사용 (${status.resetTimeRemaining}ms 후 리셋)`
    );

    circuitBreakerEvents.emit({
      type: 'failover',
      service: serviceName,
      timestamp: Date.now(),
      details: {
        failoverFrom: 'primary',
        failoverTo: 'fallback',
        error: 'Circuit breaker is OPEN',
      },
    });

    const fallbackData = await fallbackFn();
    return { data: fallbackData, source: 'fallback' };
  }

  try {
    const result = await breaker.execute(primaryFn);
    return { data: result, source: 'primary' };
  } catch (error) {
    const errorInstance =
      error instanceof Error ? error : new Error(String(error));

    const isTimeoutError =
      errorInstance.name === 'AbortError' ||
      errorInstance.message.includes('timeout') ||
      errorInstance.message.includes('TIMEOUT') ||
      errorInstance.message.includes('aborted');

    if (isTimeoutError) {
      logger.info(
        `[CircuitBreaker] ${serviceName}: 타임아웃 감지, circuit breaker failure 카운트 제외`
      );
      breaker.reset();
    }

    logger.error(
      `[CircuitBreaker] ${serviceName}: Primary 실패, 폴백 사용 - ${errorInstance.message}`
    );

    circuitBreakerEvents.emit({
      type: 'failover',
      service: serviceName,
      timestamp: Date.now(),
      details: {
        failoverFrom: 'primary',
        failoverTo: 'fallback',
        error: errorInstance.message,
      },
    });

    const fallbackData = await fallbackFn();
    return {
      data: fallbackData,
      source: 'fallback',
      originalError: errorInstance,
    };
  }
}

// ============================================================================
// Status Summary
// ============================================================================

export function getAIStatusSummary(): {
  circuitBreakers: Record<
    string,
    ReturnType<AIServiceCircuitBreaker['getStatus']>
  >;
  recentEvents: ReturnType<typeof circuitBreakerEvents.getRecentEvents>;
  stateStore: 'redis' | 'in-memory';
  stats: {
    totalBreakers: number;
    openBreakers: number;
    totalFailures: number;
    recentFailovers: number;
    recentRateLimits: number;
  };
} {
  const circuitBreakers = aiCircuitBreaker.getAllStatus();
  const recentEvents = circuitBreakerEvents.getRecentEvents(20);

  const breakerValues = Object.values(circuitBreakers);
  const oneHourAgo = Date.now() - 60 * 60 * 1000;

  return {
    circuitBreakers,
    recentEvents,
    stateStore: isRedisStateStoreInitialized() ? 'redis' : 'in-memory',
    stats: {
      totalBreakers: breakerValues.length,
      openBreakers: breakerValues.filter((b) => b.state === 'OPEN').length,
      totalFailures: breakerValues.reduce((sum, b) => sum + b.failures, 0),
      recentFailovers: recentEvents.filter(
        (e) => e.type === 'failover' && e.timestamp > oneHourAgo
      ).length,
      recentRateLimits: recentEvents.filter(
        (e) => e.type === 'rate_limit' && e.timestamp > oneHourAgo
      ).length,
    },
  };
}
