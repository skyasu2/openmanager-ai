import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '@/lib/logging';

const PROOF_VERSION = 'v1';
const DEFAULT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface GuestSessionProofPayload {
  sid: string;
  iat: number;
  exp: number;
}

interface CreateGuestSessionProofOptions {
  maxAgeSeconds?: number;
  issuedAtMs?: number;
}

function getProofSecret(): string | null {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    logger.error(
      '[GuestSessionProof] SESSION_SECRET or NEXTAUTH_SECRET is required in production'
    );
    return null;
  }

  logger.warn(
    '[GuestSessionProof] using development fallback secret (insecure for production)'
  );
  return 'dev-insecure-guest-session-proof-secret';
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
    return Buffer.from(
      padded.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
  } catch {
    return null;
  }
}

function signPayload(
  secret: string,
  version: string,
  payloadBase64: string
): string {
  return createHmac('sha256', secret)
    .update(`${version}.${payloadBase64}`)
    .digest('hex');
}

export function createGuestSessionProof(
  sessionId: string,
  options: CreateGuestSessionProofOptions = {}
): string | null {
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId || normalizedSessionId.length > 255) {
    return null;
  }

  const secret = getProofSecret();
  if (!secret) return null;

  const issuedAtMs = options.issuedAtMs ?? Date.now();
  const maxAgeSeconds = Math.max(1, options.maxAgeSeconds ?? DEFAULT_MAX_AGE_SECONDS);

  const payload: GuestSessionProofPayload = {
    sid: normalizedSessionId,
    iat: issuedAtMs,
    exp: issuedAtMs + maxAgeSeconds * 1000,
  };

  const payloadBase64 = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(secret, PROOF_VERSION, payloadBase64);
  return `${PROOF_VERSION}.${payloadBase64}.${signature}`;
}

export function verifyGuestSessionProof(
  proofToken: string
): { sessionId: string; expiresAtMs: number } | null {
  const secret = getProofSecret();
  if (!secret) return null;

  const [version, payloadBase64, providedSignature] = proofToken.split('.');
  if (
    version !== PROOF_VERSION ||
    !payloadBase64 ||
    !providedSignature ||
    providedSignature.length !== 64
  ) {
    return null;
  }

  const expectedSignature = signPayload(secret, version, payloadBase64);
  if (providedSignature.length !== expectedSignature.length) {
    return null;
  }

  const providedBuffer = Buffer.from(providedSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (providedBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  const decodedPayload = base64UrlDecode(payloadBase64);
  if (!decodedPayload) return null;

  try {
    const payload = JSON.parse(decodedPayload) as GuestSessionProofPayload;
    if (
      !payload ||
      typeof payload.sid !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.sid.length < 1 ||
      payload.sid.length > 255
    ) {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return { sessionId: payload.sid, expiresAtMs: payload.exp };
  } catch {
    return null;
  }
}

export const guestSessionProof = {
  maxAgeSeconds: DEFAULT_MAX_AGE_SECONDS,
};
