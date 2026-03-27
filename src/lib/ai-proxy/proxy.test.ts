import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: mockLogger,
}));

describe('ai-proxy runtime config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function loadProxy() {
    return import('./proxy');
  }

  it('reflects Cloud Run env changes without module reload', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('CLOUD_RUN_ENABLED', 'true');
    vi.stubEnv('CLOUD_RUN_AI_URL', 'https://first.run.app');
    vi.stubEnv('CLOUD_RUN_API_SECRET', 'first-secret');

    const { getCloudRunUrl, isCloudRunEnabled, proxyToCloudRun } =
      await loadProxy();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(isCloudRunEnabled()).toBe(true);
    expect(getCloudRunUrl()).toBe('https://first.run.app');

    await proxyToCloudRun({
      path: '/api/test',
      method: 'POST',
      body: { q: 1 },
    });

    vi.stubEnv('CLOUD_RUN_AI_URL', 'https://second.run.app');
    vi.stubEnv('CLOUD_RUN_API_SECRET', 'second-secret');

    expect(isCloudRunEnabled()).toBe(true);
    expect(getCloudRunUrl()).toBe('https://second.run.app');

    await proxyToCloudRun({
      path: '/api/test',
      method: 'POST',
      body: { q: 2 },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://first.run.app/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'first-secret',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://second.run.app/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'second-secret',
        }),
      })
    );
  });

  it('reflects local Docker env changes without module reload', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('AI_ENGINE_MODE', 'AUTO');
    vi.stubEnv('USE_LOCAL_DOCKER', 'true');
    vi.stubEnv('LOCAL_DOCKER_URL', 'http://localhost:8081');
    vi.stubEnv('LOCAL_DOCKER_SECRET', 'docker-secret-1');

    const { getCloudRunUrl, isCloudRunEnabled, proxyToCloudRun } =
      await loadProxy();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(isCloudRunEnabled()).toBe(true);
    expect(getCloudRunUrl()).toBe('http://localhost:8081');

    await proxyToCloudRun({ path: '/health', method: 'GET' });

    vi.stubEnv('LOCAL_DOCKER_URL', 'http://localhost:9090');
    vi.stubEnv('LOCAL_DOCKER_SECRET', 'docker-secret-2');

    expect(isCloudRunEnabled()).toBe(true);
    expect(getCloudRunUrl()).toBe('http://localhost:9090');

    await proxyToCloudRun({ path: '/health', method: 'GET' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8081/health',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'docker-secret-1',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:9090/health',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': 'docker-secret-2',
        }),
      })
    );
  });

  it('dedupes config logs within one process and can reset between tests', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('AI_ENGINE_MODE', 'AUTO');
    vi.stubEnv('USE_LOCAL_DOCKER', 'true');
    vi.stubEnv('LOCAL_DOCKER_URL', 'http://localhost:8081');
    vi.stubEnv('LOCAL_DOCKER_SECRET', 'docker-secret');

    const { isCloudRunEnabled, resetConfigCache } = await loadProxy();

    expect(isCloudRunEnabled()).toBe(true);
    expect(isCloudRunEnabled()).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledTimes(1);

    resetConfigCache();

    expect(isCloudRunEnabled()).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledTimes(2);
  });
});
