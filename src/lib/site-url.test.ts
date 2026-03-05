import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('getSiteUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadGetSiteUrl(): Promise<{ getSiteUrl: (...args: never) => unknown }> {
    const mod = await import('./site-url');
    return mod;
  }

  it('returns default URL when no env vars are set', async () => {
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://openmanager-ai.vercel.app');
  });

  it('uses NEXT_PUBLIC_SITE_URL when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://my-custom-site.example.com');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://my-custom-site.example.com');
  });

  it('uses NEXT_PUBLIC_APP_URL as fallback when NEXT_PUBLIC_SITE_URL is not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app-url.example.com');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://app-url.example.com');
  });

  it('uses VERCEL_PROJECT_PRODUCTION_URL as fallback', async () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'https://prod-url.vercel.app');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://prod-url.vercel.app');
  });

  it('preview deployment uses VERCEL_URL', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_URL', 'my-app-abc123.vercel.app');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://my-app-abc123.vercel.app');
  });

  it('rejects localhost in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://localhost:3000');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://openmanager-ai.vercel.app');
  });

  it('rejects 127.0.0.1 and 0.0.0.0 in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://127.0.0.1:3000');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://0.0.0.0:8080');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://openmanager-ai.vercel.app');
  });

  it('strips pathname, search, and hash from URL', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com/some/path?query=1#hash');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://example.com');
  });

  it('adds https:// protocol if missing from candidate', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'example.com');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://example.com');
  });

  it('falls through to default when all candidates are invalid', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://localhost');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://127.0.0.1');
    vi.stubEnv('NEXT_PUBLIC_PROD_URL', 'https://0.0.0.0');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'https://vercel.com');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://openmanager-ai.vercel.app');
  });

  it('respects candidate priority order', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://first.example.com');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://second.example.com');
    vi.stubEnv('NEXT_PUBLIC_PROD_URL', 'https://third.example.com');
    const { getSiteUrl } = await loadGetSiteUrl();
    expect(getSiteUrl()).toBe('https://first.example.com');
  });
});
