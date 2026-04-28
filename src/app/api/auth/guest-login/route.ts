/**
 * Guest PIN Login Route
 *
 * [보안 경고 오탐 방지]
 * 이 라우트는 Supabase Auth를 전혀 사용하지 않는 자체 인증 구현이다.
 * Supabase Security Advisor의 "Leaked Password Protection" 경고와 무관하다.
 *
 * 인증 흐름: GUEST_LOGIN_PIN(env) → timingSafeEqual 비교 → 자체 세션 쿠키 발급
 * 보안 장치: CSRF 보호, Rate Limit, Redis 기반 실패 횟수/잠금, 국가 차단 정책
 */
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuestFullAccessEnabledServer } from '@/config/guestMode.server';
import { getRedisTimeoutMs } from '@/config/redis-timeouts';
import {
  getRequestCountryCode,
  isGuestCountryBlocked,
} from '@/lib/auth/guest-region-policy';
import { createGuestSessionProof } from '@/lib/auth/guest-session-proof.server';
import { recordLoginEvent } from '@/lib/auth/login-audit';
import { getRedisClient, runRedisWithTimeout } from '@/lib/redis/client';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';
import { withCSRFProtection } from '@/utils/security/csrf';
import {
  createGuestPinInvalidResponse,
  createGuestPinRateLimitedResponse,
  createGuestPinRequiredResponse,
  createGuestRegionBlockedResponse,
  createGuestSessionIssueFailedResponse,
  createGuestSuccessResponse,
} from './response-utils';

const GuestLoginRequestSchema = z.object({
  sessionId: z.string().min(1).max(255).optional(),
  guestUserId: z.string().min(1).max(255).optional(),
  guestEmail: z.string().email().optional(),
  guestPin: z.string().min(1).max(20).optional(),
});

// MIGRATED: Removed export const runtime = "nodejs" (default)
export const maxDuration = 10;

const GUEST_PIN_MAX_FAILURES = 5;
const GUEST_PIN_LOCK_SECONDS = 60;
const GUEST_PIN_FAILURE_WINDOW_SECONDS = 15 * 60;
const GUEST_PIN_FAIL_PREFIX = 'auth:guest:pin:fail';
const GUEST_PIN_LOCK_PREFIX = 'auth:guest:pin:lock';
const GUEST_SESSION_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const REDIS_TIMEOUT_MS = getRedisTimeoutMs('fast');

interface LocalPinFailureState {
  count: number;
  expiresAtMs: number;
}

const guestPinFailStore = new Map<string, LocalPinFailureState>();
const guestPinLockStore = new Map<string, number>();

