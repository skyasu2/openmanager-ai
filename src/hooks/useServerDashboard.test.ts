import { describe, expect, it } from 'vitest';
import {
  matchesStatusFilter,
  normalizeDashboardStatus,
} from './useServerDashboard';

describe('useServerDashboard status helpers', () => {
  it('normalizes status aliases consistently', () => {
    expect(normalizeDashboardStatus('running')).toBe('online');
    expect(normalizeDashboardStatus('degraded')).toBe('warning');
    expect(normalizeDashboardStatus('failed')).toBe('critical');
    expect(normalizeDashboardStatus('down')).toBe('offline');
    expect(normalizeDashboardStatus('weird-status')).toBe('unknown');
  });

  it('matches filter using normalized status', () => {
    expect(matchesStatusFilter('active', 'online')).toBe(true);
    expect(matchesStatusFilter('error', 'critical')).toBe(true);
    expect(matchesStatusFilter('disconnected', 'offline')).toBe(true);
    expect(matchesStatusFilter('online', 'warning')).toBe(false);
    expect(matchesStatusFilter('online', null)).toBe(true);
  });
});
