/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REDIS_TIMEOUT_ENV_KEYS = [
  'UPSTASH_REDIS_OPERATION_TIMEOUT_MS',
  'UPSTASH_REDIS_FAST_TIMEOUT_MS',
  'UPSTASH_REDIS_STANDARD_TIMEOUT_MS',
  'UPSTASH_REDIS_WRITE_TIMEOUT_MS',
  'UPSTASH_REDIS_SCAN_TIMEOUT_MS',
  'UPSTASH_REDIS_BATCH_TIMEOUT_MS',
] as const;

describe('redis timeout config', () => {
  const originalEnv = Object.fromEntries(
    REDIS_TIMEOUT_ENV_KEYS.map((key) => [key, process.env[key]])
  ) as Record<(typeof REDIS_TIMEOUT_ENV_KEYS)[number], string | undefined>;

  beforeEach(() => {
    vi.resetModules();
    for (const key of REDIS_TIMEOUT_ENV_KEYS) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of REDIS_TIMEOUT_ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('loads default timeout buckets when env is unset', async () => {
    const { getRedisTimeoutConfig } = await import('./redis-timeouts');

    expect(getRedisTimeoutConfig()).toEqual({
      operation: 1200,
      fast: 800,
      standard: 1000,
      write: 1200,
      scan: 1500,
      batch: 1500,
    });
  });

  it('applies env overrides per timeout bucket', async () => {
    process.env.UPSTASH_REDIS_OPERATION_TIMEOUT_MS = '1400';
    process.env.UPSTASH_REDIS_FAST_TIMEOUT_MS = '650';
    process.env.UPSTASH_REDIS_STANDARD_TIMEOUT_MS = '900';
    process.env.UPSTASH_REDIS_WRITE_TIMEOUT_MS = '1700';
    process.env.UPSTASH_REDIS_SCAN_TIMEOUT_MS = '2200';
    process.env.UPSTASH_REDIS_BATCH_TIMEOUT_MS = '2400';

    const { getRedisTimeoutConfig } = await import('./redis-timeouts');

    expect(getRedisTimeoutConfig()).toEqual({
      operation: 1400,
      fast: 650,
      standard: 900,
      write: 1700,
      scan: 2200,
      batch: 2400,
    });
  });

  it('falls back to defaults for invalid env values', async () => {
    process.env.UPSTASH_REDIS_OPERATION_TIMEOUT_MS = 'bad';
    process.env.UPSTASH_REDIS_FAST_TIMEOUT_MS = '99';
    process.env.UPSTASH_REDIS_STANDARD_TIMEOUT_MS = '999999';

    const { getRedisTimeoutConfig } = await import('./redis-timeouts');

    expect(getRedisTimeoutConfig()).toEqual({
      operation: 1200,
      fast: 800,
      standard: 1000,
      write: 1200,
      scan: 1500,
      batch: 1500,
    });
  });
});
