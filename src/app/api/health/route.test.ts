/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckCloudRunHealth } = vi.hoisted(() => ({
  mockCheckCloudRunHealth: vi.fn(),
}));

vi.mock('@/lib/ai-proxy/proxy', () => ({
  checkCloudRunHealth: mockCheckCloudRunHealth,
}));

vi.mock('@/lib/api/zod-middleware', () => ({
  createApiRoute: () => ({
    response: () => ({
      configure: () => ({
        build: (handler: unknown) => handler,
      }),
    }),
  }),
}));

vi.mock('@/lib/cache/unified-cache', () => ({
  getCacheStats: () => ({ size: 0, maxSize: 100, hitRate: 0 }),
}));

vi.mock('@/lib/site-url', () => ({
  getSiteUrl: () => 'http://localhost:3000',
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/session-probe', () => ({
  probeSupabaseSession: vi.fn(),
}));

vi.mock('@/services/metrics/kst-time', () => ({
  getKSTDateTime: () => ({
    slotIndex: 42,
    minuteOfDay: 420,
  }),
}));

vi.mock('@/utils/debug', () => ({
  default: {
    error: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

import { GET } from './route';

function createHealthRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('/api/health service-specific AI health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps hard health-check failures as HTTP 503 by default', async () => {
    mockCheckCloudRunHealth.mockResolvedValueOnce({
      healthy: false,
      latency: 321,
      error: 'Cloud Run is not enabled',
    });

    const response = await GET(
      createHealthRequest('http://localhost/api/health?service=ai')
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: 'error',
      healthy: false,
      backend: 'cloud-run',
      error: 'Cloud Run is not enabled',
    });
  });

  it('returns HTTP 200 degraded for soft UI health polling failures', async () => {
    mockCheckCloudRunHealth.mockResolvedValueOnce({
      healthy: false,
      latency: 321,
      error: 'Cloud Run is not enabled',
      reasonCode: 'cloud_run_disabled',
      recoverable: false,
    });

    const response = await GET(
      createHealthRequest('http://localhost/api/health?service=ai&soft=true')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'degraded',
      healthy: false,
      backend: 'cloud-run',
      error: 'Cloud Run is not enabled',
      latency: 321,
      reasonCode: 'cloud_run_disabled',
      recoverable: false,
    });
  });

  it('keeps cold-start timeout metadata observable on soft health polling', async () => {
    mockCheckCloudRunHealth.mockResolvedValueOnce({
      healthy: false,
      latency: 5001,
      error: 'Cloud Run health check timeout (>5000ms) - possible cold start',
      reasonCode: 'cloud_run_health_timeout',
      recoverable: true,
    });

    const response = await GET(
      createHealthRequest('http://localhost/api/health?service=ai&soft=true')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'degraded',
      healthy: false,
      backend: 'cloud-run',
      latency: 5001,
      error: 'Cloud Run health check timeout (>5000ms) - possible cold start',
      reasonCode: 'cloud_run_health_timeout',
      recoverable: true,
    });
  });

  it('returns ok when Cloud Run health succeeds', async () => {
    mockCheckCloudRunHealth.mockResolvedValueOnce({
      healthy: true,
      latency: 45,
    });

    const response = await GET(
      createHealthRequest('http://localhost/api/health?service=ai&soft=true')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: 'ok',
      healthy: true,
      backend: 'cloud-run',
      latency: 45,
    });
  });
});
