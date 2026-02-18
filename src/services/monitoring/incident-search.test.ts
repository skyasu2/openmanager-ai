/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  queryIncidentEvents,
  resetIncidentIndexCacheForTesting,
} from './incident-search';

describe('incident-search', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    resetIncidentIndexCacheForTesting();
  });

  it('returns incident events from 24h OTel hourly data', async () => {
    const result = await queryIncidentEvents({ limit: 200 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.metadata.windowStart).toBeTruthy();
    expect(result.metadata.windowEnd).toBeTruthy();
    expect(
      result.items.some(
        (item) => item.status === 'warning' || item.status === 'critical'
      )
    ).toBe(true);
  });

  it('filters incidents by severity', async () => {
    const result = await queryIncidentEvents({
      severity: 'critical',
      limit: 100,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((item) => item.status === 'critical')).toBe(true);
  });

  it('filters incidents by metric', async () => {
    const result = await queryIncidentEvents({
      metric: 'memory',
      limit: 100,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(
      result.items.every((item) =>
        item.causes.some((cause) => cause.metric === 'memory')
      )
    ).toBe(true);
  });

  it('supports search by server id', async () => {
    const result = await queryIncidentEvents({
      search: 'cache-redis-dc1-01',
      limit: 100,
    });

    expect(result.total).toBeGreaterThan(0);
    expect(
      result.items.every((item) => item.serverId.includes('cache-redis-dc1-01'))
    ).toBe(true);
  });
});
