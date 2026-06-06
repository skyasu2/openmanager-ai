import 'server-only';

import { isIP } from 'node:net';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logging';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServerUrl } from '@/lib/supabase/env';
import { getRequestCountryCode } from './guest-region-policy';

const SECURITY_AUDIT_TABLE = 'security_audit_logs';
const AUDIT_RETENTION_DAYS = 90;
const AUDIT_RETENTION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
let auditTableAvailable = true;
let lastAuditCleanupAtMs = 0;

type AuthProvider = 'guest' | 'github' | 'google' | 'unknown';
type LoginActionType = 'login' | 'login_blocked';

interface RecordLoginEventParams {
  request: NextRequest;
  provider: AuthProvider;
  success: boolean;
  actionType?: LoginActionType;
  userId?: string | null;
  userEmail?: string | null;
  sessionId?: string | null;
  guestUserId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}

interface SupabaseInsertErrorLike {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}

function extractClientIp(headers: Headers): string | null {
  const raw =
    headers.get('x-vercel-forwarded-for') ||
    headers.get('x-forwarded-for') ||
    headers.get('x-real-ip');

  if (!raw) return null;

  const firstIp = raw.split(',')[0]?.trim();
  if (!firstIp) return null;

  // IPv4:port 형태 정리
  const ipv4WithPort = firstIp.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  const candidate = ipv4WithPort?.[1] || firstIp;

  return isIP(candidate) > 0 ? candidate : null;
}

function isUuidLike(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isMissingAuditTableError(
  error: SupabaseInsertErrorLike | null | undefined
): boolean {
  const errorText = [error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    error?.code === 'PGRST205' ||
    (errorText.includes(SECURITY_AUDIT_TABLE) &&
      errorText.includes('schema cache')) ||
    errorText.includes('could not find the table')
  );
}

export function resetLoginAuditRuntimeStateForTests() {
  auditTableAvailable = true;
  lastAuditCleanupAtMs = 0;
}

export function normalizeOAuthProvider(
  provider: string | null | undefined
): AuthProvider {
  const normalized = provider?.trim().toLowerCase();
  if (normalized === 'github') return 'github';
  if (normalized === 'google') return 'google';
  if (normalized === 'guest') return 'guest';
  return 'unknown';
}

async function cleanupSecurityAuditLogsIfDue(nowMs = Date.now()) {
  if (
    lastAuditCleanupAtMs > 0 &&
    nowMs - lastAuditCleanupAtMs < AUDIT_RETENTION_CLEANUP_INTERVAL_MS
  ) {
    return;
  }

  lastAuditCleanupAtMs = nowMs;
  const cutoff = new Date(
    nowMs - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const { error } = await supabaseAdmin
      .from(SECURITY_AUDIT_TABLE)
      .delete()
      .lt('created_at', cutoff);

    if (error) {
      logger.warn(
        `[AuthAudit] Failed to cleanup login audit logs older than ${AUDIT_RETENTION_DAYS} days: ${error.message}`
      );
    }
  } catch (error) {
    logger.warn(
      '[AuthAudit] Unexpected error while cleaning up old login audit logs',
      error
    );
  }
}

export async function recordLoginEvent(
  params: RecordLoginEventParams
): Promise<boolean> {
  try {
    // 서비스 롤 키가 없으면 기록만 스킵 (로그인 플로우는 유지)
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      !getSupabaseServerUrl() ||
      !auditTableAvailable
    ) {
      return false;
    }

    const clientIp = extractClientIp(params.request.headers);
    const countryCode = getRequestCountryCode(params.request.headers);

    const metadata = {
      provider: params.provider,
      countryCode,
      sessionId: params.sessionId ?? null,
      guestUserId: params.guestUserId ?? null,
      ...params.metadata,
    };

    const payload: Record<string, unknown> = {
      user_id: isUuidLike(params.userId) ? params.userId : null,
      user_email: params.userEmail ?? null,
      user_role: params.provider,
      action_type: params.actionType ?? 'login',
      resource_type: 'auth',
      resource_id:
        params.sessionId || params.userId || params.guestUserId || null,
      user_agent: params.request.headers.get('user-agent') || null,
      request_method: params.request.method,
      request_path: params.request.nextUrl.pathname,
      success: params.success,
      error_message: params.errorMessage ?? null,
      metadata,
    };

    if (clientIp) {
      payload.ip_address = clientIp;
    }

    const { error } = await supabaseAdmin
      .from(SECURITY_AUDIT_TABLE)
      .insert(payload);

    if (error) {
      if (isMissingAuditTableError(error)) {
        auditTableAvailable = false;
        logger.warn(
          `[AuthAudit] Table '${SECURITY_AUDIT_TABLE}' unavailable - audit logging disabled for this process`
        );
        return false;
      }

      logger.warn(`[AuthAudit] Failed to insert login event: ${error.message}`);
      return false;
    }

    await cleanupSecurityAuditLogsIfDue();
    return true;
  } catch (error) {
    logger.warn(
      '[AuthAudit] Unexpected error while recording login event',
      error
    );
    return false;
  }
}
