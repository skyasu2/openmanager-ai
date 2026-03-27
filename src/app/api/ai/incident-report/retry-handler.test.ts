/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/types/type-utils', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock('@/utils/debug', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

// route-helpers에서 필요한 함수들만 mock
vi.mock('./route-helpers', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    getIncidentRetryTimeout: vi.fn().mockReturnValue({
      retryAllowed: true,
      timeoutMs: 10000,
    }),
  };
});

import { executeGenerateRetry } from './retry-handler';

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    fetchIncidentReport: vi
      .fn()
      .mockResolvedValue({ success: true, report: { id: 'retry-ok' } }),
    fetchCloudRunDirect: vi
      .fn()
      .mockResolvedValue({ success: true, report: { id: 'direct-ok' } }),
    getSecondAttemptPlan: vi
      .fn()
      .mockReturnValue({ retryAllowed: true, timeoutMs: 15000 }),
    effectiveDefaultTimeout: 30000,
    routeBudgetMs: 58500,
    ...overrides,
  };
}

describe('executeGenerateRetry', () => {
  it('2차 재시도 성공 시 isFallback=false를 반환한다', async () => {
    const deps = createDeps();
    const initialResponse = { source: 'fallback', message: '일시적 오류' };

    const result = await executeGenerateRetry(initialResponse, deps);

    expect(result.isFallback).toBe(false);
    expect(result.didGenerateRetry).toBe(true);
    expect(deps.fetchIncidentReport).toHaveBeenCalledTimes(1);
    // direct retry는 시도하지 않음
    expect(deps.fetchCloudRunDirect).not.toHaveBeenCalled();
  });

  it('route budget이 부족하면 즉시 fallback을 반환한다', async () => {
    const deps = createDeps({
      getSecondAttemptPlan: vi
        .fn()
        .mockReturnValue({ retryAllowed: false, timeoutMs: 0 }),
    });

    const result = await executeGenerateRetry({ source: 'fallback' }, deps);

    expect(result.isFallback).toBe(true);
    expect(result.responseData._fallbackReason).toBe(
      'Route budget limit reached'
    );
    expect(deps.fetchIncidentReport).not.toHaveBeenCalled();
  });

  it('2차 재시도 실패 후 direct retry로 복구한다', async () => {
    const deps = createDeps({
      fetchIncidentReport: vi.fn().mockResolvedValue({
        source: 'fallback',
        _fallback: true,
        message: '여전히 실패',
      }),
    });

    const result = await executeGenerateRetry({ source: 'fallback' }, deps);

    expect(result.didGenerateRetry).toBe(true);
    expect(result.attemptedDirectRetry).toBe(true);
    expect(result.didDirectRetry).toBe(true);
    expect(result.isFallback).toBe(false);
    expect(deps.fetchCloudRunDirect).toHaveBeenCalledTimes(1);
  });

  it('2차 재시도에서 예외 발생 시 direct retry를 시도한다', async () => {
    const deps = createDeps({
      fetchIncidentReport: vi.fn().mockRejectedValue(new Error('Timeout')),
    });

    const result = await executeGenerateRetry({ source: 'fallback' }, deps);

    expect(result.didGenerateRetry).toBe(true);
    // direct retry가 시도됨
    expect(deps.fetchCloudRunDirect).toHaveBeenCalledTimes(1);
  });

  it('모든 재시도 실패 시 최종 fallback을 반환한다', async () => {
    const deps = createDeps({
      fetchIncidentReport: vi.fn().mockResolvedValue({
        source: 'fallback',
        _fallback: true,
      }),
      fetchCloudRunDirect: vi
        .fn()
        .mockRejectedValue(new Error('All retries failed')),
    });

    const result = await executeGenerateRetry({ source: 'fallback' }, deps);

    expect(result.isFallback).toBe(true);
    expect(result.didGenerateRetry).toBe(true);
    expect(result.attemptedDirectRetry).toBe(true);
    expect(result.didDirectRetry).toBe(false);
    expect(result.responseData._fallbackReason).toBe('All retries failed');
  });
});
