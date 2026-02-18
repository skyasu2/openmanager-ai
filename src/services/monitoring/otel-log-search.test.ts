/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryOTelLogs, resetLogIndexCacheForTesting } from './otel-log-search';

describe('otel-log-search', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    resetLogIndexCacheForTesting();
  });

  it('returns log entries from 24h OTel hourly data', async () => {
    const result = await queryOTelLogs({ limit: 100 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.metadata.windowStart).toBeTruthy();
    expect(result.metadata.windowEnd).toBeTruthy();
    expect(result.metadata.availableSources.length).toBeGreaterThan(0);
    expect(result.metadata.availableServers.length).toBeGreaterThan(0);
  });

  it('filters logs by level', async () => {
    const result = await queryOTelLogs({ level: 'warn', limit: 100 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((item) => item.level === 'warn')).toBe(true);
  });

  it('filters logs by level=error', async () => {
    const result = await queryOTelLogs({ level: 'error', limit: 100 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((item) => item.level === 'error')).toBe(true);
  });

  it('supports keyword search', async () => {
    const allLogs = await queryOTelLogs({ limit: 1 });
    if (allLogs.items.length === 0) return;

    const keyword = allLogs.items[0].source;
    const result = await queryOTelLogs({ keyword, limit: 100 });

    expect(result.total).toBeGreaterThan(0);
    expect(
      result.items.every(
        (item) =>
          item.message.toLowerCase().includes(keyword.toLowerCase()) ||
          item.serverId.toLowerCase().includes(keyword.toLowerCase()) ||
          item.source.toLowerCase().includes(keyword.toLowerCase())
      )
    ).toBe(true);
  });

  it('paginates results correctly', async () => {
    const page1 = await queryOTelLogs({ page: 1, limit: 5 });
    const page2 = await queryOTelLogs({ page: 2, limit: 5 });

    expect(page1.page).toBe(1);
    expect(page1.limit).toBe(5);
    expect(page1.items.length).toBeLessThanOrEqual(5);

    if (page1.totalPages > 1) {
      expect(page2.page).toBe(2);
      expect(page2.items[0]?.timestamp).not.toBe(page1.items[0]?.timestamp);
    }
  });
});
