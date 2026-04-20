/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateClient,
  mockGetRequiredCloudRunConfig,
  mockCheckLimit,
  mockLoggerInfo,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockGetRequiredCloudRunConfig: vi.fn(),
  mockCheckLimit: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/config/guestMode.server', () => ({
  isGuestFullAccessEnabledServer: () => false,
}));

vi.mock('@/lib/ai-proxy/cloud-run-config', () => ({
  getRequiredCloudRunConfig: mockGetRequiredCloudRunConfig,
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    dataGenerator: {
      checkLimit: mockCheckLimit,
    },
  },
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
  },
}));

async function importRoute() {
  const mod = await import('./route');
  return { POST: mod.POST };
}

describe('POST /api/ai/wake-up auth', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    mockCheckLimit.mockResolvedValue({
      allowed: true,
      remainingRequests: 9,
      resetTime: Date.now() + 60_000,
    });
    mockGetRequiredCloudRunConfig.mockReturnValue({
      ok: false,
      code: 'missing_url',
      message: 'CLOUD_RUN_AI_URL is not configured',
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('미인증 요청은 401을 반환한다', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'No user' },
        }),
      },
    });

    const { POST } = await importRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/ai/wake-up', { method: 'POST' })
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized - Please login first');
    expect(mockCheckLimit).not.toHaveBeenCalled();
  });

  it('인증된 요청은 기존 warmup handler로 진입할 수 있다', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'supabase-user-1',
            },
          },
          error: null,
        }),
      },
    });

    const { POST } = await importRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/ai/wake-up', {
        method: 'POST',
        headers: { 'x-ai-warmup-source': 'test-suite' },
      })
    );

    expect(response.status).toBe(204);
    expect(mockCheckLimit).toHaveBeenCalledTimes(1);
  });
});