function secureEquals(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isValidGuestPin(value: string): boolean {
  return /^\d{4}$/.test(value);
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() ?? realIp ?? 'unknown';
}

function buildPinAttemptIdentity(
  request: NextRequest,
  sessionId?: string,
  guestUserId?: string
): string {
  const raw = `${getClientIP(request)}:${sessionId ?? ''}:${guestUserId ?? ''}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function getLocalLockRemaining(identity: string): number {
  const lockUntil = guestPinLockStore.get(identity);
  if (!lockUntil) return 0;

  const remainingSeconds = Math.ceil((lockUntil - Date.now()) / 1000);
  if (remainingSeconds <= 0) {
    guestPinLockStore.delete(identity);
    return 0;
  }

  return remainingSeconds;
}

async function getPinLockRemaining(identity: string): Promise<number> {
  const redis = getRedisClient();
  const lockKey = `${GUEST_PIN_LOCK_PREFIX}:${identity}`;

  if (redis) {
    try {
      const ttl = Number(
        await runRedisWithTimeout(
          `guest-login TTL ${lockKey}`,
          () => redis.ttl(lockKey),
          { timeoutMs: REDIS_TIMEOUT_MS }
        )
      );
      if (Number.isFinite(ttl) && ttl > 0) {
        return ttl;
      }
    } catch {
      // Redis 장애 시 메모리 폴백 사용
    }
  }

  return getLocalLockRemaining(identity);
}

async function registerPinFailure(identity: string): Promise<{
  count: number;
  attemptsLeft: number;
  locked: boolean;
  retryAfterSeconds: number;
}> {
  const redis = getRedisClient();
  const failKey = `${GUEST_PIN_FAIL_PREFIX}:${identity}`;
  const lockKey = `${GUEST_PIN_LOCK_PREFIX}:${identity}`;

  if (redis) {
    try {
      const count = Number(
        await runRedisWithTimeout(
          `guest-login INCR ${failKey}`,
          () => redis.incr(failKey),
          { timeoutMs: REDIS_TIMEOUT_MS }
        )
      );
      if (!Number.isFinite(count) || count <= 0) {
        throw new Error('Invalid redis INCR result');
      }

      // 연속 실패는 유한 관찰 윈도우(15분)에서만 누적
      if (count <= 1) {
        await runRedisWithTimeout(
          `guest-login EXPIRE ${failKey}`,
          () => redis.expire(failKey, GUEST_PIN_FAILURE_WINDOW_SECONDS),
          { timeoutMs: REDIS_TIMEOUT_MS }
        );
      }

      if (count >= GUEST_PIN_MAX_FAILURES) {
        await runRedisWithTimeout(
          `guest-login SET ${lockKey}`,
          () => redis.set(lockKey, '1', { ex: GUEST_PIN_LOCK_SECONDS }),
          { timeoutMs: REDIS_TIMEOUT_MS }
        );
        await runRedisWithTimeout(
          `guest-login DEL ${failKey}`,
          () => redis.del(failKey),
          { timeoutMs: REDIS_TIMEOUT_MS }
        );

        return {
          count,
          attemptsLeft: 0,
          locked: true,
          retryAfterSeconds: GUEST_PIN_LOCK_SECONDS,
        };
      }

      const ttl = Number(
        await runRedisWithTimeout(
          `guest-login TTL ${failKey}`,
          () => redis.ttl(failKey),
          { timeoutMs: REDIS_TIMEOUT_MS }
        )
      );
      if (!Number.isFinite(ttl) || ttl <= 0) {
        await runRedisWithTimeout(
          `guest-login EXPIRE ${failKey}`,
          () => redis.expire(failKey, GUEST_PIN_FAILURE_WINDOW_SECONDS),
          { timeoutMs: REDIS_TIMEOUT_MS }
        );
      }

      return {
        count,
        attemptsLeft: Math.max(0, GUEST_PIN_MAX_FAILURES - count),
        locked: false,
        retryAfterSeconds: 0,
      };
    } catch {
      // Redis 장애 시 메모리 폴백 사용
    }
  }

  const previousState = guestPinFailStore.get(identity);
  const now = Date.now();
  const currentCount =
    previousState && previousState.expiresAtMs > now ? previousState.count : 0;
  const nextCount = currentCount + 1;

  if (nextCount >= GUEST_PIN_MAX_FAILURES) {
    guestPinFailStore.delete(identity);
    guestPinLockStore.set(identity, Date.now() + GUEST_PIN_LOCK_SECONDS * 1000);

    return {
      count: nextCount,
      attemptsLeft: 0,
      locked: true,
      retryAfterSeconds: GUEST_PIN_LOCK_SECONDS,
    };
  }

  guestPinFailStore.set(identity, {
    count: nextCount,
    expiresAtMs: now + GUEST_PIN_FAILURE_WINDOW_SECONDS * 1000,
  });
  return {
    count: nextCount,
    attemptsLeft: Math.max(0, GUEST_PIN_MAX_FAILURES - nextCount),
    locked: false,
    retryAfterSeconds: 0,
  };
}

async function clearPinFailureState(identity: string): Promise<void> {
  const redis = getRedisClient();
  const failKey = `${GUEST_PIN_FAIL_PREFIX}:${identity}`;
  const lockKey = `${GUEST_PIN_LOCK_PREFIX}:${identity}`;

  if (redis) {
    try {
      await Promise.all([
        runRedisWithTimeout(
          `guest-login DEL ${failKey}`,
          () => redis.del(failKey),
          { timeoutMs: REDIS_TIMEOUT_MS }
        ),
        runRedisWithTimeout(
          `guest-login DEL ${lockKey}`,
          () => redis.del(lockKey),
          { timeoutMs: REDIS_TIMEOUT_MS }
        ),
      ]);
      return;
    } catch {
      // Redis 장애 시 메모리 폴백 사용
    }
  }

  guestPinFailStore.delete(identity);
  guestPinLockStore.delete(identity);
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  let rawBody: unknown = {};
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }

  const bodyResult = GuestLoginRequestSchema.safeParse(rawBody);
  if (!bodyResult.success) {
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    );
  }

  const { sessionId, guestUserId, guestEmail, guestPin } = bodyResult.data;
  const normalizedSessionId =
    typeof sessionId === 'string' ? sessionId.trim() : '';
  const pinAttemptSessionId =
    normalizedSessionId.length > 0 ? normalizedSessionId : undefined;
  // Always issue a fresh server-side guest session ID to avoid caller-controlled
  // session fixation while still allowing the client-provided ID to namespace
  // PIN throttling state.
  const issuedSessionId = randomUUID();
  const guestFullAccessEnabled = isGuestFullAccessEnabledServer();
  const configuredPin = process.env.GUEST_LOGIN_PIN?.trim() || '';
  const pinAttemptIdentity = buildPinAttemptIdentity(
    request,
    pinAttemptSessionId,
    guestUserId
  );

  if (!guestFullAccessEnabled) {
    const lockRemainingSeconds = await getPinLockRemaining(pinAttemptIdentity);
    if (lockRemainingSeconds > 0) {
      await recordLoginEvent({
        request,
        provider: 'guest',
        actionType: 'login_blocked',
        success: false,
        sessionId: issuedSessionId,
        guestUserId: guestUserId ?? null,
        userEmail: guestEmail ?? null,
        errorMessage: 'Guest login PIN temporarily locked',
        metadata: {
          reason: 'guest_pin_locked',
          retryAfterSeconds: lockRemainingSeconds,
        },
      });

      return createGuestPinRateLimitedResponse(lockRemainingSeconds);
    }

    if (!isValidGuestPin(configuredPin)) {
      await recordLoginEvent({
        request,
        provider: 'guest',
        actionType: 'login_blocked',
        success: false,
        sessionId: issuedSessionId,
        guestUserId: guestUserId ?? null,
        userEmail: guestEmail ?? null,
        errorMessage: 'Guest login PIN is not configured',
        metadata: {
          reason: 'guest_pin_not_configured',
        },
      });

      return createGuestPinRequiredResponse();
    }

    const normalizedPin = guestPin?.trim() || '';
    if (
      !isValidGuestPin(normalizedPin) ||
      !secureEquals(normalizedPin, configuredPin)
    ) {
      const failureState = await registerPinFailure(pinAttemptIdentity);

      if (failureState.locked) {
        await recordLoginEvent({
          request,
          provider: 'guest',
          actionType: 'login_blocked',
          success: false,
          sessionId: issuedSessionId,
          guestUserId: guestUserId ?? null,
          userEmail: guestEmail ?? null,
          errorMessage: 'Guest login PIN lock activated',
          metadata: {
            reason: 'guest_pin_locked',
            failedAttempts: failureState.count,
            retryAfterSeconds: failureState.retryAfterSeconds,
          },
        });

        return createGuestPinRateLimitedResponse(
          failureState.retryAfterSeconds
        );
      }

      await recordLoginEvent({
        request,
        provider: 'guest',
        actionType: 'login_blocked',
        success: false,
        sessionId: issuedSessionId,
        guestUserId: guestUserId ?? null,
        userEmail: guestEmail ?? null,
        errorMessage: 'Guest login PIN mismatch',
        metadata: {
          reason: 'guest_pin_invalid',
          failedAttempts: failureState.count,
          attemptsLeft: failureState.attemptsLeft,
        },
      });

      return createGuestPinInvalidResponse(failureState.attemptsLeft);
    }

    await clearPinFailureState(pinAttemptIdentity);
  }

  const countryCode = getRequestCountryCode(request.headers);
  const isBlocked = isGuestCountryBlocked(countryCode);
  const responseCountryCode = countryCode ?? 'unknown';

  if (isBlocked) {
    await recordLoginEvent({
      request,
      provider: 'guest',
      actionType: 'login_blocked',
      success: false,
      sessionId: issuedSessionId,
      guestUserId: guestUserId ?? null,
      userEmail: guestEmail ?? null,
      errorMessage: 'Guest login blocked by country policy',
      metadata: {
        reason: 'country_blocked',
      },
    });

    return createGuestRegionBlockedResponse(responseCountryCode);
  }

  await recordLoginEvent({
    request,
    provider: 'guest',
    success: true,
    sessionId: issuedSessionId,
    guestUserId: guestUserId ?? null,
    userEmail: guestEmail ?? null,
    metadata: {
      reason: 'guest_login_success',
    },
  });

  const guestSessionProof = createGuestSessionProof(issuedSessionId, {
    maxAgeSeconds: GUEST_SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  if (!guestSessionProof) {
    return createGuestSessionIssueFailedResponse();
  }

  const secureCookie = process.env.NODE_ENV === 'production';
  return createGuestSuccessResponse({
    countryCode: responseCountryCode,
    guestSessionProof,
    secureCookie,
    sessionId: issuedSessionId,
    sessionMaxAgeSeconds: GUEST_SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export const POST = withRateLimit(
  rateLimiters.default,
  withCSRFProtection(handlePOST)
);
