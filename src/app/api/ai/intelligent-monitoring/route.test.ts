/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBuildAITimingHeaders,
  mockCreateFallbackResponse,
  mockExecuteWithCircuitBreakerAndFallback,
  mockGetDefaultTimeout,
  mockIsCloudRunEnabled,
  mockLogAIRequest,
  mockLogAIResponse,
  mockProxyToCloudRun,
  mockStartAITimer,
  mockWithAICache,
  capturedLimiters,
} = vi.hoisted(() => ({
  mockBuildAITimingHeaders: vi.fn(),
  mockCreateFallbackResponse: vi.fn(),
  mockExecuteWithCircuitBreakerAndFallback: vi.fn(),
  mockGetDefaultTimeout: vi.fn(),
  mockIsCloudRunEnabled: vi.fn(),
  mockLogAIRequest: vi.fn(),
  mockLogAIResponse: vi.fn(),
  mockProxyToCloudRun: vi.fn(),
  mockStartAITimer: vi.fn(),
  mockWithAICache: vi.fn(),
  capturedLimiters: [] as Array<{ config?: { maxRequests?: number } }>,
}));

vi.mock('@/config/ai-proxy.config', () => ({
  getDefaultTimeout: mockGetDefaultTimeout,
}));

vi.mock('@/lib/ai/cache/ai-response-cache', () => ({
  withAICache: mockWithAICache,
}));

vi.mock('@/lib/ai/circuit-breaker', () => ({
  executeWithCircuitBreakerAndFallback:
    mockExecuteWithCircuitBreakerAndFallback,
}));

vi.mock('@/lib/ai/fallback/ai-fallback-handler', () => ({
  createFallbackResponse: mockCreateFallbackResponse,
}));

vi.mock('@/lib/ai/observability', () => ({
  buildAITimingHeaders: mockBuildAITimingHeaders,
  logAIRequest: mockLogAIRequest,
  logAIResponse: mockLogAIResponse,
  startAITimer: mockStartAITimer,
}));

vi.mock('@/lib/ai-proxy/proxy', () => ({
  isCloudRunEnabled: mockIsCloudRunEnabled,
  proxyToCloudRun: mockProxyToCloudRun,
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    aiAnalysis: {
      config: {
        maxRequests: 10,
        dailyLimit: 100,
      },
    },
  },
  withRateLimit: (
    limiter: { config?: { maxRequests?: number } },
    handler: unknown
  ) => {
    capturedLimiters.push(limiter);
    return handler;
  },
}));

vi.mock('@/types/type-utils', () => ({
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

vi.mock('@/utils/debug', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { POST } from './route';

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/ai/intelligent-monitoring', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/ai/intelligent-monitoring POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockBuildAITimingHeaders.mockReturnValue({});
    mockCreateFallbackResponse.mockReturnValue({
      success: true,
      source: 'fallback',
    });
    mockGetDefaultTimeout.mockReturnValue(30000);
    mockIsCloudRunEnabled.mockReturnValue(true);
    mockProxyToCloudRun.mockResolvedValue({
      success: true,
      data: {
        sourceMode: 'replay-json',
        servers: [],
        riskSignals: [],
        evidenceRefs: [],
      },
    });
    mockStartAITimer.mockReturnValue({
      elapsed: () => 12,
    });

    mockExecuteWithCircuitBreakerAndFallback.mockImplementation(
      async (_serviceName: string, primaryFn: () => Promise<unknown>) => ({
        data: await primaryFn(),
        source: 'primary',
      })
    );

    mockWithAICache.mockImplementation(
      async (
        _sessionId: string,
        _query: string,
        fetcher: () => Promise<unknown>
      ) => ({
        data: await fetcher(),
        cached: false,
      })
    );
  });

  it('binds monitoring analysis to the AI analysis rate limiter', () => {
    expect(capturedLimiters[0]?.config?.maxRequests).toBe(10);
  });

  it('전체 시스템 batch 분석은 Cloud Run monitoring analyze-batch로 프록시한다', async () => {
    const response = await POST(
      createPostRequest({
        action: 'analyze_batch',
        serverId: 'all',
        analysisType: 'full',
      })
    );

    expect(response.status).toBe(200);
    expect(mockProxyToCloudRun).toHaveBeenCalledTimes(1);
    expect(mockProxyToCloudRun).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/ai/monitoring/analyze-batch',
        body: expect.objectContaining({
          action: 'analyze_batch',
          serverId: 'all',
          analysisType: 'full',
        }),
      })
    );
  });

  it('cache key에 sourceMode와 queryAsOf slot을 포함해 슬롯/소스 오염을 막는다', async () => {
    await POST(
      createPostRequest({
        action: 'analyze_batch',
        serverId: 'all',
        analysisType: 'full',
        sourceMode: 'replay-json',
        queryAsOf: {
          createdAt: '2026-04-30T00:00:00.000Z',
          source: 'vercel-static-otel',
          datasetVersion: '24h-rotating-v1.0.0',
          dataSlot: {
            slotIndex: 42,
            minuteOfDay: 420,
            timeLabel: '07:00 KST',
          },
        },
      })
    );

    expect(mockWithAICache).toHaveBeenCalledWith(
      'monitoring_all',
      expect.stringContaining('sourceMode=replay-json'),
      expect.any(Function),
      'intelligent-monitoring'
    );
    expect(mockWithAICache).toHaveBeenCalledWith(
      'monitoring_all',
      expect.stringContaining('slot=42'),
      expect.any(Function),
      'intelligent-monitoring'
    );
  });

  it('Cloud Run monitoring source 오류를 fallback으로 숨기지 않고 그대로 반환한다', async () => {
    const errorPayload = {
      success: false,
      error: 'Live OTel monitoring source is disabled.',
      code: 'LIVE_SOURCE_DISABLED',
      sourceMode: 'live-otel',
      queryAsOf: '2026-04-30T00:00:00.000Z',
      requestId: 'req-live-disabled',
      recoverable: true,
    };
    mockProxyToCloudRun.mockResolvedValueOnce({
      success: false,
      status: 503,
      error: errorPayload.error,
      errorData: errorPayload,
    });

    const response = await POST(
      createPostRequest({
        action: 'analyze_batch',
        serverId: 'all',
        analysisType: 'full',
        sourceMode: 'live-otel',
        queryAsOf: {
          createdAt: '2026-04-30T00:00:00.000Z',
          source: 'vercel-static-otel',
          datasetVersion: '24h-rotating-v1.0.0',
          dataSlot: {
            slotIndex: 42,
            minuteOfDay: 420,
            timeLabel: '07:00 KST',
          },
        },
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject(errorPayload);
    expect(mockCreateFallbackResponse).not.toHaveBeenCalled();
  });
});
