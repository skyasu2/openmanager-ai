import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/version', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function importAndCall() {
    const { GET } = await import('@/app/api/version/route');
    const response = await GET();
    return response.json();
  }

  it('returns 200 with version, nextjs, environment, timestamp', async () => {
    const body = await importAndCall();

    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('nextjs');
    expect(body).toHaveProperty('environment');
    expect(body).toHaveProperty('timestamp');
  });

  it('uses NEXT_PUBLIC_APP_VERSION when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '1.2.3');

    const body = await importAndCall();

    expect(body.version).toBe('1.2.3');
  });

  it('timestamp is a valid ISO string', async () => {
    const body = await importAndCall();

    const parsed = new Date(body.timestamp);
    expect(parsed.toISOString()).toBe(body.timestamp);
  });

  it('environment field reflects NODE_ENV', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const body = await importAndCall();

    expect(body.environment).toBe('production');
  });

  it("returns 'unknown' for version when no env vars are set", async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '');
    vi.stubEnv('npm_package_version', '');

    const body = await importAndCall();

    expect(body.version).toBe('unknown');
  });
});
