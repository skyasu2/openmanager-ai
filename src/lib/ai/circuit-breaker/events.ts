/**
 * Circuit Breaker Event System
 *
 * @description 전역 이벤트 이미터 + 히스토리 관리
 * @created 2026-02-10 - Extracted from circuit-breaker.ts
 */

import { logger } from '@/lib/logging';

// ============================================================================
// Types
// ============================================================================

export type CircuitBreakerEventType =
  | 'circuit_open'
  | 'circuit_close'
  | 'circuit_half_open'
  | 'failover'
  | 'rate_limit'
  | 'failure'
  | 'success';

export interface CircuitBreakerEvent {
  type: CircuitBreakerEventType;
  service: string;
  timestamp: number;
  details: {
    previousState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    newState?: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures?: number;
    threshold?: number;
    resetTimeMs?: number;
    error?: string;
    failoverFrom?: string;
    failoverTo?: string;
  };
}

type CircuitBreakerEventListener = (event: CircuitBreakerEvent) => void;

// ============================================================================
// Event Emitter
// ============================================================================

/**
 * 전역 Circuit Breaker 이벤트 이미터
 * 싱글톤 패턴으로 모든 Circuit Breaker 인스턴스의 이벤트를 중앙 관리
 */
class CircuitBreakerEventEmitter {
  private listeners: CircuitBreakerEventListener[] = [];
  private eventHistory: CircuitBreakerEvent[] = [];
  private readonly maxHistorySize = 100;

  /**
   * 이벤트 리스너 등록
   * @returns unsubscribe 함수
   */
  subscribe(listener: CircuitBreakerEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit(event: CircuitBreakerEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        logger.error('[CircuitBreaker] Event listener error:', error);
      }
    }

    if (process.env.NODE_ENV === 'development') {
      logger.info(
        `[CircuitBreaker] ${event.type} - ${event.service}:`,
        event.details
      );
    }
  }

  getHistory(options?: {
    service?: string;
    type?: CircuitBreakerEventType;
    limit?: number;
  }): CircuitBreakerEvent[] {
    let filtered = [...this.eventHistory];

    if (options?.service) {
      filtered = filtered.filter((e) => e.service === options.service);
    }
    if (options?.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }
    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  getRecentEvents(count = 10): CircuitBreakerEvent[] {
    return this.eventHistory.slice(-count);
  }

  clearHistory(): void {
    this.eventHistory = [];
  }
}

// Singleton
export const circuitBreakerEvents = new CircuitBreakerEventEmitter();
