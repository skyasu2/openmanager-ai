import { createHash, randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { normalizeSupervisorSessionId } from '@/lib/ai/supervisor/request-contracts';
import { getAPIAuthContext } from '@/lib/auth/api-auth';
import { resolveSessionId } from './request-utils';

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function normalizeSessionId(value: string | null | undefined): string | null {
  return normalizeSupervisorSessionId(value);
}

export function createFallbackSessionId(): string {
  return `session-${randomUUID()}`;
}

export function getSessionOwnerKey(req: NextRequest): string {
  const authContext = getAPIAuthContext(req);

  if (authContext?.userId) {
    return `user:${hashValue(authContext.userId)}`;
  }

  if (authContext?.keyFingerprint) {
    return `api:${authContext.keyFingerprint}`;
  }

  if (authContext?.authType === 'development') return 'env:development';
  if (authContext?.authType === 'test') return 'env:test';

  const authSessionId = req.cookies.get('auth_session_id')?.value;
  if (authSessionId) return `guest:${hashValue(authSessionId)}`;

  const supabaseTokenCookie = req.cookies
    .getAll()
    .find((cookie) => /^sb-.*-auth-token$/.test(cookie.name))?.value;
  if (supabaseTokenCookie) return `supa:${hashValue(supabaseTokenCookie)}`;

  const apiKey = req.headers.get('x-api-key');
  if (apiKey) return `api:${hashValue(apiKey)}`;

  const cookieHeader = req.headers.get('cookie');
  if (cookieHeader) return `cookie:${hashValue(cookieHeader)}`;

  const testSecret = req.headers.get('x-test-secret');
  if (testSecret) return `test:${hashValue(testSecret)}`;

  const ip =
    req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || '';
  const ua = req.headers.get('user-agent') || '';

  return `fp:${hashValue(`${ip}|${ua}`)}`;
}

export function resolveScopedSessionIds(
  req: NextRequest,
  bodySessionId?: string,
  fallbackId = createFallbackSessionId()
): {
  sessionId: string;
  cacheSessionId: string;
  ownerKey: string;
} {
  const rawSessionId = resolveSessionId(req, bodySessionId, fallbackId);
  const sessionId = normalizeSessionId(rawSessionId) ?? fallbackId;
  const ownerKey = getSessionOwnerKey(req);

  return {
    sessionId,
    cacheSessionId: `${ownerKey}:${sessionId}`,
    ownerKey,
  };
}
