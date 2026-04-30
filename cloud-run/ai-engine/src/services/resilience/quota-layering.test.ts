import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/config-parser', () => ({
  getCerebrasFallbackModelIds: vi.fn(() => []),
  getCerebrasModelId: vi.fn(() => 'llama3.1-8b'),
  getUpstashConfig: vi.fn(() => null),
}));

import {
  CEREBRAS_MODEL_QUOTAS,
  PREEMPTIVE_THRESHOLDS,
  PROVIDER_QUOTAS,
  getQuotaForProvider,
  getQuotaModelCandidates,
  getQuotaUsageScope,
} from './quota-types';
import {
  getDefaultUsage,
  getMemoryUsage,
  normalizeUsage,
  setMemoryUsage,
} from './quota-store-memory';
import {
  REDIS_QUOTA_TTL_SECONDS,
  getCooldownKey,
  getRedisKey,
} from './quota-store-redis';
import {
  CEREBRAS_MODEL_QUOTAS as FACADE_CEREBRAS_MODEL_QUOTAS,
  PREEMPTIVE_THRESHOLDS as FACADE_PREEMPTIVE_THRESHOLDS,
  PROVIDER_QUOTAS as FACADE_PROVIDER_QUOTAS,
  getQuotaForProvider as getFacadeQuotaForProvider,
} from './quota-tracker';

describe('QuotaTracker layering contract', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps quota constants and model-aware lookup in the type/config layer', () => {
    expect(PROVIDER_QUOTAS).toBe(FACADE_PROVIDER_QUOTAS);
    expect(CEREBRAS_MODEL_QUOTAS).toBe(FACADE_CEREBRAS_MODEL_QUOTAS);
    expect(PREEMPTIVE_THRESHOLDS).toBe(FACADE_PREEMPTIVE_THRESHOLDS);
    expect(getQuotaForProvider('cerebras', 'llama3.1-8b')).toEqual(
      getFacadeQuotaForProvider('cerebras', 'llama3.1-8b')
    );
    expect(getQuotaModelCandidates('cerebras')).toEqual(['llama3.1-8b']);
  });

  it('keeps in-memory usage state behind a dedicated store module', () => {
    vi.setSystemTime(new Date('2026-03-20T10:00:00Z'));

    const usage = getDefaultUsage();
    usage.dailyTokens = 123;
    setMemoryUsage('cerebras', usage, 'llama3.1-8b');

    expect(getQuotaUsageScope('cerebras', 'llama3.1-8b')).toBe(
      'cerebras:llama3.1-8b'
    );
    expect(getMemoryUsage('cerebras', 'llama3.1-8b')?.dailyTokens).toBe(123);
    expect(normalizeUsage({ dailyTokens: '456' }).dailyTokens).toBe(456);
  });

  it('keeps Redis key generation and TTL in the Redis store module', () => {
    vi.setSystemTime(new Date('2026-03-20T10:00:00Z'));

    expect(getRedisKey('groq')).toBe('ai:quota:groq:2026-03-20');
    expect(getCooldownKey('cerebras', 'llama3.1-8b')).toBe(
      'ai:quota:cooldown:cerebras:llama3.1-8b'
    );
    expect(REDIS_QUOTA_TTL_SECONDS).toBe(86_400);
  });
});
