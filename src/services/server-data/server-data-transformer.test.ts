/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  deriveNetworkErrors,
  deriveNetworkSplit,
  deriveZombieProcesses,
  estimateLoad15,
} from './server-data-transformer';

describe('deriveNetworkSplit', () => {
  it('splits web traffic with 70/30 ratio', () => {
    const result = deriveNetworkSplit(100, 'web');
    expect(result.networkIn).toBe(70);
    expect(result.networkOut).toBe(30);
  });

  it('splits database traffic with 40/60 ratio', () => {
    const result = deriveNetworkSplit(100, 'database');
    expect(result.networkIn).toBe(40);
    expect(result.networkOut).toBe(60);
  });

  it('uses default 55/45 for unknown type', () => {
    const result = deriveNetworkSplit(100, 'unknown');
    expect(result.networkIn).toBe(55);
    expect(result.networkOut).toBe(45);
  });

  it('handles zero network rate', () => {
    const result = deriveNetworkSplit(0, 'web');
    expect(result.networkIn).toBe(0);
    expect(result.networkOut).toBe(0);
  });

  it('rounds to integers', () => {
    const result = deriveNetworkSplit(33, 'cache'); // 0.45 ratio
    expect(result.networkIn).toBe(Math.round(33 * 0.45));
    expect(result.networkOut).toBe(Math.round(33 * 0.55));
  });

  it('covers all defined server types', () => {
    const types = [
      'web',
      'loadbalancer',
      'application',
      'database',
      'cache',
      'storage',
    ];
    for (const type of types) {
      const result = deriveNetworkSplit(100, type);
      expect(result.networkIn + result.networkOut).toBe(100);
    }
  });
});

describe('estimateLoad15', () => {
  it('returns weighted blend of load1 and load5', () => {
    const result = estimateLoad15(2.0, 1.5);
    // 1.5 * 0.9 + 2.0 * 0.1 = 1.35 + 0.2 = 1.55
    expect(result).toBeCloseTo(1.55, 2);
  });

  it('returns 0 for zero loads', () => {
    expect(estimateLoad15(0, 0)).toBe(0);
  });

  it('never returns negative', () => {
    expect(estimateLoad15(0, 0)).toBeGreaterThanOrEqual(0);
  });

  it('load15 <= load5 when load1 <= load5', () => {
    const result = estimateLoad15(1.0, 2.0);
    // 2.0 * 0.9 + 1.0 * 0.1 = 1.9
    expect(result).toBeLessThanOrEqual(2.0);
  });
});

describe('deriveZombieProcesses', () => {
  it('returns deterministic value for same serverId', () => {
    const a = deriveZombieProcesses('web-nginx-kr-01', 150);
    const b = deriveZombieProcesses('web-nginx-kr-01', 150);
    expect(a).toBe(b);
  });

  it('returns 0, 1, or 2 only', () => {
    const ids = ['srv-01', 'srv-02', 'srv-03', 'db-01', 'cache-01', 'web-99'];
    for (const id of ids) {
      const result = deriveZombieProcesses(id, 120);
      expect([0, 1, 2]).toContain(result);
    }
  });

  it('returns 0 for most servers (statistical check)', () => {
    let zeroCount = 0;
    for (let i = 0; i < 100; i++) {
      if (deriveZombieProcesses(`server-${i}`, 120) === 0) zeroCount++;
    }
    // ~94% should be 0
    expect(zeroCount).toBeGreaterThan(80);
  });
});

describe('deriveNetworkErrors', () => {
  it('returns zero errors for low network usage', () => {
    const result = deriveNetworkErrors(50, 'web-01');
    expect(result.receivedErrors).toBe(0);
    expect(result.sentErrors).toBe(0);
  });

  it('returns zero errors at exactly 80%', () => {
    const result = deriveNetworkErrors(80, 'web-01');
    expect(result.receivedErrors).toBe(0);
    expect(result.sentErrors).toBe(0);
  });

  it('may return errors above 80% network (deterministic)', () => {
    // Test with many server IDs to find one that triggers errors
    let foundErrors = false;
    for (let i = 0; i < 100; i++) {
      const result = deriveNetworkErrors(95, `saturated-nic-${i}`);
      if (result.receivedErrors > 0) {
        foundErrors = true;
        break;
      }
    }
    expect(foundErrors).toBe(true);
  });

  it('is deterministic for same inputs', () => {
    const a = deriveNetworkErrors(90, 'srv-42');
    const b = deriveNetworkErrors(90, 'srv-42');
    expect(a).toEqual(b);
  });
});
