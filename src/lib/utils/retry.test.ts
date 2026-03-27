/**
 * Retry 유틸리티 테스트
 *
 * @description
 * - calculateBackoff: 지수 백오프 계산
 * - defaultShouldRetry: 재시도 조건 판단
 * - withRetry: 재시도 래퍼
 * - withRetryResult: 상세 결과 반환
 * - fetchWithRetry: HTTP fetch 특화
 * - RETRY_PRESETS: 프리셋 설정
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateBackoff,
  defaultShouldRetry,
  fetchWithRetry,
  RETRY_AGGRESSIVE,
  RETRY_CONSERVATIVE,
  RETRY_STANDARD,
  withRetry,
  withRetryResult,
} from './retry';

describe('calculateBackoff', () => {
  it('지수 백오프: baseDelay * 2^attempt', () => {
    // attempt 0: 1000 * 2^0 = 1000
    // attempt 1: 1000 * 2^1 = 2000
    // attempt 2: 1000 * 2^2 = 4000
    const baseDelay = 1000;
    const maxDelay = 30000;

    // jitter 없이 테스트 (jitterFactor = 0)
    expect(calculateBackoff(0, baseDelay, maxDelay, 0)).toBe(1000);
    expect(calculateBackoff(1, baseDelay, maxDelay, 0)).toBe(2000);
    expect(calculateBackoff(2, baseDelay, maxDelay, 0)).toBe(4000);
    expect(calculateBackoff(3, baseDelay, maxDelay, 0)).toBe(8000);
  });

  it('jitter 적용 (±10%)', () => {
    // Given
    const baseDelay = 1000;
    const maxDelay = 30000;
    const jitterFactor = 0.1;

    // When - 여러 번 호출하여 분포 확인
    const results: number[] = [];
    for (let i = 0; i < 100; i++) {
      results.push(calculateBackoff(0, baseDelay, maxDelay, jitterFactor));
    }

    // Then - 모든 결과가 900 ~ 1100 범위 내
    for (const result of results) {
      expect(result).toBeGreaterThanOrEqual(900);
      expect(result).toBeLessThanOrEqual(1100);
    }

    // 그리고 모든 값이 같지 않음 (jitter가 적용됨)
    const uniqueValues = new Set(results);
    expect(uniqueValues.size).toBeGreaterThan(1);
  });

  it('maxDelayMs 초과하지 않음', () => {
    // Given
    const baseDelay = 1000;
    const maxDelay = 5000;

    // When - attempt가 매우 클 때
    const result = calculateBackoff(10, baseDelay, maxDelay, 0); // 2^10 = 1024000ms

    // Then - maxDelay를 초과하지 않음
    expect(result).toBe(maxDelay);
  });

  it('결과값이 정수로 반올림됨', () => {
    // Given
    const baseDelay = 1000;
    const maxDelay = 30000;
    const jitterFactor = 0.1;

    // When
    const result = calculateBackoff(0, baseDelay, maxDelay, jitterFactor);

    // Then
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe('defaultShouldRetry', () => {
  it('네트워크 에러 → true', () => {
    // Given
    const error = new TypeError('Failed to fetch');

    // When & Then
    expect(defaultShouldRetry(error, 0)).toBe(true);
  });

  it('HTTP 5xx → true', () => {
    // Given - status 속성을 가진 에러 객체
    const error = { status: 503 };

    // When & Then
    expect(defaultShouldRetry(error, 0)).toBe(true);
  });

  it('HTTP 500 → true', () => {
    const error = { status: 500 };
    expect(defaultShouldRetry(error, 0)).toBe(true);
  });

  it('HTTP 502 → true', () => {
    const error = { status: 502 };
    expect(defaultShouldRetry(error, 0)).toBe(true);
  });

  it('HTTP 4xx → false', () => {
    expect(defaultShouldRetry({ status: 400 }, 0)).toBe(false);
    expect(defaultShouldRetry({ status: 404 }, 0)).toBe(false);
    expect(defaultShouldRetry({ status: 422 }, 0)).toBe(false);
  });

  it('HTTP 401 → false (인증 에러)', () => {
    expect(defaultShouldRetry({ status: 401 }, 0)).toBe(false);
  });

  it('HTTP 403 → false (권한 에러)', () => {
    expect(defaultShouldRetry({ status: 403 }, 0)).toBe(false);
  });

  it('타임아웃 에러 → true', () => {
    expect(defaultShouldRetry(new Error('Request timeout'), 0)).toBe(true);
    expect(defaultShouldRetry(new Error('ETIMEDOUT'), 0)).toBe(true);
    expect(defaultShouldRetry(new Error('Connection timed out'), 0)).toBe(true);
  });

  it('연결 에러 → true', () => {
    expect(defaultShouldRetry(new Error('ECONNRESET'), 0)).toBe(true);
    expect(defaultShouldRetry(new Error('ECONNREFUSED'), 0)).toBe(true);
    expect(defaultShouldRetry(new Error('Network error'), 0)).toBe(true);
  });

  it('알 수 없는 에러 → false', () => {
    expect(defaultShouldRetry(new Error('Something went wrong'), 0)).toBe(
      false
    );
    expect(defaultShouldRetry('string error', 0)).toBe(false);
    expect(defaultShouldRetry(null, 0)).toBe(false);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('첫 시도 성공 시 즉시 반환', async () => {
    // Given
    const fn = vi.fn().mockResolvedValue('success');

    // When
    const resultPromise = withRetry(fn, { maxRetries: 3 });
    const result = await resultPromise;

    // Then
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('503 후 재시도 → 성공', async () => {
    // Given
    const serverError = { status: 503, message: 'Service Unavailable' };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce('success after retry');

    // When
    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      shouldRetry: defaultShouldRetry,
    });

    // 타이머 진행
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Then
    expect(result).toBe('success after retry');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('maxRetries 소진 시 throw', async () => {
    // Given
    const serverError = { status: 500, message: 'Internal Server Error' };
    const fn = vi.fn().mockRejectedValue(serverError);

    // When
    const resultPromise = withRetry(fn, {
      maxRetries: 2,
      baseDelayMs: 10,
      maxDelayMs: 100,
      shouldRetry: defaultShouldRetry,
    });

    // Then - 타이머 실행과 rejection 처리를 안전하게 수행
    const [, result] = await Promise.allSettled([
      vi.runAllTimersAsync(),
      resultPromise,
    ]);
    expect(result.status).toBe('rejected');
    if (result.status === 'rejected') {
      expect(result.reason).toEqual(serverError);
    }
    expect(fn).toHaveBeenCalledTimes(3); // 초기 시도 + 2회 재시도
  });

  it('400/401/403에서 재시도 안함', async () => {
    // Given - 클라이언트 에러
    const clientError = { status: 400, message: 'Bad Request' };
    const fn = vi.fn().mockRejectedValue(clientError);

    // When
    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      shouldRetry: defaultShouldRetry,
    });

    // Then
    await expect(resultPromise).rejects.toEqual(clientError);
    expect(fn).toHaveBeenCalledTimes(1); // 재시도 없음
  });

  it('onRetry 콜백 호출', async () => {
    // Given
    const onRetry = vi.fn();
    const serverError = { status: 503 };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce('done');

    // When
    const resultPromise = withRetry(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      shouldRetry: defaultShouldRetry,
      onRetry,
    });

    await vi.runAllTimersAsync();
    await resultPromise;

    // Then
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(serverError, 1, expect.any(Number));
  });
});

describe('withRetryResult', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('성공 시 { success: true, data }', async () => {
    // Given
    const fn = vi.fn().mockResolvedValue({ id: 1, name: 'test' });

    // When
    const result = await withRetryResult(fn);

    // Then
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: 1, name: 'test' });
    expect(result.attempts).toBe(1);
    expect(result.totalDelayMs).toBe(0);
  });

  it('실패 시 { success: false, error }', async () => {
    // Given
    const error = { status: 400, message: 'Bad Request' };
    const fn = vi.fn().mockRejectedValue(error);

    // When
    const result = await withRetryResult(fn, {
      shouldRetry: defaultShouldRetry,
    });

    // Then
    expect(result.success).toBe(false);
    expect(result.error).toEqual(error);
    expect(result.attempts).toBe(1);
  });

  it('총 시도 횟수 추적', async () => {
    // Given
    const serverError = { status: 503 };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(serverError)
      .mockRejectedValueOnce(serverError)
      .mockResolvedValueOnce('success');

    // When
    const resultPromise = withRetryResult(fn, {
      maxRetries: 5,
      baseDelayMs: 100,
      shouldRetry: defaultShouldRetry,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Then
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(result.totalDelayMs).toBeGreaterThan(0);
  });

  it('totalDelayMs 누적 확인', async () => {
    // Given
    const serverError = { status: 500 };
    const fn = vi.fn().mockRejectedValue(serverError);

    // When
    const resultPromise = withRetryResult(fn, {
      maxRetries: 2,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitterFactor: 0, // jitter 없이 테스트
      shouldRetry: defaultShouldRetry,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Then
    expect(result.success).toBe(false);
    // 100 (attempt 0) + 200 (attempt 1) = 300ms
    expect(result.totalDelayMs).toBe(300);
  });
});

describe('fetchWithRetry', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
  });

  it('5xx 에러 시 throw', async () => {
    // Given
    global.fetch = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
    });

    // When
    const resultPromise = fetchWithRetry('/api/test', undefined, {
      maxRetries: 0, // 재시도 없이 즉시 실패
    });

    // Then
    await expect(resultPromise).rejects.toThrow('HTTP 503');
  });

  it('2xx 성공 시 Response 반환', async () => {
    // Given
    const mockResponse = {
      status: 200,
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    // When
    const result = await fetchWithRetry('/api/success');

    // Then
    expect(result).toEqual(mockResponse);
  });

  it('4xx 에러 시 재시도 없이 Response 반환', async () => {
    // Given
    const mockResponse = {
      status: 400,
      ok: false,
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    // When
    const result = await fetchWithRetry('/api/bad-request');

    // Then
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('5xx 재시도 후 성공', async () => {
    // Given
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ status: 503, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true });

    // When
    const resultPromise = fetchWithRetry('/api/retry', undefined, {
      maxRetries: 2,
      baseDelayMs: 100,
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Then
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('RETRY_PRESETS', () => {
  it('RETRY_AGGRESSIVE 파라미터 확인', () => {
    expect(RETRY_AGGRESSIVE.maxRetries).toBe(5);
    expect(RETRY_AGGRESSIVE.baseDelayMs).toBe(500);
    expect(RETRY_AGGRESSIVE.maxDelayMs).toBe(30000);
    expect(RETRY_AGGRESSIVE.jitterFactor).toBe(0.15);
  });

  it('RETRY_STANDARD 파라미터 확인', () => {
    expect(RETRY_STANDARD.maxRetries).toBe(3);
    expect(RETRY_STANDARD.baseDelayMs).toBe(1000);
    expect(RETRY_STANDARD.maxDelayMs).toBe(30000);
    expect(RETRY_STANDARD.jitterFactor).toBe(0.1);
  });

  it('RETRY_CONSERVATIVE 파라미터 확인', () => {
    expect(RETRY_CONSERVATIVE.maxRetries).toBe(2);
    expect(RETRY_CONSERVATIVE.baseDelayMs).toBe(2000);
    expect(RETRY_CONSERVATIVE.maxDelayMs).toBe(10000);
    expect(RETRY_CONSERVATIVE.jitterFactor).toBe(0.05);
  });

  it('프리셋은 적절한 비례 관계 유지', () => {
    // AGGRESSIVE가 가장 많은 재시도
    expect(RETRY_AGGRESSIVE.maxRetries).toBeGreaterThan(
      RETRY_STANDARD.maxRetries
    );
    expect(RETRY_STANDARD.maxRetries).toBeGreaterThan(
      RETRY_CONSERVATIVE.maxRetries
    );

    // AGGRESSIVE가 가장 짧은 기본 딜레이
    expect(RETRY_AGGRESSIVE.baseDelayMs).toBeLessThan(
      RETRY_STANDARD.baseDelayMs
    );
    expect(RETRY_STANDARD.baseDelayMs).toBeLessThan(
      RETRY_CONSERVATIVE.baseDelayMs
    );
  });
});
