/**
 * Incident RAG Injector
 *
 * Automatically injects approved incident reports into knowledge_base
 * for RAG search by Reporter Agent.
 *
 * Flow:
 * 1. Fetch source incidents from approval_history (preferred) or incident_reports (fallback)
 * 2. Skip already-synced entries (check source_ref)
 * 3. Generate embeddings using Mistral mistral-embed (1024d)
 * 4. Insert into knowledge_base with category='incident'
 *
 * Rate Limit: Batch of 10, called on-demand only
 *
 * @version 1.1.0 (Mistral embedding migration)
 * @created 2025-12-30
 * @updated 2025-12-31
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config-parser';
import { embedText, toVectorString } from './embedding';
import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

interface ApprovedIncident {
  id: string;
  session_id: string;
  description: string;
  payload: Record<string, unknown>;
  requested_at: string;
  decided_at: string;
}

interface IncidentReportRow {
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

interface IncidentKnowledgeEntry {
  title: string;
  content: string;
  embedding?: string; // Vector string format
  category: 'incident';
  tags: string[];
  severity: 'info' | 'warning' | 'critical';
  source: 'auto_generated';
  serverTypes: string[]; // Maps to related_server_types column
  sourceRef: string; // approval_history.session_id for dedup
  sourceType: 'approval_history' | 'incident_reports';
}

interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

const SYNC_LIMITS = {
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  DEFAULT_LIMIT: 10,
  MIN_DAYS_BACK: 1,
  MAX_DAYS_BACK: 365,
  DEFAULT_DAYS_BACK: 30,
  MIN_CONTENT_LENGTH: 20,
} as const;

function isMissingApprovalHistory(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeError = error as { message?: string; code?: string };
  const message = String(maybeError.message || '');
  return (
    (message.includes('approval_history') && message.includes('does not exist')) ||
    message.includes("Could not find the table 'public.approval_history'") ||
    maybeError.code === 'PGRST205'
  );
}

function mapIncidentReportToApprovedIncident(row: IncidentReportRow): ApprovedIncident {
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

// ============================================================================
// Supabase Client
// ============================================================================

let supabaseClient: SupabaseClient | null = null;
let initFailed = false;

function getSupabaseClient(): SupabaseClient | null {
  if (initFailed) return null;
  if (supabaseClient) return supabaseClient;

  const config = getSupabaseConfig();
  if (!config) {
    initFailed = true;
    logger.warn('⚠️ [IncidentRAG] Supabase config missing');
    return null;
  }

  try {
    supabaseClient = createClient(config.url, config.serviceRoleKey);
    console.log('✅ [IncidentRAG] Supabase client initialized');
    return supabaseClient;
  } catch (e) {
    initFailed = true;
    logger.error('❌ [IncidentRAG] Supabase init failed:', e);
    return null;
  }
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Extract incident content for embedding from payload
 */
