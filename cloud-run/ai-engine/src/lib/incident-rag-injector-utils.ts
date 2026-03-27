export interface ApprovedIncident {
  id: string;
  session_id: string;
  description: string;
  payload: Record<string, unknown>;
  requested_at: string;
  decided_at: string;
}

export interface IncidentReportRow {
  id: string;
  title: string | null;
  severity: string | null;
  pattern: string | null;
  affected_servers: string[] | null;
  root_cause_analysis: Record<string, unknown> | null;
  recommendations: unknown[] | null;
  timeline: unknown[] | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface IncidentKnowledgeEntry {
  title: string;
  content: string;
  embedding?: string;
  category: 'incident';
  tags: string[];
  severity: 'info' | 'warning' | 'critical';
  source: 'auto_generated';
  serverTypes: string[];
  sourceRef: string;
  sourceType: 'approval_history' | 'incident_reports';
}

export interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export const SYNC_LIMITS = {
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  DEFAULT_LIMIT: 10,
  MIN_DAYS_BACK: 1,
  MAX_DAYS_BACK: 365,
  DEFAULT_DAYS_BACK: 30,
  MIN_CONTENT_LENGTH: 20,
} as const;

export function isMissingApprovalHistory(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { message?: string; code?: string };
  const message = String(maybeError.message || '');
  return (
    (message.includes('approval_history') && message.includes('does not exist')) ||
    message.includes("Could not find the table 'public.approval_history'") ||
    maybeError.code === 'PGRST205'
  );
}

export function mapIncidentReportToApprovedIncident(row: IncidentReportRow): ApprovedIncident {
  const decidedAt = row.updated_at || row.created_at || new Date().toISOString();
  const requestedAt = row.created_at || decidedAt;

  return {
    id: row.id,
    session_id: `incident-report:${row.id}`,
    description: row.title || '인시던트 보고서',
    payload: {
      title: row.title,
      severity: row.severity,
      pattern: row.pattern,
      affected_servers: row.affected_servers || [],
      root_cause_analysis: row.root_cause_analysis || {},
      recommendations: row.recommendations || [],
      timeline: row.timeline || [],
      status: row.status,
      source_table: 'incident_reports',
      source_id: row.id,
    },
    requested_at: requestedAt,
    decided_at: decidedAt,
  };
}

/**
 * Extract incident content for embedding from payload.
 */
export function extractIncidentContent(incident: ApprovedIncident): {
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';
  tags: string[];
  serverTypes: string[];
} {
  const payload = incident.payload;

  const title =
    (payload.title as string) ||
    (payload.summary as string) ||
    incident.description ||
    '인시던트 보고서';

  const contentParts: string[] = [];

  if (incident.description) {
    contentParts.push(`## 개요\n${incident.description}`);
  }

  if (payload.root_cause_analysis) {
    const rca = payload.root_cause_analysis as Record<string, unknown>;
    contentParts.push(`## 근본 원인\n${rca.primary_cause || ''}`);
    if (Array.isArray(rca.contributing_factors)) {
      contentParts.push(`기여 요인: ${rca.contributing_factors.join(', ')}`);
    }
  }

  if (Array.isArray(payload.recommendations)) {
    const recs = payload.recommendations as Array<{ action?: string }>;
    const recTexts = recs.map((r) => r.action || String(r)).join('\n- ');
    contentParts.push(`## 권장 조치\n- ${recTexts}`);
  }

  if (Array.isArray(payload.affected_servers)) {
    contentParts.push(`## 영향 서버\n${(payload.affected_servers as string[]).join(', ')}`);
  }

  if (payload.pattern) {
    contentParts.push(`## 패턴\n${payload.pattern}`);
  }

  if (Array.isArray(payload.timeline)) {
    const timeline = payload.timeline as Array<{
      timestamp?: string;
      event?: string;
    }>;
    const timelineText = timeline
      .map((t) => `- ${t.timestamp || ''}: ${t.event || ''}`)
      .join('\n');
    contentParts.push(`## 타임라인\n${timelineText}`);
  }

  let severity: 'info' | 'warning' | 'critical' = 'info';
  const payloadSeverity = String(payload.severity || '').toLowerCase();
  if (payloadSeverity === 'critical' || payloadSeverity === '위험') {
    severity = 'critical';
  } else if (
    payloadSeverity === 'high' ||
    payloadSeverity === 'warning' ||
    payloadSeverity === '높음'
  ) {
    severity = 'warning';
  }

  const tags: string[] = ['incident', 'auto-generated'];
  if (payload.category) tags.push(String(payload.category));
  if (payload.pattern) tags.push(String(payload.pattern));

  const serverTypes: string[] = [];
  if (Array.isArray(payload.affected_servers)) {
    const servers = payload.affected_servers as string[];
    for (const server of servers) {
      const lower = server.toLowerCase();
      if (lower.includes('web')) serverTypes.push('web');
      else if (lower.includes('db') || lower.includes('database')) serverTypes.push('database');
      else if (lower.includes('api') || lower.includes('app')) serverTypes.push('application');
      else if (lower.includes('cache') || lower.includes('redis')) serverTypes.push('cache');
      else if (lower.includes('storage')) serverTypes.push('storage');
    }
  }

  return {
    title,
    content: contentParts.join('\n\n'),
    severity,
    tags: [...new Set(tags)],
    serverTypes: [...new Set(serverTypes)],
  };
}

/**
 * Validate and sanitize sync options.
 */
export function validateSyncOptions(options: { limit?: number; daysBack?: number }): {
  limit: number;
  daysBack: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  let limit = options.limit ?? SYNC_LIMITS.DEFAULT_LIMIT;
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    warnings.push(`Invalid limit type, using default: ${SYNC_LIMITS.DEFAULT_LIMIT}`);
    limit = SYNC_LIMITS.DEFAULT_LIMIT;
  } else if (limit < SYNC_LIMITS.MIN_LIMIT) {
    warnings.push(`limit ${limit} below minimum, clamped to ${SYNC_LIMITS.MIN_LIMIT}`);
    limit = SYNC_LIMITS.MIN_LIMIT;
  } else if (limit > SYNC_LIMITS.MAX_LIMIT) {
    warnings.push(`limit ${limit} exceeds maximum, clamped to ${SYNC_LIMITS.MAX_LIMIT}`);
    limit = SYNC_LIMITS.MAX_LIMIT;
  }

  let daysBack = options.daysBack ?? SYNC_LIMITS.DEFAULT_DAYS_BACK;
  if (typeof daysBack !== 'number' || !Number.isFinite(daysBack)) {
    warnings.push(`Invalid daysBack type, using default: ${SYNC_LIMITS.DEFAULT_DAYS_BACK}`);
    daysBack = SYNC_LIMITS.DEFAULT_DAYS_BACK;
  } else if (daysBack < SYNC_LIMITS.MIN_DAYS_BACK) {
    warnings.push(`daysBack ${daysBack} below minimum, clamped to ${SYNC_LIMITS.MIN_DAYS_BACK}`);
    daysBack = SYNC_LIMITS.MIN_DAYS_BACK;
  } else if (daysBack > SYNC_LIMITS.MAX_DAYS_BACK) {
    warnings.push(`daysBack ${daysBack} exceeds maximum, clamped to ${SYNC_LIMITS.MAX_DAYS_BACK}`);
    daysBack = SYNC_LIMITS.MAX_DAYS_BACK;
  }

  return { limit: Math.floor(limit), daysBack: Math.floor(daysBack), warnings };
}
