import { describe, expect, it } from 'vitest';

import { buildSlot, type RawServerData } from './precomputed-state-slot';
import type { SystemRulesThresholds } from './precomputed-state.types';

const thresholds: SystemRulesThresholds = {
  cpu: { warning: 70, critical: 90 },
  memory: { warning: 80, critical: 95 },
  disk: { warning: 85, critical: 95 },
  network: { warning: 80, critical: 95 },
};

function createServer(
  overrides: Partial<RawServerData> = {}
): RawServerData {
  return {
    id: 'api-was-dc1-01',
    name: 'API WAS 01',
    type: 'application',
    cpu: 24,
    memory: 38,
    disk: 29,
    network: 12,
    ...overrides,
  };
}

describe('buildSlot offline status parity', () => {
  it('does not mark a server offline when metrics exist even if legacy status is offline', () => {
    const slot = buildSlot(
      {
        'api-was-dc1-01': createServer({ status: 'offline' }),
      },
      {},
      0,
      18,
      0,
      thresholds
    );

    expect(slot.summary.offline).toBe(0);
    expect(slot.summary.online).toBe(1);
    expect(slot.servers[0]?.status).toBe('online');
  });

  it('marks a server offline only when cpu, memory, and disk are all zero', () => {
    const slot = buildSlot(
      {
        'api-was-dc1-01': createServer({
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 7,
          status: 'online',
        }),
      },
      {},
      0,
      18,
      0,
      thresholds
    );

    expect(slot.summary.offline).toBe(1);
    expect(slot.summary.online).toBe(0);
    expect(slot.servers[0]?.status).toBe('offline');
  });
});
