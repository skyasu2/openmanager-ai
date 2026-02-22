import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuestFullAccessEnabledServer } from '@/config/guestMode.server';
import {
  getRequestCountryCode,
  isGuestCountryBlocked,
} from '@/lib/auth/guest-region-policy';
import { recordLoginEvent } from '@/lib/auth/login-audit';
import { getRedisClient } from '@/lib/redis/client';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';

const GuestLoginRequestSchema = z.object({
  sessionId: z.string().min(1).max(255).optional(),
  guestUserId: z.string().min(1).max(255).optional(),
  guestEmail: z.string().email().optional(),
  guestPin: z.string().min(1).max(20).optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 10;

const GUEST_PIN_MAX_FAILURES = 5;
const GUEST_PIN_LOCK_SECONDS = 60;
const GUEST_PIN_FAIL_PREFIX = 'auth:guest:pin:fail';
const GUEST_PIN_LOCK_PREFIX = 'auth:guest:pin:lock';

const guestPinFailStore = new Map<string, number>();
const guestPinLockStore = new Map<string, number>();

function secureEquals(left: string, right: string): boolean {
  if (!left || !right) return false;

  const maxLen = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let i = 0; i < maxLen; i += 1) {
    const leftCode = left.charCodeAt(i) || 0;
    const rightCode = right.charCodeAt(i) || 0;
    mismatch |= leftCode ^ rightCode;
  }

  return mismatch === 0;
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
      const ttl = Number(await redis.ttl(lockKey));
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
      const count = Number(await redis.incr(failKey));
      if (!Number.isFinite(count) || count <= 0) {
        throw new Error('Invalid redis INCR result');
      }

      if (count >= GUEST_PIN_MAX_FAILURES) {
        await redis.set(lockKey, '1', { ex: GUEST_PIN_LOCK_SECONDS });
        await redis.del(failKey);

        return {
          count,
          attemptsLeft: 0,
          locked: true,
          retryAfterSeconds: GUEST_PIN_LOCK_SECONDS,
        };
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

  const currentCount = guestPinFailStore.get(identity) ?? 0;
  const nextCount = currentCount + 1;

  if (nextCount >= GUEST_PIN_MAX_FAILURES) {
    guestPinFailStore.delete(identity);
    guestPinLockStore.set(
      identity,
      Date.now() + GUEST_PIN_LOCK_SECONDS * 1000
    );

    return {
      count: nextCount,
      attemptsLeft: 0,
      locked: true,
      retryAfterSeconds: GUEST_PIN_LOCK_SECONDS,
    };
  }

  guestPinFailStore.set(identity, nextCount);
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
      await Promise.all([redis.del(failKey), redis.del(lockKey)]);
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
  const guestFullAccessEnabled = isGuestFullAccessEnabledServer();
  const configuredPin = process.env.GUEST_LOGIN_PIN?.trim() || '';
  const pinAttemptIdentity = buildPinAttemptIdentity(
    request,
    sessionId,
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
        sessionId: sessionId ?? null,
        guestUserId: guestUserId ?? null,
        userEmail: guestEmail ?? null,
        errorMessage: 'Guest login PIN temporarily locked',
        metadata: {
          reason: 'guest_pin_locked',
          retryAfterSeconds: lockRemainingSeconds,
        },
      });

      return NextResponse.json(
        {
          error: 'guest_pin_rate_limited',
          message:
            '게스트 PIN을 5회 연속 잘못 입력했습니다. 1분 후 다시 시도해주세요.',
          retryAfterSeconds: lockRemainingSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(lockRemainingSeconds),
          },
        }
      );
    }

    if (!isValidGuestPin(configuredPin)) {
      await recordLoginEvent({
        request,
        provider: 'guest',
        actionType: 'login_blocked',
        success: false,
        sessionId: sessionId ?? null,
        guestUserId: guestUserId ?? null,
        userEmail: guestEmail ?? null,
        errorMessage: 'Guest login PIN is not configured',
        metadata: {
          reason: 'guest_pin_not_configured',
        },
      });

      return NextResponse.json(
        {
          error: 'guest_pin_required',
          message: '게스트 PIN이 설정되지 않았습니다. 관리자에게 문의해주세요.',
        },
        { status: 403 }
      );
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
          sessionId: sessionId ?? null,
          guestUserId: guestUserId ?? null,
          userEmail: guestEmail ?? null,
          errorMessage: 'Guest login PIN lock activated',
          metadata: {
            reason: 'guest_pin_locked',
            failedAttempts: failureState.count,
            retryAfterSeconds: failureState.retryAfterSeconds,
          },
        });

        return NextResponse.json(
          {
            error: 'guest_pin_rate_limited',
            message:
              '게스트 PIN을 5회 연속 잘못 입력했습니다. 1분 후 다시 시도해주세요.',
            retryAfterSeconds: failureState.retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(failureState.retryAfterSeconds),
            },
          }
        );
      }

      await recordLoginEvent({
        request,
        provider: 'guest',
        actionType: 'login_blocked',
        success: false,
        sessionId: sessionId ?? null,
        guestUserId: guestUserId ?? null,
        userEmail: guestEmail ?? null,
        errorMessage: 'Guest login PIN mismatch',
        metadata: {
          reason: 'guest_pin_invalid',
          failedAttempts: failureState.count,
          attemptsLeft: failureState.attemptsLeft,
        },
      });

      return NextResponse.json(
        {
          error: 'guest_pin_invalid',
          message: `게스트 PIN이 올바르지 않습니다. (${failureState.attemptsLeft}회 남음)`,
          attemptsLeft: failureState.attemptsLeft,
        },
        { status: 403 }
      );
    }

    await clearPinFailureState(pinAttemptIdentity);
  }

  const countryCode = getRequestCountryCode(request.headers);
  const isBlocked = isGuestCountryBlocked(countryCode);

  if (isBlocked) {
    await recordLoginEvent({
      request,
      provider: 'guest',
      actionType: 'login_blocked',
      success: false,
      sessionId: sessionId ?? null,
      guestUserId: guestUserId ?? null,
      userEmail: guestEmail ?? null,
      errorMessage: 'Guest login blocked by country policy',
      metadata: {
        reason: 'country_blocked',
      },
    });

    return NextResponse.json(
      {
        error: 'guest_region_blocked',
        message: '현재 지역에서는 게스트 로그인이 제한됩니다.',
        countryCode,
      },
      { status: 403 }
    );
  }

  await recordLoginEvent({
    request,
    provider: 'guest',
    success: true,
    sessionId: sessionId ?? null,
    guestUserId: guestUserId ?? null,
    userEmail: guestEmail ?? null,
    metadata: {
      reason: 'guest_login_success',
    },
  });

  return NextResponse.json({
    success: true,
    countryCode,
  });
}

export const POST = withRateLimit(rateLimiters.default, handlePOST);
