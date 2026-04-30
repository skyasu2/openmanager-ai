/**
 * Approval history read facade.
 *
 * HITL pending/decision writes were removed; this module intentionally exposes
 * only Supabase-backed history readers for audit/RAG use.
 */

export {
  fetchApprovalHistory,
  fetchApprovalHistoryStats,
} from './approval-store-supabase';
export type {
  ApprovalActionType,
  ApprovalHistoryOptions,
  ApprovalHistoryRecord,
  ApprovalHistoryStats,
} from './approval-store-types';
