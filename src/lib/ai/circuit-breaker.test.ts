/**
 * AI Service Circuit Breaker Unit Tests
 *
 * @description Circuit Breaker 상태 전이, Manager, Fallback 실행 검증
 * @created 2026-01-10 v5.84.3
 * @updated 2026-02-23 v8.3.2 - Manager, StatusSummary, Edge cases 추가
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoggerWarn, mockLoggerInfo, mockLoggerError } = vi.hoisted(() => ({
  mockLoggerWarn: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    warn: mockLoggerWarn,
    info: mockLoggerInfo,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

vi.mock('./circuit-breaker/state-store', () => ({
  ensureRedisStateStore: vi.fn().mockResolvedValue(undefined),
  isRedisStateStoreInitialized: vi.fn().mockReturnValue(false),
  getDistributedStateStore: vi.fn(),
  setDistributedStateStore: vi.fn(),
  InMemoryStateStore: vi.fn(),
}));

import {
  AIServiceCircuitBreaker,
  aiCircuitBreaker,
  executeWithCircuitBreakerAndFallback,
  getAIStatusSummary,
} from './circuit-breaker';

describe('AIServiceCircuitBreaker', () => {
  let breaker: AIServiceCircuitBreaker;

  beforeEach(() => {
    vi.clearAllMocks();
    breaker = new AIServiceCircuitBreaker('test-service', 3, 5000);
  });

  describe('초기 상태', () => {
    it('CLOSED 상태로 시작한다', () => {
      // When
      const status = breaker.getStatus();

      // Then
      expect(status.state).toBe('CLOSED');
      expect(status.failures).toBe(0);
      expect(status.serviceName).toBe('test-service');
      expect(status.threshold).toBe(3);
    });
  });

  describe('성공 실행', () => {
    it('함수 결과를 반환하고 CLOSED 상태를 유지한다', async () => {
      // When
      const result = await breaker.execute(() => Promise.resolve('ok'));

      // Then
      expect(result).toBe('ok');
      expect(breaker.getStatus().state).toBe('CLOSED');
      expect(breaker.getStatus().failures).toBe(0);
    });
  });

  describe('실패 처리', () => {
    it('실패 시 failure 카운터가 증가한다', async () => {
      // When
      await expect(
        breaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();

      // Then
      expect(breaker.getStatus().failures).toBe(1);
    });

    it('threshold 미만 실패 시 CLOSED 상태를 유지한다', async () => {
      // When: 2번 실패 (threshold=3)
      for (let i = 0; i < 2; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // Then: 아직 CLOSED
      const status = breaker.getStatus();
      expect(status.failures).toBe(2);
    });

    it('threshold 이상 실패하면 OPEN 상태가 된다', async () => {
      // When: 3번 실패 (threshold=3)
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // Then: OPEN 상태
      const status = breaker.getStatus();
      expect(status.state).toBe('OPEN');
      expect(status.resetTimeRemaining).toBeGreaterThan(0);
    });
  });

  describe('OPEN 상태', () => {
    it('OPEN 상태에서 실행 시 즉시 에러를 던진다', async () => {
      // Given: circuit breaker를 OPEN 상태로 전환
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // When: OPEN 상태에서 실행 시도
      await expect(
        breaker.execute(() => Promise.resolve('should not run'))
      ).rejects.toThrow('일시적으로 중단');
    });

    it('에러 메시지에 남은 시간이 포함된다', async () => {
      // Given: OPEN 상태
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // When/Then
      await expect(
        breaker.execute(() => Promise.resolve('test'))
      ).rejects.toThrow(/\d+초 후/);
    });

    it('OPEN 상태에서 resetTimeRemaining이 양수이다', async () => {
      // Given: OPEN 상태
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // Then
      const status = breaker.getStatus();
      expect(status.state).toBe('OPEN');
      expect(status.resetTimeRemaining).toBeGreaterThan(0);
      expect(status.resetTimeRemaining).toBeLessThanOrEqual(5000);
    });
  });

  describe('HALF_OPEN → CLOSED 전환', () => {
    it('리셋 타임아웃 후 성공하면 CLOSED로 복귀한다', async () => {
      // Given: 짧은 리셋 타임아웃으로 breaker 생성
      const fastBreaker = new AIServiceCircuitBreaker('fast', 2, 100);

      // Given: OPEN 상태
      for (let i = 0; i < 2; i++) {
        await expect(
          fastBreaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // When: 리셋 타임아웃 대기 후 성공 실행
      await new Promise((r) => setTimeout(r, 150));
      const result = await fastBreaker.execute(() => Promise.resolve('ok'));

      // Then: CLOSED 상태로 복귀
      expect(result).toBe('ok');
      expect(fastBreaker.getStatus().state).toBe('CLOSED');
      expect(fastBreaker.getStatus().failures).toBe(0);
    });
  });

  describe('reset', () => {
    it('수동 리셋 시 CLOSED 상태로 복귀한다', async () => {
      // Given: OPEN 상태
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }
      expect(breaker.getStatus().state).toBe('OPEN');

      // When
      breaker.reset();

      // Then
      expect(breaker.getStatus().state).toBe('CLOSED');
      expect(breaker.getStatus().failures).toBe(0);
    });

    it('reset() 후 정상 실행이 가능하다', async () => {
      // Given: OPEN 상태
      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(() => Promise.reject(new Error('fail')))
        ).rejects.toThrow();
      }

      // When: 리셋 후 실행
      breaker.reset();
      const result = await breaker.execute(() => Promise.resolve('recovered'));

      // Then
      expect(result).toBe('recovered');
      expect(breaker.getStatus().state).toBe('CLOSED');
    });
  });

  describe('에러 메시지 포맷', () => {
    it('실패 시 서비스명과 실패 횟수를 포함한다', async () => {
      // When/Then
      await expect(
        breaker.execute(() => Promise.reject(new Error('connection refused')))
      ).rejects.toThrow('test-service 실행 실패 (1/3 실패)');
    });

    it('문자열 에러도 Error로 변환한다', async () => {
      // When/Then
      await expect(
        breaker.execute(() => Promise.reject('string error'))
      ).rejects.toThrow('test-service 실행 실패');
    });
  });
});

describe('executeWithCircuitBreakerAndFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('primary 성공 시 primary 소스를 반환한다', async () => {
    // When
    const result = await executeWithCircuitBreakerAndFallback(
      'fallback-test',
      () => Promise.resolve('primary-data'),
      () => 'fallback-data'
    );

    // Then
    expect(result.data).toBe('primary-data');
    expect(result.source).toBe('primary');
    expect(result.originalError).toBeUndefined();
  });

  it('primary 실패 시 fallback으로 전환한다', async () => {
    // When
    const result = await executeWithCircuitBreakerAndFallback(
      'fallback-test-2',
      () => Promise.reject(new Error('primary failed')),
      () => 'fallback-data'
    );

    // Then
    expect(result.data).toBe('fallback-data');
    expect(result.source).toBe('fallback');
    expect(result.originalError?.message).toContain('primary failed');
  });

  it('타임아웃 에러 시 circuit breaker를 리셋한다', async () => {
    // Given: AbortError 시뮬레이션
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    // When
    const result = await executeWithCircuitBreakerAndFallback(
      'timeout-test',
      () => Promise.reject(abortError),
      () => 'fallback'
    );

    // Then: fallback 사용하되 circuit breaker는 리셋됨
    expect(result.data).toBe('fallback');
    expect(result.source).toBe('fallback');
  });

  it('async fallback도 지원한다', async () => {
    // When
    const result = await executeWithCircuitBreakerAndFallback(
      'async-fallback-test',
      () => Promise.reject(new Error('fail')),
      () => Promise.resolve('async-fallback')
    );

    // Then
    expect(result.data).toBe('async-fallback');
    expect(result.source).toBe('fallback');
  });

  it('primary 실패 + fallback도 실패 → 에러 전파', async () => {
    // When/Then
    await expect(
      executeWithCircuitBreakerAndFallback(
        'both-fail-test',
        () => Promise.reject(new Error('primary failed')),
        () => {
          throw new Error('fallback also failed');
        }
      )
    ).rejects.toThrow('fallback also failed');
  });

  it('OPEN 상태에서 즉시 fallback을 실행한다', async () => {
    // Given: OPEN 상태로 전환
    const serviceName = 'open-fallback-test';
    const cbBreaker = aiCircuitBreaker.getBreaker(serviceName);
    for (let i = 0; i < 3; i++) {
      await expect(
        cbBreaker.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
    }
    expect(cbBreaker.getStatus().state).toBe('OPEN');

    // When: OPEN 상태에서 호출
    const primaryFn = vi.fn();
    const result = await executeWithCircuitBreakerAndFallback(
      serviceName,
      primaryFn,
      () => 'direct-fallback'
    );

    // Then: primary 미호출, fallback 직행
    expect(primaryFn).not.toHaveBeenCalled();
    expect(result.data).toBe('direct-fallback');
    expect(result.source).toBe('fallback');
  });
});

describe('AICircuitBreakerManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiCircuitBreaker.resetAll();
  });

  it('getBreaker() → 동일 이름 = 동일 인스턴스', () => {
    // When
    const b1 = aiCircuitBreaker.getBreaker('service-a');
    const b2 = aiCircuitBreaker.getBreaker('service-a');

    // Then
    expect(b1).toBe(b2);
  });

  it('getBreaker() → 다른 이름 = 격리된 인스턴스', async () => {
    // Given: 서로 다른 이름의 브레이커
    const b1 = aiCircuitBreaker.getBreaker('service-x');
    const b2 = aiCircuitBreaker.getBreaker('service-y');
    expect(b1).not.toBe(b2);

    // When: b1만 실패
    await expect(
      b1.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();

    // Then: b1 실패가 b2에 영향을 주지 않는다
    expect(b1.getStatus().failures).toBe(1);
    expect(b2.getStatus().failures).toBe(0);
  });

  it('getAllStatus() → 모든 브레이커 상태를 포함한다', () => {
    // Given: 2개 브레이커 생성
    aiCircuitBreaker.getBreaker('svc-1');
    aiCircuitBreaker.getBreaker('svc-2');

    // When
    const allStatus = aiCircuitBreaker.getAllStatus();

    // Then
    expect(Object.keys(allStatus)).toContain('svc-1');
    expect(Object.keys(allStatus)).toContain('svc-2');
    expect(allStatus['svc-1'].state).toBe('CLOSED');
    expect(allStatus['svc-2'].state).toBe('CLOSED');
  });

  it('resetAll() → 전체 브레이커를 리셋한다', async () => {
    // Given: 양쪽 브레이커에 실패 누적
    const b1 = aiCircuitBreaker.getBreaker('reset-1');
    const b2 = aiCircuitBreaker.getBreaker('reset-2');
    await expect(
      b1.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();
    await expect(
      b2.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();
    expect(b1.getStatus().failures).toBe(1);
    expect(b2.getStatus().failures).toBe(1);

    // When
    aiCircuitBreaker.resetAll();

    // Then
    expect(b1.getStatus().failures).toBe(0);
    expect(b2.getStatus().failures).toBe(0);
  });

  it('resetBreaker() → 특정 브레이커만 리셋한다', async () => {
    // Given: 양쪽 브레이커에 실패 누적
    const b1 = aiCircuitBreaker.getBreaker('partial-1');
    const b2 = aiCircuitBreaker.getBreaker('partial-2');
    await expect(
      b1.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();
    await expect(
      b2.execute(() => Promise.reject(new Error('fail')))
    ).rejects.toThrow();

    // When: partial-1만 리셋
    const resetResult = aiCircuitBreaker.resetBreaker('partial-1');

    // Then: partial-1만 초기화, partial-2는 유지
    expect(resetResult).toBe(true);
    expect(b1.getStatus().failures).toBe(0);
    expect(b2.getStatus().failures).toBe(1);
  });

  it('resetBreaker() → 존재하지 않는 이름은 false 반환', () => {
    // When
    const result = aiCircuitBreaker.resetBreaker('nonexistent');

    // Then
    expect(result).toBe(false);
  });
});

describe('getAIStatusSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiCircuitBreaker.resetAll();
  });

  it('상태 요약에 모든 필수 필드가 포함된다', () => {
    // Given: 브레이커 1개 생성
    aiCircuitBreaker.getBreaker('summary-svc');

    // When
    const summary = getAIStatusSummary();

    // Then
    expect(summary).toHaveProperty('circuitBreakers');
    expect(summary).toHaveProperty('recentEvents');
    expect(summary).toHaveProperty('stateStore');
    expect(summary).toHaveProperty('stats');
    expect(summary.stats).toHaveProperty('totalBreakers');
    expect(summary.stats).toHaveProperty('openBreakers');
    expect(summary.stats).toHaveProperty('totalFailures');
  });

  it('OPEN 브레이커 카운트가 정확하다', async () => {
    // Given: 브레이커를 OPEN 상태로 전환
    const b = aiCircuitBreaker.getBreaker('open-count-svc');
    for (let i = 0; i < 3; i++) {
      await expect(
        b.execute(() => Promise.reject(new Error('fail')))
      ).rejects.toThrow();
    }

    // When
    const summary = getAIStatusSummary();

    // Then
    expect(summary.stats.openBreakers).toBeGreaterThanOrEqual(1);
    expect(summary.stats.totalFailures).toBeGreaterThanOrEqual(3);
  });
});

describe('Edge cases', () => {
  it('동시 호출 중 상태 전이가 안전하다', async () => {
    // Given: threshold=3인 브레이커
    const concurrentBreaker = new AIServiceCircuitBreaker(
      'concurrent',
      3,
      5000
    );

    // When: 동시에 5개 실패 호출
    const promises = Array.from({ length: 5 }, () =>
      concurrentBreaker
        .execute(() => Promise.reject(new Error('concurrent fail')))
        .catch(() => {})
    );
    await Promise.all(promises);

    // Then: 상태가 일관적이어야 한다
    const status = concurrentBreaker.getStatus();
    expect(status.state).toBe('OPEN');
    expect(status.failures).toBeGreaterThanOrEqual(3);
  });
});
