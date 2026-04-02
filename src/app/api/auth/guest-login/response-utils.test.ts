/**
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import {
  createGuestPinInvalidResponse,
  createGuestPinRateLimitedResponse,
  createGuestSessionIssueFailedResponse,
  createGuestSuccessResponse,
} from './response-utils';

describe('guest-login response utils', () => {
  it('creates a rate-limited response with Retry-After header', async () => {
    const response = createGuestPinRateLimitedResponse(60);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(body.error).toBe('guest_pin_rate_limited');
    expect(body.retryAfterSeconds).toBe(60);
  });

  it('creates an invalid-pin response with attempts left', async () => {
    const response = createGuestPinInvalidResponse(3);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('guest_pin_invalid');
    expect(body.attemptsLeft).toBe(3);
  });

  it('creates a session issue response', async () => {
    const response = createGuestSessionIssueFailedResponse();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('guest_session_issue_failed');
  });

  it('creates a success response with auth cookies', async () => {
    const response = createGuestSuccessResponse({
      countryCode: 'KR',
      guestSessionProof: 'proof-token',
      secureCookie: false,
      sessionId: 'guest-session-123',
      sessionMaxAgeSeconds: 3600,
    });
    const body = await response.json();
    const setCookieHeader = response.headers.get('set-cookie') || '';

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sessionId).toBe('guest-session-123');
    expect(setCookieHeader).toContain('auth_session_id=guest-session-123');
    expect(setCookieHeader).toContain('guest_auth_proof=proof-token');
  });
});
