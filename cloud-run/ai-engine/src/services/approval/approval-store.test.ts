/**
 * approval-store.ts read-only facade tests
 *
 * HITL pending/decision writes were removed. This module must only expose the
 * approval history read contract backed by Supabase.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./approval-store-supabase', () => ({
  fetchApprovalHistory: vi.fn(async () => [
    {
      id: 'history-1',
      sessionId: 'session-1',
      actionType: 'incident_report',
      description: 'Approved incident report',
      status: 'approved',
      requestedBy: 'agent',
      requestedAt: new Date('2026-03-01T00:00:00Z'),
      decidedBy: 'operator',
      decidedAt: new Date('2026-03-01T00:01:00Z'),
      reason: 'valid',
    },
  ]),
  fetchApprovalHistoryStats: vi.fn(async () => ({
    totalRequests: 1,
    approvedCount: 1,
    rejectedCount: 0,
    expiredCount: 0,
    pendingCount: 0,
    approvalRate: 100,
    avgDecisionTimeSeconds: 60,
  })),
}));

import * as approvalStoreModule from './approval-store';
import {
  fetchApprovalHistory as facadeFetchApprovalHistory,
  fetchApprovalHistoryStats as facadeFetchApprovalHistoryStats,
} from './approval-store';
import {
  fetchApprovalHistory,
  fetchApprovalHistoryStats,
} from './approval-store-supabase';

describe('approval-store read-only facade', () => {
  it('re-exports Supabase approval history readers directly', async () => {
    const historyOptions = { status: 'approved' as const, limit: 10, offset: 5 };

    await expect(facadeFetchApprovalHistory(historyOptions)).resolves.toHaveLength(1);
    await expect(facadeFetchApprovalHistoryStats(30)).resolves.toMatchObject({
      totalRequests: 1,
      approvalRate: 100,
    });

    expect(facadeFetchApprovalHistory).toBe(fetchApprovalHistory);
    expect(facadeFetchApprovalHistoryStats).toBe(fetchApprovalHistoryStats);
    expect(fetchApprovalHistory).toHaveBeenCalledWith(historyOptions);
    expect(fetchApprovalHistoryStats).toHaveBeenCalledWith(30);
  });

  it('does not expose removed pending approval write APIs', () => {
    expect(approvalStoreModule).not.toHaveProperty('approvalStore');

    for (const removedName of [
      'registerPending',
      'submitDecision',
      'waitForDecision',
      'getPending',
      'hasPending',
      'getDecision',
      'cleanup',
      'getStats',
      '_resetForTesting',
    ]) {
      expect(approvalStoreModule).not.toHaveProperty(removedName);
    }
  });
});
