/**
 * Approval Routes Tests
 *
 * GET /approval/history, GET /approval/history/stats 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../services/approval/approval-store', () => {
  throw new Error('approval routes must not import the removed approvalStore layer');
});

vi.mock('../services/approval/approval-store-supabase', () => ({
  fetchApprovalHistory: vi.fn(async () => [
    {
      id: '1',
      sessionId: 'session-1',
      status: 'approved',
      actionType: 'incident_report',
      description: 'Approved incident report',
      requestedBy: 'agent',
      requestedAt: new Date('2026-03-01T00:00:00Z'),
      decidedBy: 'operator',
      decidedAt: new Date('2026-03-01T00:01:00Z'),
      reason: 'valid',
    },
    {
      id: '2',
      sessionId: 'session-2',
      status: 'rejected',
      actionType: 'system_command',
      description: 'Rejected system command',
      requestedBy: 'agent',
      requestedAt: new Date('2026-03-02T00:00:00Z'),
      decidedBy: 'operator',
      decidedAt: new Date('2026-03-02T00:02:00Z'),
      reason: 'invalid',
    },
  ]),
  fetchApprovalHistoryStats: vi.fn(async () => ({
    totalRequests: 10,
    approvedCount: 7,
    rejectedCount: 2,
    expiredCount: 0,
    pendingCount: 1,
    approvalRate: 70,
    avgDecisionTimeSeconds: 42,
  })),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { approvalRouter } from './approval';
import {
  fetchApprovalHistory,
  fetchApprovalHistoryStats,
} from '../services/approval/approval-store-supabase';

const app = new Hono();
app.route('/approval', approvalRouter);

describe('Approval Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /approval/history', () => {
    it('승인 이력을 반환한다', async () => {
      const res = await app.request('/approval/history');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.count).toBe(2);
      expect(json.history).toHaveLength(2);
      expect(json.pagination).toEqual({ limit: 50, offset: 0 });
    });

    it('쿼리 파라미터를 Supabase history reader에 전달한다', async () => {
      await app.request('/approval/history?status=approved&limit=10&offset=5');

      expect(fetchApprovalHistory).toHaveBeenCalledWith({
        status: 'approved',
        actionType: undefined,
        limit: 10,
        offset: 5,
      });
    });

    it('PostgreSQL 사용 불가 시 503을 반환한다', async () => {
      vi.mocked(fetchApprovalHistory).mockResolvedValueOnce(null);

      const res = await app.request('/approval/history');

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('서비스 에러 시 에러 응답을 반환한다', async () => {
      vi.mocked(fetchApprovalHistory).mockRejectedValueOnce(new Error('DB timeout'));

      const res = await app.request('/approval/history');

      expect(res.status).toBe(504); // classifyError: 'timeout' -> 504
    });
  });

  describe('GET /approval/history/stats', () => {
    it('승인 통계를 반환한다', async () => {
      const res = await app.request('/approval/history/stats');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.days).toBe(7);
      expect(json.totalRequests).toBe(10);
      expect(json.approvalRate).toBe(70);
    });

    it('days 쿼리 파라미터를 Supabase stats reader에 전달한다', async () => {
      await app.request('/approval/history/stats?days=30');

      expect(fetchApprovalHistoryStats).toHaveBeenCalledWith(30);
    });

    it('PostgreSQL 사용 불가 시 503을 반환한다', async () => {
      vi.mocked(fetchApprovalHistoryStats).mockResolvedValueOnce(null);

      const res = await app.request('/approval/history/stats');

      expect(res.status).toBe(503);
    });
  });
});
