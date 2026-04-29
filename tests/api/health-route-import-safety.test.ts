import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function mockHealthRouteDependencies(
  cloudRunHealth = { healthy: true, latency: 120 }
) {
  const mockCheckCloudRunHealth = vi.fn().mockResolvedValue(cloudRunHealth);

  vi.doMock('@/env', () => {
    throw new Error('strict env module should not load for health route');
  });
  vi.doMock('@/lib/ai-proxy/proxy', () => ({
    checkCloudRunHealth: mockCheckCloudRunHealth,
  }));
  vi.doMock('@/lib/cache/unified-cache', () => ({
    getCacheStats: vi.fn(() => ({ size: 0, maxSize: 1000, hitRate: 0 })),
  }));
  vi.doMock('@/lib/site-url', () => ({
    getSiteUrl: vi.fn(() => 'http://localhost:3000'),
  }));
  vi.doMock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
  }));
  vi.doMock('@/lib/supabase/session-probe', () => ({
    probeSupabaseSession: vi.fn(),
  }));
  vi.doMock('@/lib/api/zod-middleware', () => ({
    createApiRoute: () => {
      const builder = {
        response: () => builder,
        configure: () => builder,
        build: (callback: (...args: never) => unknown) => {
          return async (request: Request) => {
            const result = await callback(request, {});
            return new Response(
              JSON.stringify({
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
              }),
              {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          };
        },
      };
      return builder;
    },
  }));
  vi.doMock('@/schemas/api.schema', () => ({
    HealthCheckResponseSchema: {
      safeParse: vi.fn(() => ({ success: true })),
    },
  }));
  vi.doMock('@/utils/debug', () => ({
    default: {
      error: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
      warn: vi.fn(),
    },
  }));

  return { mockCheckCloudRunHealth };
}

describe('Health route import safety', () => {
  afterEach(() => {
    vi.doUnmock('@/env');
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('serves simple ping without loading strict env config', async () => {
    mockHealthRouteDependencies();

    const { GET } = await import('@/app/api/health/route');
    const response = await GET(
      new NextRequest('http://localhost/api/health?simple=true')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ping: 'pong' });
  });

  it('serves Cloud Run health without loading strict env config', async () => {
    const { mockCheckCloudRunHealth } = mockHealthRouteDependencies({
      healthy: true,
      latency: 88,
    });

    const { GET } = await import('@/app/api/health/route');
    const response = await GET(
      new NextRequest('http://localhost/api/health?service=ai')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ok',
      backend: 'cloud-run',
      latency: 88,
    });
    expect(mockCheckCloudRunHealth).toHaveBeenCalledTimes(1);
  });
});
