/**
 * @vitest-environment node
 */

import { getDefaultResultOrder, setDefaultResultOrder } from 'node:dns';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ensureStableDnsResolution,
  isDnsResolutionFailure,
  parseArgs,
} from '../../../scripts/test/cloud-deploy-essential-smoke.mjs';

const originalDnsOrder = getDefaultResultOrder();

afterEach(() => {
  setDefaultResultOrder(originalDnsOrder);
});

describe('cloud-deploy-essential-smoke', () => {
  it('normalizes CLI options and trims the target URL', () => {
    const options = parseArgs([
      '--url=https://ai-engine.example.run.app///',
      '--api-key=test-secret',
      '--timeout-ms=9000',
      '--require-auth',
      '--with-supervisor-call',
    ]);

    expect(options).toEqual({
      url: 'https://ai-engine.example.run.app',
      apiKey: 'test-secret',
      timeoutMs: 9000,
      requireAuth: true,
      withSupervisorCall: true,
    });
  });

  it('forces ipv4first DNS ordering to avoid WSL false negatives', () => {
    setDefaultResultOrder('verbatim');

    const previousOrder = ensureStableDnsResolution();

    expect(previousOrder).toBe('verbatim');
    expect(getDefaultResultOrder()).toBe('ipv4first');
  });

  it('detects DNS resolution failures for curl fallback', () => {
    const dnsError = new TypeError('fetch failed');
    Object.assign(dnsError, {
      cause: {
        code: 'EAI_AGAIN',
      },
    });

    const notDnsError = new Error('socket hang up');

    expect(isDnsResolutionFailure(dnsError)).toBe(true);
    expect(isDnsResolutionFailure(notDnsError)).toBe(false);
  });
});
