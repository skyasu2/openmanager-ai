import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isGuestFullAccessEnabledServer } from '@/config/guestMode.server';
import {
  getRequestCountryCode,
  isGuestCountryBlocked,
} from '@/lib/auth/guest-region-policy';
import { recordLoginEvent } from '@/lib/auth/login-audit';
import { rateLimiters, withRateLimit } from '@/lib/security/rate-limiter';

const GuestLoginRequestSchema = z.object({
  sessionId: z.string().min(1).max(255).optional(),
  guestUserId: z.string().min(1).max(255).optional(),
  guestEmail: z.string().email().optional(),
  guestPin: z.string().min(1).max(20).optional(),
});

export const runtime = 'nodejs';
export const maxDuration = 10;

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

  if (!guestFullAccessEnabled) {
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
        },
      });

      return NextResponse.json(
        {
          error: 'guest_pin_invalid',
          message: '게스트 PIN이 올바르지 않습니다.',
        },
        { status: 403 }
      );
    }
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
