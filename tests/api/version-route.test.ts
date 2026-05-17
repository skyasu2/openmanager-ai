import { beforeEach, describe, expect, it, vi } from 'vitest';
import { version as packageVersion } from '../../package.json';

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

  it('returns 200 with version, buildVersion, nextjs, environment, timestamp', async () => {
    const body = await importAndCall();

    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('buildVersion');
    expect(body).toHaveProperty('nextjs');
    expect(body).toHaveProperty('environment');
    expect(body).toHaveProperty('timestamp');
  });

  it('uses NEXT_PUBLIC_APP_VERSION when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '1.2.3');

    const body = await importAndCall();

    expect(body.version).toBe('1.2.3');
    expect(body.buildVersion).toBe(packageVersion);
    expect(body.versions).toMatchObject({
      overall: packageVersion,
      frontend: '1.2.3',
    });
  });

  it('separates overall release version from frontend implementation version', async () => {
    vi.stubEnv('APP_RELEASE_TAG', 'v1.2.4');
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '1.2.3');

    const body = await importAndCall();

    expect(body.version).toBe('1.2.3');
    expect(body.buildVersion).toBe(packageVersion);
    expect(body.releaseTag).toBe('v1.2.4');
    expect(body.versions).toEqual({
      overall: '1.2.4',
      frontend: '1.2.3',
    });
  });

  it('always exposes package buildVersion for deploy verification', async () => {
    const body = await importAndCall();

    expect(body.buildVersion).toBe(packageVersion);
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

  it('exposes deployment commit metadata from explicit app env first', async () => {
    vi.stubEnv('APP_COMMIT_SHA', 'abcdef1234567890fedcba');
    vi.stubEnv('CI_COMMIT_SHA', '11111111111111111111');

    const body = await importAndCall();

    expect(body.commitSha).toBe('abcdef1234567890fedcba');
    expect(body.shortCommitSha).toBe('abcdef1234');
  });

  it('exposes release tag and pipeline url for production traceability', async () => {
    vi.stubEnv('APP_RELEASE_TAG', 'v8.12.0');
    vi.stubEnv('CI_COMMIT_TAG', 'v8.11.99');
    vi.stubEnv('APP_PIPELINE_URL', 'https://gitlab.example/pipelines/1');

    const body = await importAndCall();

    expect(body.releaseTag).toBe('v8.12.0');
    expect(body.pipelineUrl).toBe('https://gitlab.example/pipelines/1');
    expect(body.deploymentProvider).toBe('vercel');
  });

  it("returns 'unknown' for version when no env vars are set", async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_VERSION', '');
    vi.stubEnv('npm_package_version', '');

    const body = await importAndCall();

    expect(body.version).toBe('unknown');
    expect(body.buildVersion).toBe(packageVersion);
  });
});
