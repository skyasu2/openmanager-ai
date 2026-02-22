/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRecordLoginEvent,
  mockGetRequestCountryCode,
  mockIsGuestCountryBlocked,
  mockIsGuestFullAccessEnabledServer,
} = vi.hoisted(() => ({
  mockRecordLoginEvent: vi.fn(),
  mockGetRequestCountryCode: vi.fn(),
  mockIsGuestCountryBlocked: vi.fn(),
  mockIsGuestFullAccessEnabledServer: vi.fn(),
}));

vi.mock('@/lib/auth/login-audit', () => ({
  recordLoginEvent: mockRecordLoginEvent,
}));

vi.mock('@/lib/auth/guest-region-policy', () => ({
  getRequestCountryCode: mockGetRequestCountryCode,
  isGuestCountryBlocked: mockIsGuestCountryBlocked,
}));

vi.mock('@/config/guestMode.server', () => ({
  isGuestFullAccessEnabledServer: mockIsGuestFullAccessEnabledServer,
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: { default: {} },
  withRateLimit:
    (
      _rateLimiter: unknown,
      handler: (request: NextRequest) => Promise<Response>
    ) =>
    (request: NextRequest) =>
      handler(request),
}));

import { POST } from './route';

describe('POST /api/auth/guest-login', () => {
  const originalGuestPin = process.env.GUEST_LOGIN_PIN;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordLoginEvent.mockResolvedValue(true);
    mockGetRequestCountryCode.mockReturnValue('KR');
    mockIsGuestCountryBlocked.mockReturnValue(false);
    mockIsGuestFullAccessEnabledServer.mockReturnValue(false);
    process.env.GUEST_LOGIN_PIN = '1234';
  });

  afterEach(() => {
    process.env.GUEST_LOGIN_PIN = originalGuestPin;
  });

  it('PIN이 없거나 불일치하면 403을 반환한다', async () => {
    const request = new NextRequest(
      'https://openmanager.test/api/auth/guest-login',
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'guest-session-dev-auth',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('guest_pin_invalid');
    expect(mockRecordLoginEvent).toHaveBeenCalledTimes(1);
  });

  it('PIN이 맞아도 차단 국가면 403을 반환한다', async () => {
    mockGetRequestCountryCode.mockReturnValue('CN');
    mockIsGuestCountryBlocked.mockReturnValue(true);

    const request = new NextRequest(
      'https://openmanager.test/api/auth/guest-login',
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'guest-session-1',
          guestUserId: 'guest-user-1',
          guestEmail: 'guest@example.com',
          guestPin: '1234',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('guest_region_blocked');
    expect(mockRecordLoginEvent).toHaveBeenCalledTimes(1);
  });

  it('허용 국가면 성공을 반환한다', async () => {
    const request = new NextRequest(
      'https://openmanager.test/api/auth/guest-login',
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'guest-session-2',
          guestUserId: 'guest-user-2',
          guestPin: '1234',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRecordLoginEvent).toHaveBeenCalledTimes(1);
  });

  it('게스트 풀 액세스 활성화 시 PIN 없이도 성공한다', async () => {
    mockIsGuestFullAccessEnabledServer.mockReturnValue(true);

    const request = new NextRequest(
      'https://openmanager.test/api/auth/guest-login',
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'guest-session-full-access',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    expect(response.status).toBe(200);
  });

  it('PIN 설정이 없으면 403 guest_pin_required를 반환한다', async () => {
    process.env.GUEST_LOGIN_PIN = '';

    const request = new NextRequest(
      'https://openmanager.test/api/auth/guest-login',
      {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'guest-session-no-pin',
          guestPin: '1234',
        }),
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('guest_pin_required');
  });
});
