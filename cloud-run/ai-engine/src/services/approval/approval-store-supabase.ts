import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../../lib/config-parser';
import { logger } from '../../lib/logger';
import type {
  ApprovalHistoryOptions,
  ApprovalHistoryRecord,
  ApprovalHistoryStats,
} from './approval-store-types';

let supabaseClient: SupabaseClient | null = null;
let supabaseInitFailed = false;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInitFailed) {
    return null;
  }
  if (supabaseClient) {
    return supabaseClient;
  }

  const config = getSupabaseConfig();
  if (!config) {
    supabaseInitFailed = true;
    logger.warn('[Approval] Supabase config missing, history persistence disabled');
    return null;
  }

  try {
    supabaseClient = createClient(config.url, config.serviceRoleKey);
    logger.info('[Approval] PostgreSQL persistence enabled');
    return supabaseClient;
  } catch (error) {
    supabaseInitFailed = true;
    logger.error('[Approval] Supabase init failed:', error);
    return null;
  }
}

export async function fetchApprovalHistory(
  options: ApprovalHistoryOptions = {}
): Promise<ApprovalHistoryRecord[] | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    logger.warn('[Approval] PostgreSQL not available for history query');
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('get_approval_history', {
      p_status: options.status || null,
      p_action_type: options.actionType || null,
      p_limit: options.limit || 50,
      p_offset: options.offset || 0,
      p_from_date: options.fromDate?.toISOString() || null,
      p_to_date: options.toDate?.toISOString() || null,
    });

    if (error) {
      logger.error('[Approval] History query failed:', error);
      return null;
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      sessionId: String(row.session_id),
      actionType: String(row.action_type),
      description: String(row.description),
      status: String(row.status),
      requestedBy: String(row.requested_by),
      requestedAt: new Date(row.requested_at as string),
      decidedBy: row.decided_by ? String(row.decided_by) : null,
      decidedAt: row.decided_at ? new Date(row.decided_at as string) : null,
      reason: row.reason ? String(row.reason) : null,
    }));
  } catch (error) {
    logger.error('[Approval] History query error:', error);
    return null;
  }
}

export async function fetchApprovalHistoryStats(
  days = 7
): Promise<ApprovalHistoryStats | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('get_approval_stats', {
      p_days: days,
    });

    if (error || !data || data.length === 0) {
      logger.error('[Approval] Stats query failed:', error);
      return null;
    }

    const stats = data[0];
    return {
      totalRequests: Number(stats.total_requests || 0),
      approvedCount: Number(stats.approved_count || 0),
      rejectedCount: Number(stats.rejected_count || 0),
      expiredCount: Number(stats.expired_count || 0),
      pendingCount: Number(stats.pending_count || 0),
      approvalRate: Number(stats.approval_rate || 0),
      avgDecisionTimeSeconds: Number(stats.avg_decision_time_seconds || 0),
    };
  } catch (error) {
    logger.error('[Approval] Stats query error:', error);
    return null;
  }
}
