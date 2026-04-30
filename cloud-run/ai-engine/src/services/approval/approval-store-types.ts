export type ApprovalActionType =
  | 'incident_report'
  | 'system_command'
  | 'critical_alert';

export interface ApprovalHistoryOptions {
  status?: 'pending' | 'approved' | 'rejected' | 'expired';
  actionType?: ApprovalActionType;
  limit?: number;
  offset?: number;
  fromDate?: Date;
  toDate?: Date;
}

export interface ApprovalHistoryRecord {
  id: string;
  sessionId: string;
  actionType: string;
  description: string;
  status: string;
  requestedBy: string;
  requestedAt: Date;
  decidedBy: string | null;
  decidedAt: Date | null;
  reason: string | null;
}

export interface ApprovalHistoryStats {
  totalRequests: number;
  approvedCount: number;
  rejectedCount: number;
  expiredCount: number;
  pendingCount: number;
  approvalRate: number;
  avgDecisionTimeSeconds: number;
}
