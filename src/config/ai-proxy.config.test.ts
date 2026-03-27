/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateRetryDelay,
  getAIProxyConfig,
  getCurrentMaxDuration,
  getDefaultTimeout,
  getRouteMaxExecutionMs,
  getVercelTier,
  isRetryableError,
  reloadAIProxyConfig,
} from './ai-proxy.config';

describe('ai-proxy.config facade', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.VERCEL_TIER;
    delete process.env.VERCEL_PLAN;
    delete process.env.AI_MAX_FUNCTION_DURATION_SECONDS;
    delete process.env.AI_FUNCTION_TIMEOUT_RESERVE_MS;
    delete process.env.AI_FORCE_JOB_QUEUE_KEYWORDS;
    delete process.env.AI_STREAM_MAX_RETRIES;
    reloadAIProxyConfig();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    reloadAIProxyConfig();
  });

  it('loads free tier defaults when tier envs are absent', () => {
    const config = getAIProxyConfig();

    expect(getVercelTier()).toBe('free');
    expect(getCurrentMaxDuration()).toBe(60);
    expect(getDefaultTimeout('incident-report')).toBe(7000);
    expect(config.queryRouting.forceJobQueueKeywords).toContain('보고서');
  });

  it('applies pro tier overrides through the loader', () => {
    process.env.VERCEL_PLAN = 'pro';
    process.env.AI_MAX_FUNCTION_DURATION_SECONDS = '400';
    process.env.AI_FUNCTION_TIMEOUT_RESERVE_MS = '2200';
    process.env.AI_FORCE_JOB_QUEUE_KEYWORDS = '요약,대시보드';
    process.env.AI_STREAM_MAX_RETRIES = '4';

    const config = reloadAIProxyConfig();

    expect(config.tier).toBe('pro');
    expect(getCurrentMaxDuration()).toBe(400);
    expect(getRouteMaxExecutionMs(600)).toBe(400_000);
    expect(getRouteMaxExecutionMs(-1)).toBe(0);
    expect(config.functionTimeoutReserveMs).toBe(2200);
    expect(config.queryRouting.forceJobQueueKeywords).toEqual(['요약', '대시보드']);
    expect(config.streamRetry.maxRetries).toBe(4);
  });

  it('keeps retry helpers behavior unchanged', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);

    reloadAIProxyConfig();

    expect(isRetryableError('upstream socket hang up')).toBe(true);
    expect(isRetryableError('validation failed')).toBe(false);
    expect(calculateRetryDelay(1)).toBe(2200);
  });
});
