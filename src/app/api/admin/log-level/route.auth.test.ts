import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateClient,
  mockIsCloudRunEnabled,
  mockProxyToCloudRun,
  mockGetDefaultLogLevel,
  mockGetRuntimeLogLevel,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockIsCloudRunEnabled: vi.fn(),
  mockProxyToCloudRun: vi.fn(),
  mockGetDefaultLogLevel: vi.fn(),
  mockGetRuntimeLogLevel: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/ai-proxy/proxy', () => ({
  isCloudRunEnabled: mockIsCloudRunEnabled,
  proxyToCloudRun: mockProxyToCloudRun,
}));

vi.mock('@/lib/logging/runtime', () => ({
  getDefaultLogLevel: mockGetDefaultLogLevel,
  getRuntimeLogLevel: mockGetRuntimeLogLevel,
  resetToDefaultLogLevel: vi.fn(),
  setRuntimeLogLevel: vi.fn(),
}));

async function importRoute() {
  const mod = await import('./route');
  return { GET: mod.GET };
}

describe('GET /api/admin/log-level admin auth', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    process.env.NODE_ENV = 'production';
    mockIsCloudRunEnabled.mockReturnValue(false);
    mockProxyToCloudRun.mockResolvedValue({ success: false, data: null });
    mockGetRuntimeLogLevel.mockReturnValue('info');
    mockGetDefaultLogLevel.mockReturnValue('info');
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('비관리자 Supabase 사용자는 403을 반환한다', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'viewer-user',
              user_metadata: { role: 'viewer' },
              app_metadata: {},
            },
          },
          error: null,
        }),
      },
    });

    const { GET } = await importRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/admin/log-level')
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden - Admin access required');
  });

  it('관리자 Supabase 사용자는 현재 로그 레벨을 조회할 수 있다', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'admin-user',
              user_metadata: { role: 'admin' },
              app_metadata: {},
            },
          },
          error: null,
        }),
      },
    });

    const { GET } = await importRoute();
    const response = await GET(
      new NextRequest('http://localhost/api/admin/log-level')
    );
    const body = (await response.json()) as {
      vercel: { level: string; defaultLevel: string };
    };

    expect(response.status).toBe(200);
    expect(body.vercel).toEqual({ level: 'info', defaultLevel: 'info' });
  });
});
