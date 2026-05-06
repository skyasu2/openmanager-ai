import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExecuteWithCircuitBreakerAndFallback,
  mockProxyToCloudRun,
  mockSetAICache,
  mockCreateFallbackResponse,
  mockGetObservabilityConfig,
  mockGetTraceId,
} = vi.hoisted(() => ({
  mockExecuteWithCircuitBreakerAndFallback: vi.fn(),
  mockProxyToCloudRun: vi.fn(),
  mockSetAICache: vi.fn(() => Promise.resolve()),
  mockCreateFallbackResponse: vi.fn(() => ({
    success: false,
    message: 'fallback response',
    data: { response: 'fallback response' },
  })),
  mockGetObservabilityConfig: vi.fn(() => ({
    enableTraceId: false,
    traceIdHeader: 'x-trace-id',
    verboseLogging: false,
  })),
  mockGetTraceId: vi.fn(() => 'trace-123'),
}));

vi.mock('@/config/ai-proxy.config', () => ({
  generateTraceId: vi.fn(() => 'trace-123'),
  generateTraceparent: vi.fn(() => '00-trace-123-span-01'),
  getObservabilityConfig: mockGetObservabilityConfig,
  TRACEPARENT_HEADER: 'traceparent',
}));

vi.mock('@/lib/ai/cache/ai-response-cache', () => ({
  setAICache: mockSetAICache,
}));

vi.mock('@/lib/ai/circuit-breaker', () => ({
  executeWithCircuitBreakerAndFallback:
    mockExecuteWithCircuitBreakerAndFallback,
}));

vi.mock('@/lib/ai/fallback/ai-fallback-handler', () => ({
  createFallbackResponse: mockCreateFallbackResponse,
}));

vi.mock('@/lib/ai-proxy/proxy', () => ({
  proxyToCloudRun: mockProxyToCloudRun,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/tracing/async-context', () => ({
  getTraceId: mockGetTraceId,
}));

import { handleCloudRunJson, handleCloudRunStream } from './cloud-run-handler';

const defaultParams = {
  messagesToSend: [{ role: 'user' as const, content: '서버 상태 알려줘' }],
  sessionId: 'session-1234',
  cacheSessionId: 'owner-session-1234',
  userQuery: '서버 상태 알려줘',
  dynamicTimeout: 15_000,
  skipCache: true,
  cacheEndpoint: 'supervisor' as const,
};

describe('legacy supervisor route contract headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteWithCircuitBreakerAndFallback.mockImplementation(
      async (
        _key: string,
        primary: () => Promise<unknown>,
        _fallback: () => unknown
      ) => ({
        source: 'primary',
        data: await primary(),
      })
    );
    mockProxyToCloudRun.mockResolvedValue({
      success: true,
      data: {
        success: true,
        response: '정상 응답',
      },
    });
  });

  it('json mode 응답에 legacy contract와 primary route hint를 포함한다', async () => {
    const response = await handleCloudRunJson(defaultParams);

    expect(response.headers.get('X-AI-Route-Contract')).toBe(
      'legacy-supervisor'
    );
    expect(response.headers.get('X-AI-Primary-Route')).toBe(
      '/api/ai/supervisor/stream/v2'
    );
    expect(response.headers.get('X-AI-Transport')).toBe('json');
  });

  it('text mode 응답에 legacy contract와 primary route hint를 포함한다', async () => {
    const response = await handleCloudRunStream(defaultParams);

    expect(response.headers.get('X-AI-Route-Contract')).toBe(
      'legacy-supervisor'
    );
    expect(response.headers.get('X-AI-Primary-Route')).toBe(
      '/api/ai/supervisor/stream/v2'
    );
    expect(response.headers.get('X-AI-Transport')).toBe('text');
  });

  it('forwards rate-limit identity to Cloud Run proxy when provided', async () => {
    await handleCloudRunJson({
      ...defaultParams,
      rateLimitIdentity: 'guest:abc123',
    });

    expect(mockProxyToCloudRun).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Rate-Limit-Identity': 'guest:abc123',
        }),
      })
    );
  });

  it('forwards internal disclosure mode only from trusted server-side auth context', async () => {
    await handleCloudRunJson({
      ...defaultParams,
      internalDisclosureMode: 'developer',
    });

    expect(mockProxyToCloudRun).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          internalDisclosureMode: 'developer',
        }),
      })
    );
  });
});
