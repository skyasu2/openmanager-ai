import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TRACKED_ENV_KEYS = [
  'SENTRY_LOCAL_ANALYSIS',
  'SENTRY_DSN',
  'NEXT_PUBLIC_SENTRY_DSN',
  'VERCEL_ENV',
  'SENTRY_TUNNEL_UPSTREAM_TIMEOUT_MS',
] as const;

const originalEnv = new Map<string, string | undefined>();

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
  for (const key of TRACKED_ENV_KEYS) {
    originalEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of TRACKED_ENV_KEYS) {
    const original = originalEnv.get(key);
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
  originalEnv.clear();
});

describe('/api/sentry-tunnel local analysis gate', () => {
  it('is disabled by default and does not proxy envelopes', async () => {
    const { GET, POST } = await import('./route');

    const getResponse = await GET();
    await expect(getResponse.json()).resolves.toMatchObject({
      ok: true,
      enabled: false,
    });

    const postResponse = await POST(
      new Request('https://example.test/api/sentry-tunnel', {
        method: 'POST',
        body: 'envelope',
      })
    );

    expect(postResponse.status).toBe(202);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stays disabled on Vercel production even when local analysis env is present', async () => {
    process.env.SENTRY_LOCAL_ANALYSIS = 'true';
    process.env.SENTRY_DSN = 'https://public@example.com/123';
    process.env.VERCEL_ENV = 'production';

    const { GET, POST } = await import('./route');

    const getResponse = await GET();
    await expect(getResponse.json()).resolves.toMatchObject({
      ok: true,
      enabled: false,
    });

    const postResponse = await POST(
      new Request('https://example.test/api/sentry-tunnel', {
        method: 'POST',
        body: 'envelope',
      })
    );

    expect(postResponse.status).toBe(202);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('proxies envelopes only when local analysis is explicitly enabled', async () => {
    process.env.SENTRY_LOCAL_ANALYSIS = 'true';
    process.env.SENTRY_DSN = 'https://public@example.com/123';
    process.env.VERCEL_ENV = 'development';
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 202 }));

    const { GET, POST } = await import('./route');

    const getResponse = await GET();
    await expect(getResponse.json()).resolves.toMatchObject({
      ok: true,
      enabled: true,
    });

    const postResponse = await POST(
      new Request('https://example.test/api/sentry-tunnel', {
        method: 'POST',
        body: 'envelope',
      })
    );

    expect(postResponse.status).toBe(202);
    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/api/123/envelope/',
      expect.objectContaining({
        method: 'POST',
        body: 'envelope',
      })
    );
  });
});
