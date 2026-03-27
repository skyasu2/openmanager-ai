export type ApprovalActionType =
  | 'incident_report'
  | 'system_command'
  | 'critical_alert';

export interface PendingApproval {
  sessionId: string;
  actionType: ApprovalActionType;
  description: string;
  payload: Record<string, unknown>;
  requestedAt: Date;
  requestedBy: string;
  expiresAt: Date;
}

export interface ApprovalDecision {
  approved: boolean;
  decidedAt: Date;
  decidedBy?: string;
  reason?: string;
}

export interface RedisApprovalEntry {
  pending: {
    sessionId: string;
    actionType: ApprovalActionType;
    description: string;
    payload: Record<string, unknown>;
    requestedAt: string;
    requestedBy: string;
    expiresAt: string;
  };
  decision: {
    approved: boolean;
    decidedAt: string;
    decidedBy?: string;
    reason?: string;
  } | null;
}

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
