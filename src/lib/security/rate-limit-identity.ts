import { createHash, createHmac } from 'crypto';
import type { NextRequest } from 'next/server';
import { getAPIAuthContext } from '@/lib/auth/api-auth';
import { AUTH_SESSION_ID_KEY } from '@/lib/auth/guest-session-utils';

export const RATE_LIMIT_IDENTITY_HEADER = 'X-Rate-Limit-Identity';
export const RATE_LIMIT_IDENTITY_PROOF_HEADER = 'X-Rate-Limit-Identity-Proof';

const RATE_LIMIT_IDENTITY_PROOF_DOMAIN = 'openmanager:rate-limit-identity:v1';

function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

/**
 * Prefer stable auth/session identifiers to avoid sharing one rate-limit bucket
 * across unrelated users behind the same NAT/IP.
 */
function bindSession(identity: string, sessionSubject?: string): string {
  return sessionSubject
    ? `${identity}:session:${hashValue(sessionSubject)}`
    : identity;
}

export function createRateLimitIdentityHeaders(
  identity?: string
): Record<string, string> {
  const secret = process.env.CLOUD_RUN_API_SECRET?.trim();
  if (!identity || !secret) return {};

  const proof = createHmac('sha256', secret)
    .update([RATE_LIMIT_IDENTITY_PROOF_DOMAIN, identity].join('\0'))
    .digest('hex');

  return {
    [RATE_LIMIT_IDENTITY_HEADER]: identity,
    [RATE_LIMIT_IDENTITY_PROOF_HEADER]: proof,
  };
}

export function getRateLimitIdentity(
  req: NextRequest,
  sessionSubject?: string
): string {
  const authContext = getAPIAuthContext(req);

  if (authContext?.userId) {
    return bindSession(`user:${hashValue(authContext.userId)}`, sessionSubject);
  }

  if (authContext?.keyFingerprint) {
    return bindSession(`api:${authContext.keyFingerprint}`, sessionSubject);
  }

  if (authContext?.authType === 'development') {
    return bindSession('env:development', sessionSubject);
  }
  if (authContext?.authType === 'test') {
    return bindSession('env:test', sessionSubject);
  }

  const authSessionId = req.cookies.get(AUTH_SESSION_ID_KEY)?.value;
  if (authSessionId) {
    return bindSession(`guest:${hashValue(authSessionId)}`, sessionSubject);
  }

  const supabaseTokenCookie = req.cookies
    .getAll()
    .find((cookie) => /^sb-.*-auth-token$/.test(cookie.name))?.value;
  if (supabaseTokenCookie) {
    return bindSession(
      `supa:${hashValue(supabaseTokenCookie)}`,
      sessionSubject
    );
  }

  const apiKey = req.headers.get('x-api-key');
  if (apiKey) return bindSession(`api:${hashValue(apiKey)}`, sessionSubject);

  const testSecret = req.headers.get('x-test-secret');
  if (testSecret) {
    return bindSession(`test:${hashValue(testSecret)}`, sessionSubject);
  }

  const ip =
    req.headers.get('x-vercel-forwarded-for') ||
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    '';
  const ua = req.headers.get('user-agent') || '';

  return bindSession(`fp:${hashValue(`${ip}|${ua}`)}`, sessionSubject);
}
