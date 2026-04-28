import { createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { getAPIAuthContext } from '@/lib/auth/api-auth';
import { AUTH_SESSION_ID_KEY } from '@/lib/auth/guest-session-utils';

export const RATE_LIMIT_IDENTITY_HEADER = 'X-Rate-Limit-Identity';

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

/**
 * Prefer stable auth/session identifiers to avoid sharing one rate-limit bucket
 * across unrelated users behind the same NAT/IP.
 */
export function getRateLimitIdentity(req: NextRequest): string {
  const authContext = getAPIAuthContext(req);

  if (authContext?.userId) {
    return `user:${hashValue(authContext.userId)}`;
  }

  if (authContext?.keyFingerprint) {
    return `api:${authContext.keyFingerprint}`;
  }

  if (authContext?.authType === 'development') return 'env:development';
  if (authContext?.authType === 'test') return 'env:test';

  const authSessionId = req.cookies.get(AUTH_SESSION_ID_KEY)?.value;
  if (authSessionId) return `guest:${hashValue(authSessionId)}`;

  const supabaseTokenCookie = req.cookies
    .getAll()
    .find((cookie) => /^sb-.*-auth-token$/.test(cookie.name))?.value;
  if (supabaseTokenCookie) return `supa:${hashValue(supabaseTokenCookie)}`;

  const apiKey = req.headers.get('x-api-key');
  if (apiKey) return `api:${hashValue(apiKey)}`;

  const testSecret = req.headers.get('x-test-secret');
  if (testSecret) return `test:${hashValue(testSecret)}`;

  const ip =
    req.headers.get('x-vercel-forwarded-for') ||
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    '';
  const ua = req.headers.get('user-agent') || '';

  return `fp:${hashValue(`${ip}|${ua}`)}`;
}