function extractIncidentContent(incident: ApprovedIncident): {
  title: string;
  content: string;
  severity: 'info' | 'warning' | 'critical';
  tags: string[];
  serverTypes: string[];
} {
  const payload = incident.payload;

  // Extract title
  const title =
    (payload.title as string) ||
    (payload.summary as string) ||
    incident.description ||
    '인시던트 보고서';

  // Build rich content for embedding
  const contentParts: string[] = [];

  // Add description
  if (incident.description) {
    contentParts.push(`## 개요\n${incident.description}`);
  }

  // Add root cause if available
  if (payload.root_cause_analysis) {
    const rca = payload.root_cause_analysis as Record<string, unknown>;
    contentParts.push(`## 근본 원인\n${rca.primary_cause || ''}`);
    if (Array.isArray(rca.contributing_factors)) {
      contentParts.push(`기여 요인: ${rca.contributing_factors.join(', ')}`);
    }
  }

  // Add recommendations
  if (Array.isArray(payload.recommendations)) {
    const recs = payload.recommendations as Array<{ action?: string }>;
    const recTexts = recs.map((r) => r.action || String(r)).join('\n- ');
    contentParts.push(`## 권장 조치\n- ${recTexts}`);
  }

  // Add affected servers
  if (Array.isArray(payload.affected_servers)) {
    contentParts.push(`## 영향 서버\n${(payload.affected_servers as string[]).join(', ')}`);
  }

  // Add pattern if available
  if (payload.pattern) {
    contentParts.push(`## 패턴\n${payload.pattern}`);
  }

  // Add timeline if available
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

  // Extract severity
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

  // Extract tags
  const tags: string[] = ['incident', 'auto-generated'];
  if (payload.category) tags.push(String(payload.category));
  if (payload.pattern) tags.push(String(payload.pattern));

  // Extract server types from affected servers
  const serverTypes: string[] = [];
  if (Array.isArray(payload.affected_servers)) {
    // Try to infer server types from names
    const servers = payload.affected_servers as string[];
    for (const server of servers) {
      const lower = server.toLowerCase();
      if (lower.includes('web')) serverTypes.push('web');
      else if (lower.includes('db') || lower.includes('database'))
        serverTypes.push('database');
      else if (lower.includes('api') || lower.includes('app'))
        serverTypes.push('application');
      else if (lower.includes('cache') || lower.includes('redis'))
        serverTypes.push('cache');
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
 * Check if incident is already synced to knowledge_base
 */
async function isAlreadySynced(
  supabase: SupabaseClient,
  sessionId: string
): Promise<boolean> {
  // Prefer metadata.source_ref for dedup.
  // Keep legacy tags-based fallback for backward compatibility.
  const { data, error } = await supabase
    .from('knowledge_base')
    .select('id')
    .eq('category', 'incident')
    .eq('source', 'auto_generated')
    .filter('metadata->>source_ref', 'eq', sessionId)
    .limit(1);

  if (error) {
    logger.warn('⚠️ [IncidentRAG] Dedup check failed, assuming already synced to prevent duplicates:', error);
    return true;
  }

  if (Array.isArray(data) && data.length > 0) {
    return true;
  }

  // Legacy fallback: old rows stored source ref in tags only.
  const { data: legacyData, error: legacyError } = await supabase
    .from('knowledge_base')
    .select('id')
    .eq('category', 'incident')
    .eq('source', 'auto_generated')
    .contains('tags', [sessionId])
    .limit(1);

  if (legacyError) {
    logger.warn('⚠️ [IncidentRAG] Legacy dedup check failed, assuming already synced to prevent duplicates:', legacyError);
    return true;
  }

  return Array.isArray(legacyData) && legacyData.length > 0;
}

/**
 * Insert incident into knowledge_base with embedding
 */
async function insertToKnowledgeBase(
  supabase: SupabaseClient,
  entry: IncidentKnowledgeEntry
): Promise<boolean> {
  try {
    const metadata = {
      source_ref: entry.sourceRef,
      source_type: entry.sourceType,
      injected_by: 'incident-rag-injector',
      injected_at: new Date().toISOString(),
    } as const;

    const { error } = await supabase.from('knowledge_base').insert({
      title: entry.title,
      content: entry.content,
      embedding: entry.embedding,
      category: entry.category,
      tags: entry.tags,
      severity: entry.severity,
      source: entry.source,
      related_server_types: entry.serverTypes || [],
      metadata,
    });

    if (error) {
      logger.error('❌ [IncidentRAG] Insert failed:', error);
      return false;
    }

    return true;
  } catch (e) {
    logger.error('❌ [IncidentRAG] Insert error:', e);
    return false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Validate and sanitize sync options
 */
function validateSyncOptions(options: { limit?: number; daysBack?: number }): {
  limit: number;
  daysBack: number;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Validate limit
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

  // Validate daysBack
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

/**
 * Sync approved incident reports to knowledge_base for RAG
 *
 * @param options - Sync options
 * @param options.limit - Max number of incidents to sync (1-100, default: 10)
 * @param options.daysBack - How many days back to look (1-365, default: 30)
 * @returns Sync result with counts
 */
export async function syncIncidentsToRAG(
  options: { limit?: number; daysBack?: number } = {}
): Promise<SyncResult> {
  // Validate and sanitize inputs
  const validated = validateSyncOptions(options);
  const { limit, daysBack, warnings } = validated;
  const result: SyncResult = {
    success: false,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [...warnings], // Include validation warnings
  };

  // Log validation warnings
  if (warnings.length > 0) {
    logger.warn(`⚠️ [IncidentRAG] Input validation warnings: ${warnings.join('; ')}`);
  }

  console.log(
    `🔄 [IncidentRAG] Starting sync (limit=${limit}, daysBack=${daysBack})`
  );

  const supabase = getSupabaseClient();
  if (!supabase) {
    result.errors.push('Supabase not available');
    return result;
  }

  try {
    // 1. Fetch source incidents:
    //    priority) approval_history (HITL approved)
    //    fallback) incident_reports (for deployments without approval_history)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);

    const { data: approvalIncidents, error: fetchError } = await supabase
      .from('approval_history')
      .select('id, session_id, description, payload, requested_at, decided_at')
      .eq('action_type', 'incident_report')
      .eq('status', 'approved')
      .gte('decided_at', sinceDate.toISOString())
      .order('decided_at', { ascending: false })
      .limit(limit);

    let incidents: ApprovedIncident[] = [];

    if (fetchError) {
      if (!isMissingApprovalHistory(fetchError)) {
        result.errors.push(`Fetch error: ${fetchError.message}`);
        return result;
      }
      logger.info('[IncidentRAG] approval_history missing, falling back to incident_reports');
    } else if (approvalIncidents && approvalIncidents.length > 0) {
      incidents = approvalIncidents as ApprovedIncident[];
    }

    if (incidents.length === 0) {
      const { data: reportRows, error: reportError } = await supabase
        .from('incident_reports')
        .select(
          'id, title, severity, pattern, affected_servers, root_cause_analysis, recommendations, timeline, status, created_at, updated_at'
        )
        .gte('updated_at', sinceDate.toISOString())
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (reportError) {
        result.errors.push(`Fallback fetch error: ${reportError.message}`);
        return result;
      }

      incidents = (reportRows || []).map((row) =>
        mapIncidentReportToApprovedIncident(row as IncidentReportRow)
      );
    }

    if (incidents.length === 0) {
      console.log('✅ [IncidentRAG] No new incidents to sync');
      result.success = true;
      return result;
    }

    console.log(`📋 [IncidentRAG] Found ${incidents.length} source incidents`);

    // 2. Process each incident
    for (const incident of incidents) {
      try {
        // Check dedup
        if (await isAlreadySynced(supabase, incident.session_id)) {
          console.log(`⏭️ [IncidentRAG] Skipping already synced: ${incident.session_id}`);
          result.skipped++;
          continue;
        }

        // Extract content
        const extracted = extractIncidentContent(incident);

        if (!extracted.content || extracted.content.length < SYNC_LIMITS.MIN_CONTENT_LENGTH) {
          logger.warn(`⚠️ [IncidentRAG] Insufficient content for: ${incident.session_id}`);
          result.skipped++;
          continue;
        }

        // Generate embedding
        const embeddingText = `${extracted.title}\n\n${extracted.content}`;
        const embedding = await embedText(embeddingText);
        const vectorString = toVectorString(embedding);

        // Insert to knowledge_base
        const entry: IncidentKnowledgeEntry = {
          title: extracted.title,
          content: extracted.content,
          embedding: vectorString,
          category: 'incident',
          tags: [...extracted.tags, incident.session_id], // Include session_id for dedup
          severity: extracted.severity,
          source: 'auto_generated',
          serverTypes: extracted.serverTypes,
          sourceRef: incident.session_id,
          sourceType:
            String(incident.payload.source_table || '') === 'incident_reports'
              ? 'incident_reports'
              : 'approval_history',
        };

        const inserted = await insertToKnowledgeBase(supabase, entry);

        if (inserted) {
          console.log(`✅ [IncidentRAG] Synced: ${incident.session_id}`);
          result.synced++;
        } else {
          result.failed++;
        }
      } catch (e) {
        logger.error(`❌ [IncidentRAG] Error processing ${incident.session_id}:`, e);
        result.errors.push(`${incident.session_id}: ${String(e)}`);
        result.failed++;
      }
    }

    result.success = true;
    console.log(
      `✅ [IncidentRAG] Sync complete: ${result.synced} synced, ${result.skipped} skipped, ${result.failed} failed`
    );

    return result;
  } catch (e) {
    logger.error('❌ [IncidentRAG] Sync failed:', e);
    result.errors.push(String(e));
    return result;
  }
}

/**
 * Get RAG injection stats
 */
export async function getRAGInjectionStats(): Promise<{
  totalIncidents: number;
  syncedIncidents: number;
  pendingSync: number;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    // Count source incidents (approval_history preferred, incident_reports fallback)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 30);

    const { count: approvalCount, error: approvalCountError } = await supabase
      .from('approval_history')
      .select('*', { count: 'exact', head: true })
      .eq('action_type', 'incident_report')
      .eq('status', 'approved')
      .gte('decided_at', sinceDate.toISOString());

    let totalCount = approvalCount || 0;

    if (approvalCountError && isMissingApprovalHistory(approvalCountError)) {
      const { count: reportCount, error: reportCountError } = await supabase
        .from('incident_reports')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', sinceDate.toISOString());

      if (reportCountError) {
        logger.error('❌ [IncidentRAG] incident_reports count failed:', reportCountError);
        return null;
      }

      totalCount = reportCount || 0;
    } else if (approvalCountError) {
      logger.error('❌ [IncidentRAG] approval_history count failed:', approvalCountError);
      return null;
    }

    // Count synced incidents in knowledge_base
    const { count: syncedCount } = await supabase
      .from('knowledge_base')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'incident')
      .eq('source', 'auto_generated');

    return {
      totalIncidents: totalCount,
      syncedIncidents: syncedCount || 0,
      pendingSync: Math.max(0, totalCount - (syncedCount || 0)),
    };
  } catch (e) {
    logger.error('❌ [IncidentRAG] Stats error:', e);
    return null;
  }
}

export default { syncIncidentsToRAG, getRAGInjectionStats };
