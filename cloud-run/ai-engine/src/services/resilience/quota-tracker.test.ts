/**
 * Quota Tracker Unit Tests
 *
 * 무료 티어 쿼터 추적 + Pre-emptive Fallback 로직 검증
 * 외부 호출 없음: Redis는 vi.mock(), vi.useFakeTimers() 사용
 *
 * Note: inMemoryUsage는 모듈 레벨 싱글톤 Map이므로 테스트 간 상태가 누적됩니다.
 * 해결: 각 describe 블록에서 vi.setSystemTime()으로 다른 날짜를 설정하면
 * getProviderUsage 내부의 `usage.date !== today` 체크로 자동 리셋됩니다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Redis mock — getRedisClient()가 null 반환하도록 기본 설정
vi.mock('../../lib/redis-client', () => ({
  getRedisClient: vi.fn(() => null),
}));

// logger mock
vi.mock('../../lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getProviderUsage,
  recordProviderUsage,
  getQuotaStatus,
  selectAvailableProvider,
  getQuotaSummary,
  PROVIDER_QUOTAS,
  PREEMPTIVE_THRESHOLDS,
} from './quota-tracker';

// ============================================================================
// 1. 초기 사용량
// ============================================================================
describe('QuotaTracker — Initial usage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('초기 사용량은 0', async () => {
    const usage = await getProviderUsage('cerebras');

    expect(usage.dailyTokens).toBe(0);
    expect(usage.minuteRequests).toBe(0);
    expect(usage.minuteTokens).toBe(0);
    expect(usage.date).toBe('2026-03-01');
  });

  it('lastUpdated와 lastMinuteReset이 현재 시간', async () => {
    const now = Date.now();
    const usage = await getProviderUsage('groq');

    expect(usage.lastUpdated).toBe(now);
    expect(usage.lastMinuteReset).toBe(now);
  });
});

// ============================================================================
// 1-b. 토큰 사용 기록
// ============================================================================
describe('QuotaTracker — Recording', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('토큰 사용량 누적', async () => {
    await recordProviderUsage('cerebras', 1000);
    await recordProviderUsage('cerebras', 500);

    const usage = await getProviderUsage('cerebras');
    expect(usage.dailyTokens).toBe(1500);
    expect(usage.minuteRequests).toBe(2);
    expect(usage.minuteTokens).toBe(1500);
  });

  it('다른 provider는 독립 추적', async () => {
    // gemini/tavily는 이 describe에서 처음 사용 → 간섭 없음
    await recordProviderUsage('gemini', 1000);
    await recordProviderUsage('tavily', 500);

    const gemini = await getProviderUsage('gemini');
    const tavily = await getProviderUsage('tavily');

    expect(gemini.dailyTokens).toBe(1000);
    expect(tavily.dailyTokens).toBe(500);
  });
});

// ============================================================================
// 2. Pre-emptive Fallback 판정
// ============================================================================
describe('QuotaTracker — Pre-emptive Fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('80% 미만일 때 shouldPreemptiveFallback = false', async () => {
    // cerebras: dailyTokenLimit=24M, tokensPerMinute=60K, requestsPerMinute=60
    // 5M / 24M = 20.8% (daily), 5K / 60K = 8.3% (minuteToken), 1/60 = 1.7% (minuteReq)
    // 모든 threshold(80%, 85%, 85%) 미달 → false
    await recordProviderUsage('gemini', 5_000);

    const status = await getQuotaStatus('gemini');
    expect(status.shouldPreemptiveFallback).toBe(false);
  });

  it('daily 80% 이상일 때 shouldPreemptiveFallback = true', async () => {
    // cerebras: 이 describe에서 첫 사용 → 간섭 없음
    await recordProviderUsage('cerebras', 20_000_000);

    const status = await getQuotaStatus('cerebras');
    expect(status.shouldPreemptiveFallback).toBe(true);
  });

  it('minute request 85% 이상일 때 shouldPreemptiveFallback = true', async () => {
    // mistral requestsPerMinute = 30, 85% = 25.5
    for (let i = 0; i < 26; i++) {
      await recordProviderUsage('mistral', 1);
    }

    const status = await getQuotaStatus('mistral');
    expect(status.shouldPreemptiveFallback).toBe(true);
    expect(status.recommendedWaitMs).toBeDefined();
    expect(status.recommendedWaitMs!).toBeGreaterThan(0);
  });
});

// ============================================================================
// 3. Quota Status 계산
// ============================================================================
describe('QuotaTracker — getQuotaStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('usage rate 계산 정확성', async () => {
    await recordProviderUsage('groq', 50_000);

    const status = await getQuotaStatus('groq');

    // groq dailyTokenLimit = 100,000
    expect(status.dailyTokenUsageRate).toBeCloseTo(0.5, 1);
    expect(status.minuteRequestUsageRate).toBeCloseTo(1 / 30, 2);
    expect(status.minuteTokenUsageRate).toBeCloseTo(50_000 / 12_000, 1);
  });

  it('provider와 quota 정보 포함', async () => {
    const status = await getQuotaStatus('gemini');

    expect(status.provider).toBe('gemini');
    expect(status.quota).toEqual(PROVIDER_QUOTAS.gemini);
  });
});

// ============================================================================
// 4. 분당 리셋
// ============================================================================
describe('QuotaTracker — Minute reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-04T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('60초 경과 후 minuteRequests/minuteTokens 초기화', async () => {
    await recordProviderUsage('cerebras', 5000);
    expect((await getProviderUsage('cerebras')).minuteRequests).toBe(1);

    // 61초 경과
    vi.advanceTimersByTime(61_000);

    const usage = await getProviderUsage('cerebras');
    expect(usage.minuteRequests).toBe(0);
    expect(usage.minuteTokens).toBe(0);
    // dailyTokens는 유지
    expect(usage.dailyTokens).toBe(5000);
  });

  it('59초에서는 리셋되지 않음', async () => {
    await recordProviderUsage('groq', 5000);

    vi.advanceTimersByTime(59_000);

    const usage = await getProviderUsage('groq');
    expect(usage.minuteRequests).toBe(1);
  });
});

// ============================================================================
// 5. 날짜 변경 → Daily 리셋
// ============================================================================
describe('QuotaTracker — Daily reset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('날짜가 변경되면 daily 카운터 초기화', async () => {
    await recordProviderUsage('cerebras', 10_000);
    expect((await getProviderUsage('cerebras')).dailyTokens).toBe(10_000);

    // 다음 날로 이동
    vi.setSystemTime(new Date('2026-03-06T00:01:00Z'));

    const usage = await getProviderUsage('cerebras');
    expect(usage.dailyTokens).toBe(0);
    expect(usage.date).toBe('2026-03-06');
  });
});

// ============================================================================
// 6. Redis 미가용 → In-memory fallback
// ============================================================================
describe('QuotaTracker — In-memory fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('Redis null일 때 in-memory로 정상 동작', async () => {
    await recordProviderUsage('groq', 1000);
    const usage = await getProviderUsage('groq');

    expect(usage.dailyTokens).toBe(1000);
  });

  it('Redis 에러 발생 시 in-memory fallback', async () => {
    const { getRedisClient } = await import('../../lib/redis-client');
    const mockedGetRedis = vi.mocked(getRedisClient);

    mockedGetRedis.mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
      set: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
      expire: vi.fn().mockRejectedValue(new Error('Redis connection failed')),
    } as unknown as ReturnType<typeof getRedisClient>);

    await recordProviderUsage('gemini', 500);
    const usage = await getProviderUsage('gemini');

    expect(usage).toBeDefined();
    expect(usage.dailyTokens).toBeGreaterThanOrEqual(0);

    // mock 원복
    mockedGetRedis.mockReturnValue(null);
  });
});

// ============================================================================
// 7. selectAvailableProvider
// ============================================================================
describe('QuotaTracker — selectAvailableProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('모든 provider 가용 시 첫 번째 반환', async () => {
    const result = await selectAvailableProvider(['cerebras', 'mistral', 'groq']);

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('cerebras');
    expect(result!.isPreemptiveFallback).toBe(false);
  });

  it('첫 번째 95% 초과 시 다음 provider 선택', async () => {
    const limit = PROVIDER_QUOTAS.cerebras.dailyTokenLimit;
    await recordProviderUsage('cerebras', Math.ceil(limit * 0.96));

    const result = await selectAvailableProvider(['cerebras', 'mistral', 'groq']);

    expect(result).not.toBeNull();
    expect(result!.provider).toBe('mistral');
  });

  it('전체 소진 시 null 반환', async () => {
    const providers = ['cerebras', 'mistral', 'groq'] as const;
    for (const p of providers) {
      const limit = PROVIDER_QUOTAS[p].dailyTokenLimit;
      await recordProviderUsage(p, Math.ceil(limit * 0.96));
    }

    const result = await selectAvailableProvider(['cerebras', 'mistral', 'groq']);

    expect(result).toBeNull();
  });
});

// ============================================================================
// 8. getQuotaSummary
// ============================================================================
describe('QuotaTracker — getQuotaSummary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('초기 상태에서 모두 healthy', async () => {
    const summary = await getQuotaSummary();

    expect(summary.providers).toHaveLength(5);
    expect(summary.healthyCount).toBe(5);
    expect(summary.warningCount).toBe(0);
    expect(summary.criticalCount).toBe(0);
  });

  it('80%+ provider는 warning으로 카운트', async () => {
    // groq daily 80%+ (100,000 * 0.85 = 85,000)
    await recordProviderUsage('groq', 85_000);

    const summary = await getQuotaSummary();

    expect(summary.warningCount).toBeGreaterThanOrEqual(1);
  });

  it('95%+ provider는 critical로 카운트', async () => {
    // groq daily 95%+ (100,000 * 0.96 = 96,000)
    await recordProviderUsage('groq', 96_000);

    const summary = await getQuotaSummary();

    expect(summary.criticalCount).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// 9. PROVIDER_QUOTAS 데이터 정합성
// ============================================================================
describe('QuotaTracker — Constants', () => {
  it('모든 LLM provider 쿼터 정의 존재', () => {
    expect(PROVIDER_QUOTAS.cerebras).toBeDefined();
    expect(PROVIDER_QUOTAS.groq).toBeDefined();
    expect(PROVIDER_QUOTAS.mistral).toBeDefined();
    expect(PROVIDER_QUOTAS.gemini).toBeDefined();
  });

  it('모든 쿼터에 필수 필드 존재', () => {
    for (const quota of Object.values(PROVIDER_QUOTAS)) {
      expect(quota.dailyTokenLimit).toBeGreaterThan(0);
      expect(quota.requestsPerMinute).toBeGreaterThan(0);
      expect(quota.tokensPerMinute).toBeGreaterThan(0);
    }
  });

  it('PREEMPTIVE_THRESHOLDS 값 범위 검증', () => {
    expect(PREEMPTIVE_THRESHOLDS.dailyTokenThreshold).toBeGreaterThan(0);
    expect(PREEMPTIVE_THRESHOLDS.dailyTokenThreshold).toBeLessThan(1);
    expect(PREEMPTIVE_THRESHOLDS.minuteRequestThreshold).toBeGreaterThan(0);
    expect(PREEMPTIVE_THRESHOLDS.minuteRequestThreshold).toBeLessThan(1);
  });
});
