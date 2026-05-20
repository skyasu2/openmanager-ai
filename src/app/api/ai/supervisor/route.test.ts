import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCheckLimit,
  mockCreateClient,
  mockGetAICache,
  mockAnalyzeQueryComplexity,
  mockIsCloudRunEnabled,
  mockHandleCloudRunJson,
  mockHandleCloudRunStream,
} = vi.hoisted(() => ({
  mockCheckLimit: vi.fn(),
  mockCreateClient: vi.fn(),
  mockGetAICache: vi.fn(),
  mockAnalyzeQueryComplexity: vi.fn(),
  mockIsCloudRunEnabled: vi.fn(),
  mockHandleCloudRunJson: vi.fn(),
  mockHandleCloudRunStream: vi.fn(),
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    aiAnalysis: {
      config: { maxRequests: 10, dailyLimit: 100 },
    },
  },
  withRateLimit:
    (_limiter: unknown, handler: (request: NextRequest) => Promise<Response>) =>
    async (request: NextRequest) => {
      const result = await mockCheckLimit(request);
      if (!result.allowed) {
        return Response.json(
          {
            error: 'Too Many Requests',
            source: 'frontend-gateway',
          },
          { status: 429 }
        );
      }
      return handler(request);
    },
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/config/guestMode.server', () => ({
  isGuestFullAccessEnabledServer: () => false,
}));

vi.mock('@/config/ai-proxy.config', () => ({
  TRACEPARENT_HEADER: 'traceparent',
  generateTraceId: () => 'trace-generated',
  getMaxTimeout: () => 60_000,
  getMinTimeout: () => 5_000,
  getObservabilityConfig: () => ({
    traceIdHeader: 'X-Trace-Id',
    verboseLogging: false,
  }),
  normalizeTraceId: (traceId: string | null) => traceId || null,
  parseTraceparentTraceId: () => null,
}));

vi.mock('@/lib/ai/cache/ai-response-cache', () => ({
  getAICache: mockGetAICache,
}));

vi.mock('@/lib/ai/fallback/ai-fallback-handler', () => ({
  createFallbackResponse: () => ({
    success: false,
    response: 'Cloud Run fallback response',
  }),
}));

vi.mock('@/lib/ai/observability', () => ({
  logAIRequest: vi.fn(),
  logAIResponse: vi.fn(),
  startAITimer: () => ({ elapsed: () => 12 }),
}));

vi.mock('@/lib/ai/utils/context-compressor', () => ({
  compressContext: vi.fn(),
  shouldCompress: () => false,
}));

vi.mock('@/lib/ai/utils/message-normalizer', () => ({
  extractLastUserQuery: (
    messages: Array<{ role?: string; content?: string }>
  ) =>
    [...messages].reverse().find((message) => message.role === 'user')?.content,
  extractTextFromHybridMessage: (message: { content?: string }) =>
    message.content ?? '',
  normalizeMessagesForCloudRun: (messages: unknown[]) => messages,
}));

vi.mock('@/lib/ai/utils/query-complexity', () => ({
  analyzeQueryComplexity: mockAnalyzeQueryComplexity,
  calculateDynamicTimeout: () => 5_000,
}));

vi.mock('@/lib/ai-proxy/proxy', () => ({
  isCloudRunEnabled: mockIsCloudRunEnabled,
}));

vi.mock('@/lib/tracing/async-context', () => ({
  runWithTraceId: (_traceId: string, fn: () => Promise<Response>) => fn(),
}));

vi.mock('./cloud-run-handler', () => ({
  handleCloudRunJson: mockHandleCloudRunJson,
  handleCloudRunStream: mockHandleCloudRunStream,
}));

vi.mock('./server-context', () => ({
  buildServerContextMessage: () => Promise.resolve(null),
}));

import { POST } from './route';

