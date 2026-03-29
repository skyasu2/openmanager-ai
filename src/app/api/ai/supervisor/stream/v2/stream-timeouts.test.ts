import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetMaxTimeout,
  mockGetRouteMaxExecutionMs,
  mockGetFunctionTimeoutReserveMs,
} = vi.hoisted(() => ({
  mockGetMaxTimeout: vi.fn(),
  mockGetRouteMaxExecutionMs: vi.fn(),
  mockGetFunctionTimeoutReserveMs: vi.fn(),
}));

vi.mock('@/config/ai-proxy.config', () => ({
  getMaxTimeout: mockGetMaxTimeout,
  getRouteMaxExecutionMs: mockGetRouteMaxExecutionMs,
  getFunctionTimeoutReserveMs: mockGetFunctionTimeoutReserveMs,
}));

import {
  getSupervisorStreamAbortTimeoutMs,
  getSupervisorStreamRequestTimeoutMs,
  getSupervisorStreamRetryTimeoutMs,
  isWarmupAwareFirstQuery,
  parseOptionalDurationHeader,
  parseWarmupStartedAt,
} from './stream-timeouts';

describe('stream-timeouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRouteMaxExecutionMs.mockReturnValue(60_000);
    mockGetFunctionTimeoutReserveMs.mockReturnValue(1_500);
    mockGetMaxTimeout.mockReturnValue(55_000);
  });

  it('computes request timeout using route budget minus reserve', () => {
    expect(getSupervisorStreamRequestTimeoutMs()).toBe(58_500);
  });

  it('treats recent warmup + first query as warmup-aware', () => {
    expect(isWarmupAwareFirstQuery(Date.now() - 1_000, true)).toBe(true);
    expect(isWarmupAwareFirstQuery(Date.now() - 11 * 60 * 1000, true)).toBe(
      false
    );
    expect(isWarmupAwareFirstQuery(Date.now() - 1_000, false)).toBe(false);
  });

  it('uses cold-start timeout for warmup-aware first query', () => {
    expect(
      getSupervisorStreamAbortTimeoutMs({
        isFirstQuery: true,
        warmupStartedAt: Date.now() - 2_000,
      })
    ).toBe(45_000);
  });

  it('clamps timeout to supervisor max timeout and remaining budget', () => {
    mockGetMaxTimeout.mockReturnValue(30_000);
    expect(getSupervisorStreamAbortTimeoutMs()).toBe(30_000);

    mockGetMaxTimeout.mockReturnValue(55_000);
    mockGetRouteMaxExecutionMs.mockReturnValue(20_000);
    mockGetFunctionTimeoutReserveMs.mockReturnValue(5_000);
    expect(getSupervisorStreamAbortTimeoutMs()).toBe(15_000);
  });

  it('computes retry timeout from remaining budget', () => {
    expect(getSupervisorStreamRetryTimeoutMs(45_000)).toBe(13_500);
    expect(getSupervisorStreamRetryTimeoutMs(58_500)).toBeNull();
  });

  it('parses optional numeric headers safely', () => {
    expect(parseWarmupStartedAt('1700000000000')).toBe(1700000000000);
    expect(parseWarmupStartedAt('abc')).toBeNull();
    expect(parseWarmupStartedAt(null)).toBeNull();

    expect(parseOptionalDurationHeader('123.6')).toBe(124);
    expect(parseOptionalDurationHeader('-1')).toBeUndefined();
    expect(parseOptionalDurationHeader(null)).toBeUndefined();
  });
});
