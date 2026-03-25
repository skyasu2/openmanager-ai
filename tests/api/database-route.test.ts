import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreateClient, mockGetSupabaseServerUrl } = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetSupabaseServerUrl: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/supabase/env', () => ({
  getSupabaseServerUrl: mockGetSupabaseServerUrl,
}));

vi.mock('@/types/type-utils', () => ({
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : 'Unknown error',
}));

async function importRoute() {
  const mod = await import('@/app/api/database/route');
  return { GET: mod.GET, POST: mod.POST };
}

describe('Database Route Contract (/api/database)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockGetSupabaseServerUrl.mockReturnValue(
      'https://test-project.supabase.co'
    );
    mockCreateClient.mockResolvedValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    });
  });

  it('GET 요청 시 온라인 상태와 호스트 정보를 반환한다', async () => {
    const { GET } = await importRoute();

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      healthy: boolean;
      primary: { status: string; host: string };
    };

    expect(payload.healthy).toBe(true);
    expect(payload.primary.status).toBe('online');
    expect(payload.primary.host).toBe('test-project.supabase.co');
  });

  it('세션 프로브가 타임아웃되면 503과 timeout 메시지를 반환한다', async () => {
    vi.useFakeTimers();

    try {
      mockCreateClient.mockResolvedValue({
        auth: {
          getSession: vi.fn(() => new Promise(() => {})),
        },
      });

      const { GET } = await importRoute();
      const responsePromise = GET();

      await vi.advanceTimersByTimeAsync(3000);

      const response = await responsePromise;
      expect(response.status).toBe(503);

      const payload = (await response.json()) as {
        healthy: boolean;
        message?: string;
      };

      expect(payload.healthy).toBe(false);
      expect(payload.message).toBe('Database check timeout');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reset_pool 액션은 자동 관리 메시지를 반환한다', async () => {
    const { POST } = await importRoute();
    const request = new NextRequest('http://localhost/api/database', {
      method: 'POST',
      body: JSON.stringify({ action: 'reset_pool' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      success: boolean;
      message: string;
    };

    expect(payload.success).toBe(true);
    expect(payload.message).toContain('managed automatically');
  });
});
