import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockIsCloudRunEnabled,
  mockProxyToCloudRun,
  mockGetDefaultLogLevel,
  mockGetRuntimeLogLevel,
  mockResetToDefaultLogLevel,
  mockSetRuntimeLogLevel,
} = vi.hoisted(() => ({
  mockIsCloudRunEnabled: vi.fn(),
  mockProxyToCloudRun: vi.fn(),
  mockGetDefaultLogLevel: vi.fn(),
  mockGetRuntimeLogLevel: vi.fn(),
  mockResetToDefaultLogLevel: vi.fn(),
  mockSetRuntimeLogLevel: vi.fn(),
}));

vi.mock('@/lib/ai-proxy/proxy', () => ({
  isCloudRunEnabled: mockIsCloudRunEnabled,
  proxyToCloudRun: mockProxyToCloudRun,
}));

vi.mock('@/lib/logging/runtime', () => ({
  getDefaultLogLevel: mockGetDefaultLogLevel,
  getRuntimeLogLevel: mockGetRuntimeLogLevel,
  resetToDefaultLogLevel: mockResetToDefaultLogLevel,
  setRuntimeLogLevel: mockSetRuntimeLogLevel,
}));

import { GET, PUT } from './route';

describe('GET /api/admin/log-level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeLogLevel.mockReturnValue('info');
    mockGetDefaultLogLevel.mockReturnValue('info');
    mockIsCloudRunEnabled.mockReturnValue(false);
    mockProxyToCloudRun.mockResolvedValue({ success: false, data: null });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('현재 Vercel 레벨과 기본 레벨, Cloud Run 상태를 반환한다', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/log-level')
    );
    const body = (await response.json()) as {
      vercel: { level: string; defaultLevel: string };
      cloudRun: { level: string; reachable: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.vercel).toEqual({ level: 'info', defaultLevel: 'info' });
    expect(body.cloudRun).toEqual({ level: 'unknown', reachable: false });
  });

  it('Cloud Run이 비활성화되면 cloudRun 상태는 도달 불가로 처리한다', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/log-level')
    );
    const body = await response.json();

    expect(mockIsCloudRunEnabled).toHaveBeenCalledTimes(1);
    expect(body.cloudRun).toEqual({ level: 'unknown', reachable: false });
  });
});

describe('PUT /api/admin/log-level', () => {
  const resetEndpointPayload = { level: 'reset', target: 'all' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRuntimeLogLevel.mockReturnValue('warn');
    mockGetDefaultLogLevel.mockReturnValue('warn');
    mockIsCloudRunEnabled.mockReturnValue(true);
    mockProxyToCloudRun.mockResolvedValue({
      success: true,
      data: { currentLevel: 'warn' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('reset 요청은 Vercel에서 기본 레벨로 즉시 복원한다', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/admin/log-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetEndpointPayload),
      })
    );
    const body = (await response.json()) as {
      applied: { vercel?: string; cloudRun?: string };
      expiresAt: string | null;
    };

    expect(response.status).toBe(200);
    expect(mockResetToDefaultLogLevel).toHaveBeenCalledTimes(1);
    expect(mockSetRuntimeLogLevel).not.toHaveBeenCalled();
    expect(mockProxyToCloudRun).toHaveBeenCalledWith({
      path: '/debug/log-level',
      method: 'PUT',
      body: { level: 'reset', ttlSeconds: undefined },
      timeout: 5000,
    });
    expect(body.applied.vercel).toBe('warn');
    expect(body.applied.cloudRun).toBe('warn');
    expect(body.expiresAt).toBeNull();
  });

  it('cloud-run 단독 타깃에서도 ttlSeconds의 만료 시점을 반영한다', async () => {
    const expectedExpiresAt = new Date(Date.now() + 120_000).toISOString();
    mockProxyToCloudRun.mockResolvedValueOnce({
      success: true,
      data: {
        currentLevel: 'debug',
        expiresAt: expectedExpiresAt,
      },
    });

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/log-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'debug',
          target: 'cloud-run',
          ttlSeconds: 120,
        }),
      })
    );

    const body = (await response.json()) as {
      applied: { vercel?: string; cloudRun?: string };
      expiresAt: string | null;
    };

    expect(response.status).toBe(200);
    expect(mockSetRuntimeLogLevel).not.toHaveBeenCalled();
    expect(mockProxyToCloudRun).toHaveBeenCalledWith({
      path: '/debug/log-level',
      method: 'PUT',
      body: { level: 'debug', ttlSeconds: 120 },
      timeout: 5000,
    });
    expect(body.applied.cloudRun).toBe('debug');
    expect(body.expiresAt).toBe(expectedExpiresAt);
  });

  it('유효하지 않은 레벨은 400을 반환한다', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/admin/log-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: 'trace', target: 'all' }),
      })
    );
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('Invalid level');
    expect(mockResetToDefaultLogLevel).not.toHaveBeenCalled();
  });

  it('reset 요청에 ttlSeconds가 있어도 expiresAt를 계산하지 않는다', async () => {
    const response = await PUT(
      new NextRequest('http://localhost/api/admin/log-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'reset',
          target: 'all',
          ttlSeconds: 120,
        }),
      })
    );
    const body = (await response.json()) as {
      applied: { vercel?: string; cloudRun?: string };
      expiresAt: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.expiresAt).toBeNull();
  });
});
