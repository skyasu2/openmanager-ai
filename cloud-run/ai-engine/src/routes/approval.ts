/**
 * Approval Routes
 *
 * Approval history endpoints for RAG context injection.
 *
 * @version 2.0.0
 * @created 2025-12-28
 * @updated 2026-01-24
 *
 * Note: HITL workflow removed in v4.1.
 * Only `/history` and `/history/stats` endpoints remain for RAG use.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { approvalStore } from '../services/approval/approval-store';
import { handleApiError, jsonSuccess } from '../lib/error-handler';

export const approvalRouter = new Hono();

/**
 * GET /approval/history - Get approval history from PostgreSQL
 */
approvalRouter.get('/history', async (c: Context) => {
  try {
    const status = c.req.query('status') as 'pending' | 'approved' | 'rejected' | 'expired' | undefined;
    const actionType = c.req.query('actionType') as 'incident_report' | 'system_command' | 'critical_alert' | undefined;
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const history = await approvalStore.getHistory({
      status,
      actionType,
      limit,
      offset,
    });

    if (history === null) {
      return c.json({
        success: false,
        error: 'PostgreSQL not available for history query',
        timestamp: new Date().toISOString(),
      }, 503);
    }

    return jsonSuccess(c, {
      count: history.length,
      history,
      pagination: { limit, offset },
    });
  } catch (error) {
    return handleApiError(c, error, 'Approval History');
  }
});

/**
 * GET /approval/history/stats - Get approval statistics
 */
approvalRouter.get('/history/stats', async (c: Context) => {
  try {
    const days = parseInt(c.req.query('days') || '7', 10);
    const stats = await approvalStore.getHistoryStats(days);

    if (stats === null) {
      return c.json({
        success: false,
        error: 'PostgreSQL not available for stats query',
        timestamp: new Date().toISOString(),
      }, 503);
    }

    return jsonSuccess(c, { days, ...stats });
  } catch (error) {
    return handleApiError(c, error, 'Approval History Stats');
  }
});