function createSupervisorRequest(
  body: unknown,
  headers?: HeadersInit
): NextRequest {
  return new NextRequest('http://localhost/api/ai/supervisor', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

function validSupervisorBody(query = '서버 상태 알려줘') {
  return {
    sessionId: 'session-12345678',
    messages: [{ role: 'user', content: query }],
  };
}

describe('/api/ai/supervisor legacy route contract', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';

    mockCheckLimit.mockResolvedValue({
      allowed: true,
      remaining: 9,
      resetTime: Date.now() + 60_000,
    });
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    });
    mockGetAICache.mockResolvedValue({ hit: false });
    mockAnalyzeQueryComplexity.mockReturnValue({
      level: 'simple',
      recommendedTimeout: 5_000,
    });
    mockIsCloudRunEnabled.mockReturnValue(false);
    mockHandleCloudRunJson.mockResolvedValue(
      Response.json({ success: true, response: 'json response' })
    );
    mockHandleCloudRunStream.mockResolvedValue(
      new Response('stream response', {
        headers: { 'Content-Type': 'text/plain' },
      })
    );
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('rate limit 초과 시 인증과 Cloud Run 호출 전에 429를 반환한다', async () => {
    mockCheckLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });

    const response = await POST(createSupervisorRequest(validSupervisorBody()));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toMatchObject({
      error: 'Too Many Requests',
      source: 'frontend-gateway',
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
    expect(mockHandleCloudRunJson).not.toHaveBeenCalled();
  });

  it('production에서 인증 없는 요청은 401을 반환한다', async () => {
    process.env.NODE_ENV = 'production';
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'No user' },
        }),
      },
    });

    const response = await POST(createSupervisorRequest(validSupervisorBody()));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Unauthorized - Please login first');
  });

  it('잘못된 payload는 400을 반환한다', async () => {
    const response = await POST(createSupervisorRequest({ messages: [] }));
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      success: false,
      error: 'Invalid request payload',
    });
  });

  it('복잡한 보고서 요청도 legacy route에서 202 job queue redirect를 반환하지 않는다', async () => {
    mockAnalyzeQueryComplexity.mockReturnValueOnce({
      level: 'very_complex',
      recommendedTimeout: 120_000,
    });
    mockIsCloudRunEnabled.mockReturnValue(true);

    const response = await POST(
      createSupervisorRequest(
        validSupervisorBody('지난 7일 장애 근본 원인 보고서 작성해줘'),
        { accept: 'application/json' }
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Redirect-Mode')).toBeNull();
    expect(payload).not.toHaveProperty('redirect');
    expect(mockHandleCloudRunJson).toHaveBeenCalledTimes(1);
  });

  it('Cloud Run 비활성화 시 legacy fallback JSON과 route contract headers를 반환한다', async () => {
    mockIsCloudRunEnabled.mockReturnValueOnce(false);

    const response = await POST(
      createSupervisorRequest(validSupervisorBody(), {
        accept: 'application/json',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: false,
      response: 'Cloud Run fallback response',
      _backend: 'fallback',
      traceId: 'trace-generated',
    });
    expect(response.headers.get('X-AI-Route-Contract')).toBe(
      'legacy-supervisor'
    );
    expect(response.headers.get('X-AI-Primary-Route')).toBe(
      '/api/ai/supervisor/stream/v2'
    );
    expect(response.headers.get('X-AI-Transport')).toBe('json');
  });

  it('application/json 요청은 Cloud Run JSON handler로 전달한다', async () => {
    mockIsCloudRunEnabled.mockReturnValueOnce(true);

    const response = await POST(
      createSupervisorRequest(validSupervisorBody(), {
        accept: 'application/json',
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, response: 'json response' });
    expect(mockHandleCloudRunJson).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-12345678',
        userQuery: '서버 상태 알려줘',
        dynamicTimeout: 5_000,
        skipCache: false,
        cacheEndpoint: 'supervisor-status',
      })
    );
    expect(mockHandleCloudRunStream).not.toHaveBeenCalled();
  });
});
