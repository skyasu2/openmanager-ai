import 'server-only';

import { isIP } from 'node:net';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logging';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getRequestCountryCode } from './guest-region-policy';

const SECURITY_AUDIT_TABLE = 'security_audit_logs';

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

export function normalizeOAuthProvider(
  provider: string | null | undefined
): AuthProvider {
  const normalized = provider?.trim().toLowerCase();
  if (normalized === 'github') return 'github';
  if (normalized === 'google') return 'google';
  if (normalized === 'guest') return 'guest';
  return 'unknown';
}

export async function recordLoginEvent(
  params: RecordLoginEventParams
): Promise<boolean> {
  try {
    // 서비스 롤 키가 없으면 기록만 스킵 (로그인 플로우는 유지)
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
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
      logger.warn(`[AuthAudit] Failed to insert login event: ${error.message}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.warn(
      '[AuthAudit] Unexpected error while recording login event',
      error
    );
    return false;
  }
}
