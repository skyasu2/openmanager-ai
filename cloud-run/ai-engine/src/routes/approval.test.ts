/**
 * Approval Routes Tests
 *
 * GET /approval/history, GET /approval/history/stats 테스트.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../services/approval/approval-store', () => ({
  approvalStore: {
    getHistory: vi.fn(async () => [
      { id: '1', status: 'approved', actionType: 'incident_report', createdAt: '2026-03-01' },
      { id: '2', status: 'rejected', actionType: 'system_command', createdAt: '2026-03-02' },
    ]),
    getHistoryStats: vi.fn(async () => ({
      total: 10,
      approved: 7,
      rejected: 2,
      pending: 1,
    })),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { approvalRouter } from './approval';
import { approvalStore } from '../services/approval/approval-store';

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

    it('쿼리 파라미터를 전달한다', async () => {
      await app.request('/approval/history?status=approved&limit=10&offset=5');

      expect(approvalStore.getHistory).toHaveBeenCalledWith({
        status: 'approved',
        actionType: undefined,
        limit: 10,
        offset: 5,
      });
    });

    it('PostgreSQL 사용 불가 시 503을 반환한다', async () => {
      vi.mocked(approvalStore.getHistory).mockResolvedValueOnce(null);

      const res = await app.request('/approval/history');

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('서비스 에러 시 에러 응답을 반환한다', async () => {
      vi.mocked(approvalStore.getHistory).mockRejectedValueOnce(new Error('DB timeout'));

      const res = await app.request('/approval/history');

      expect(res.status).toBe(504); // classifyError: 'timeout' → 504
    });
  });

  describe('GET /approval/history/stats', () => {
    it('승인 통계를 반환한다', async () => {
      const res = await app.request('/approval/history/stats');

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.days).toBe(7);
      expect(json.total).toBe(10);
    });

    it('days 쿼리 파라미터를 전달한다', async () => {
      await app.request('/approval/history/stats?days=30');

      expect(approvalStore.getHistoryStats).toHaveBeenCalledWith(30);
    });

    it('PostgreSQL 사용 불가 시 503을 반환한다', async () => {
      vi.mocked(approvalStore.getHistoryStats).mockResolvedValueOnce(null);

      const res = await app.request('/approval/history/stats');

      expect(res.status).toBe(503);
    });
  });
});
