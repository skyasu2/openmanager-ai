import { describe, expect, it, vi } from 'vitest';

const capturedLimiters: Array<{ config?: { maxRequests?: number } }> = [];

vi.mock('@/lib/security/rate-limiter', async (importActual) => {
  const actual =
    await importActual<typeof import('@/lib/security/rate-limiter')>();

  return {
    ...actual,
    withRateLimit: (
      limiter: { config?: { maxRequests?: number } },
      handler: unknown
    ) => {
      capturedLimiters.push(limiter);
      return handler;
    },
  };
});

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/utils/security/csrf', () => ({
  withCSRFProtection: (handler: unknown) => handler,
}));

describe('AI jobs retry route rate-limit contract', () => {
  it('binds retry POST to the stricter 5/minute job limiter', async () => {
    capturedLimiters.length = 0;

    await import('./route');

    expect(capturedLimiters[0]?.config?.maxRequests).toBe(5);
  });
});
