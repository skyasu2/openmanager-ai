/**
 * Circuit Breaker In-Memory State Store
 *
 * @description
 * 현재 AI circuit breaker request path는 Redis/Upstash 분산 저장소를 사용하지
 * 않고 in-memory 상태만 사용합니다.
 * @created 2026-02-10 - Extracted from circuit-breaker.ts
 * @updated 2026-05-20 - Removed unused distributed Redis store connection point
 */

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
 * 인메모리 상태 저장소 (기본 구현)
 * 현재 request path의 AIServiceCircuitBreaker는 이 저장소도 직접 읽지 않고
 * 클래스 인스턴스 필드만 사용합니다. 이 클래스는 local state-store 단위 테스트와
 * 향후 명시적 in-memory store 사용 시를 위한 작은 구현입니다.
 *
 * @internal
 */
export class InMemoryStateStore {
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
