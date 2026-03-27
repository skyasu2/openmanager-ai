import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisGet = vi.fn();
const redisSet = vi.fn();

vi.mock('../../lib/redis-client', () => ({
  redisGet,
  redisSet,
}));

async function loadUsageModule() {
  vi.resetModules();
  return import('./langfuse-usage');
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

describe('langfuse-usage', () => {
  const originalSampleRate = process.env.LANGFUSE_SAMPLE_RATE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LANGFUSE_SAMPLE_RATE;
  });

  afterEach(() => {
    if (originalSampleRate === undefined) {
      delete process.env.LANGFUSE_SAMPLE_RATE;
    } else {
      process.env.LANGFUSE_SAMPLE_RATE = originalSampleRate;
    }
  });

  it('defaults sample rate to 10% when env is unset', async () => {
    const usage = await loadUsageModule();

    expect(usage.getLangfuseUsageStatus().sampleRate).toBe('10%');
  });

  it('marks usage ready after Redis restore succeeds', async () => {
    redisGet.mockResolvedValue({
      eventCount: 42,
      monthKey: getCurrentMonthKey(),
      isDisabled: false,
      lastWarning: null,
    });

    const usage = await loadUsageModule();
    await usage.restoreUsageFromRedis();

    expect(usage.isLangfuseUsageReady()).toBe(true);
    expect(usage.getLangfuseUsageStatus().eventCount).toBe(42);
  });

  it('marks usage ready after Redis restore failure', async () => {
    redisGet.mockRejectedValue(new Error('redis down'));

    const usage = await loadUsageModule();
    await usage.restoreUsageFromRedis();

    expect(usage.isLangfuseUsageReady()).toBe(true);
  });
});
