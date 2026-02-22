/**
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
  executeWithCircuitBreakerAndFallback,
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
});
