/**
 * Circuit Breaker Unit Tests
 *
 * 3-state 전이 로직 검증 (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * 외부 호출 없음: 순수 로직 테스트, vi.useFakeTimers() 사용
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  getCircuitBreaker,
  getAllCircuitStats,
  resetAllCircuitBreakers,
  withCircuitBreaker,
} from './circuit-breaker';

// logger mock — 실제 로그 출력 억제
vi.mock('../../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    cb = new CircuitBreaker({
      name: 'test-provider',
      failureThreshold: 5,
      successThreshold: 2,
      openDuration: 30_000,
      timeout: 5_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAllCircuitBreakers();
  });

  // ============================================================================
  // 1. CLOSED 상태 기본 동작
  // ============================================================================
  describe('CLOSED state', () => {
    it('성공 시 CLOSED 유지', async () => {
      const result = await cb.execute(() => Promise.resolve('ok'));

      expect(result).toBe('ok');
      expect(cb.getStats().state).toBe('CLOSED');
      expect(cb.getStats().totalCalls).toBe(1);
    });

    it('성공 시 failure 카운터 리셋', async () => {
      // 4회 실패 (threshold 미달)
      for (let i = 0; i < 4; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(cb.getStats().failures).toBe(4);

      // 1회 성공 → failures 리셋
      await cb.execute(() => Promise.resolve('ok'));
      expect(cb.getStats().failures).toBe(0);
      expect(cb.getStats().state).toBe('CLOSED');
    });

    it('isAllowed()는 CLOSED 상태에서 true 반환', () => {
      expect(cb.isAllowed()).toBe(true);
    });
  });

  // ============================================================================
  // 2. CLOSED → OPEN 전이
  // ============================================================================
  describe('CLOSED → OPEN transition', () => {
    it('5회 연속 실패 시 OPEN 전이', async () => {
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(cb.getStats().state).toBe('OPEN');
      expect(cb.getStats().totalFailures).toBe(5);
    });

    it('OPEN 상태에서 즉시 CircuitOpenError 발생', async () => {
      // OPEN으로 전이
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      await expect(cb.execute(() => Promise.resolve('ok'))).rejects.toThrow(
        CircuitOpenError
      );
    });

    it('CircuitOpenError에 retryAfter 포함', async () => {
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      try {
        await cb.execute(() => Promise.resolve('ok'));
      } catch (e) {
        expect(e).toBeInstanceOf(CircuitOpenError);
        expect((e as CircuitOpenError).retryAfter).toBeGreaterThan(0);
        expect((e as CircuitOpenError).retryAfter).toBeLessThanOrEqual(30_000);
      }
    });

    it('isAllowed()는 OPEN 상태에서 false 반환', async () => {
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      expect(cb.isAllowed()).toBe(false);
    });
  });

  // ============================================================================
  // 3. OPEN → HALF_OPEN 전이
  // ============================================================================
  describe('OPEN → HALF_OPEN transition', () => {
    it('30초 후 HALF_OPEN으로 전이', async () => {
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(cb.getStats().state).toBe('OPEN');

      // 30초 경과
      vi.advanceTimersByTime(30_000);

      // isAllowed 호출 시 상태 전이 확인
      expect(cb.isAllowed()).toBe(true);
    });

    it('29초에서는 여전히 OPEN', async () => {
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      vi.advanceTimersByTime(29_000);
      expect(cb.isAllowed()).toBe(false);
    });
  });

  // ============================================================================
  // 4. HALF_OPEN → CLOSED 전이
  // ============================================================================
  describe('HALF_OPEN → CLOSED transition', () => {
    it('HALF_OPEN에서 2회 성공 시 CLOSED 전이', async () => {
      // OPEN으로 전이
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      // HALF_OPEN으로 전이
      vi.advanceTimersByTime(30_000);

      // 2회 성공
      await cb.execute(() => Promise.resolve('ok'));
      await cb.execute(() => Promise.resolve('ok'));

      expect(cb.getStats().state).toBe('CLOSED');
      expect(cb.getStats().failures).toBe(0);
      expect(cb.getStats().successes).toBe(0);
    });
  });

  // ============================================================================
  // 5. HALF_OPEN → OPEN 복귀
  // ============================================================================
  describe('HALF_OPEN → OPEN fallback', () => {
    it('HALF_OPEN에서 1회 실패 시 즉시 OPEN 복귀', async () => {
      // OPEN으로 전이
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      // HALF_OPEN으로 전이
      vi.advanceTimersByTime(30_000);

      // 1회 실패 → 즉시 OPEN
      await cb.execute(() => Promise.reject(new Error('fail again'))).catch(() => {});

      expect(cb.getStats().state).toBe('OPEN');
    });
  });

  // ============================================================================
  // 6. 타임아웃
  // ============================================================================
  describe('Timeout handling', () => {
    it('타임아웃 초과 시 TimeoutError 발생', async () => {
      const slowFn = () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('late'), 10_000);
        });

      const promise = cb.execute(slowFn);

      // 5초 타임아웃 경과
      vi.advanceTimersByTime(5_000);

      await expect(promise).rejects.toThrow(TimeoutError);
    });

    it('타임아웃은 failure로 카운트', async () => {
      const slowFn = () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('late'), 10_000);
        });

      const promise = cb.execute(slowFn);
      vi.advanceTimersByTime(5_000);
      await promise.catch(() => {});

      expect(cb.getStats().failures).toBe(1);
      expect(cb.getStats().totalFailures).toBe(1);
    });
  });

  // ============================================================================
  // 7. reset() 수동 초기화
  // ============================================================================
  describe('Manual reset', () => {
    it('reset() 호출 시 CLOSED + 카운터 초기화', async () => {
      // OPEN 상태로 만듦
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }
      expect(cb.getStats().state).toBe('OPEN');

      cb.reset();

      expect(cb.getStats().state).toBe('CLOSED');
      expect(cb.getStats().failures).toBe(0);
      expect(cb.getStats().successes).toBe(0);
    });

    it('reset 후 정상 요청 통과', async () => {
      for (let i = 0; i < 5; i++) {
        await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      }

      cb.reset();

      const result = await cb.execute(() => Promise.resolve('recovered'));
      expect(result).toBe('recovered');
    });
  });

  // ============================================================================
  // 8. getStats()
  // ============================================================================
  describe('getStats()', () => {
    it('초기 상태 정합성', () => {
      const stats = cb.getStats();

      expect(stats.state).toBe('CLOSED');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
      expect(stats.totalCalls).toBe(0);
      expect(stats.totalFailures).toBe(0);
      expect(stats.lastFailure).toBeUndefined();
      expect(stats.lastSuccess).toBeUndefined();
    });

    it('호출 후 lastSuccess/lastFailure 기록', async () => {
      await cb.execute(() => Promise.resolve('ok'));
      expect(cb.getStats().lastSuccess).toBeInstanceOf(Date);

      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
      expect(cb.getStats().lastFailure).toBeInstanceOf(Date);
    });
  });
});

// ============================================================================
// Singleton Registry & Decorator
// ============================================================================

describe('getCircuitBreaker (Singleton Registry)', () => {
  afterEach(() => {
    resetAllCircuitBreakers();
  });

  it('동일 provider에 대해 같은 인스턴스 반환', () => {
    const cb1 = getCircuitBreaker('gemini');
    const cb2 = getCircuitBreaker('gemini');

    expect(cb1).toBe(cb2);
  });

  it('다른 provider에 대해 다른 인스턴스 반환', () => {
    const cb1 = getCircuitBreaker('gemini');
    const cb2 = getCircuitBreaker('groq');

    expect(cb1).not.toBe(cb2);
  });

  it('getAllCircuitStats()로 전체 상태 조회', () => {
    getCircuitBreaker('cerebras');
    getCircuitBreaker('groq');

    const stats = getAllCircuitStats();

    expect(stats).toHaveProperty('cerebras');
    expect(stats).toHaveProperty('groq');
    expect(stats.cerebras.state).toBe('CLOSED');
  });

  it('resetAllCircuitBreakers()로 전체 리셋', async () => {
    const cb = getCircuitBreaker('test-reset', { failureThreshold: 1 });
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    expect(cb.getStats().state).toBe('OPEN');

    resetAllCircuitBreakers();

    expect(cb.getStats().state).toBe('CLOSED');
  });
});

describe('withCircuitBreaker (Decorator)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAllCircuitBreakers();
  });

  it('함수를 Circuit Breaker로 래핑', async () => {
    const originalFn = vi.fn().mockResolvedValue('result');
    const wrapped = withCircuitBreaker('decorator-test', originalFn);

    const result = await wrapped();

    expect(result).toBe('result');
    expect(originalFn).toHaveBeenCalledTimes(1);
  });

  it('인자를 원본 함수에 전달', async () => {
    const originalFn = vi.fn().mockResolvedValue('ok');
    const wrapped = withCircuitBreaker('decorator-args', originalFn);

    await wrapped('arg1', 42);

    expect(originalFn).toHaveBeenCalledWith('arg1', 42);
  });

  it('threshold 초과 시 CircuitOpenError', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('fail'));
    const wrapped = withCircuitBreaker('decorator-fail', failFn, {
      failureThreshold: 2,
    });

    await wrapped().catch(() => {});
    await wrapped().catch(() => {});

    await expect(wrapped()).rejects.toThrow(CircuitOpenError);
  });
});
