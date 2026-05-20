import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetActiveStreamId,
  mockClearActiveStreamId,
  mockSaveActiveStreamId,
  mockResumeExistingStream,
  mockCreateNewResumableStream,
  mockClearStream,
  mockExtractLastUserQuery,
  mockExtractTextFromHybridMessage,
  mockNormalizeMessagesForCloudRun,
  mockSecurityCheck,
  mockGetMaxTimeout,
  mockFetch,
  mockGetAPIAuthContext,
  mockGetRouteMaxExecutionMs,
  mockGetFunctionTimeoutReserveMs,
  mockExecuteWithCircuitBreakerAndFallback,
} = vi.hoisted(() => ({
  mockGetActiveStreamId: vi.fn(),
  mockClearActiveStreamId: vi.fn(),
  mockSaveActiveStreamId: vi.fn(),
  mockResumeExistingStream: vi.fn(),
  mockCreateNewResumableStream: vi.fn(),
  mockClearStream: vi.fn(),
  mockExtractLastUserQuery: vi.fn(),
  mockExtractTextFromHybridMessage: vi.fn(),
  mockNormalizeMessagesForCloudRun: vi.fn(),
  mockSecurityCheck: vi.fn(),
  mockGetMaxTimeout: vi.fn(),
  mockFetch: vi.fn(),
  mockGetAPIAuthContext: vi.fn(() => null),
  mockGetRouteMaxExecutionMs: vi.fn(),
  mockGetFunctionTimeoutReserveMs: vi.fn(),
  mockExecuteWithCircuitBreakerAndFallback: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
  getAPIAuthContext: mockGetAPIAuthContext,
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  rateLimiters: {
    aiAnalysis: {},
  },
  withRateLimit: (_limiter: unknown, handler: unknown) => handler,
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createModuleLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@/lib/ai/utils/message-normalizer', () => ({
  extractLastUserQuery: mockExtractLastUserQuery,
  extractTextFromHybridMessage: mockExtractTextFromHybridMessage,
  normalizeMessagesForCloudRun: mockNormalizeMessagesForCloudRun,
}));

vi.mock('../../security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../security')>();
  return {
    ...actual,
    securityCheck: mockSecurityCheck,
  };
});

vi.mock('@/config/ai-proxy.config', () => ({
  getMaxTimeout: mockGetMaxTimeout,
  getRouteMaxExecutionMs: mockGetRouteMaxExecutionMs,
  getFunctionTimeoutReserveMs: mockGetFunctionTimeoutReserveMs,
}));

vi.mock('@/lib/ai/circuit-breaker', () => ({
  executeWithCircuitBreakerAndFallback:
    mockExecuteWithCircuitBreakerAndFallback,
}));

import { GET, POST } from './route';

function createSseStream(
  payload = 'data: test\n\n'
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

async function readSseEvents(response: Response) {
  const raw = await response.text();
  return raw
    .split('\n\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)));
}

describe('Supervisor Stream V2 Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);

    mockExtractLastUserQuery.mockReturnValue('서버 상태 알려줘');
    mockExtractTextFromHybridMessage.mockImplementation(
      (message: {
        content?: string;
        parts?: Array<{ type?: string; text?: string }>;
      }) =>
        message.content ??
        message.parts
          ?.filter(
            (part) => part?.type === 'text' && typeof part.text === 'string'
          )
          .map((part) => part.text)
          .join('\n') ??
        ''
    );
    mockNormalizeMessagesForCloudRun.mockImplementation((messages) => messages);
    mockSecurityCheck.mockReturnValue({
      shouldBlock: false,
      sanitizedInput: '서버 상태 알려줘',
      inputCheck: { patterns: [] },
    });
    mockGetAPIAuthContext.mockReturnValue(null);
    mockGetRouteMaxExecutionMs.mockReturnValue(60_000);
    mockGetFunctionTimeoutReserveMs.mockReturnValue(1_500);
    mockGetMaxTimeout.mockReturnValue(1000);
    mockExecuteWithCircuitBreakerAndFallback.mockImplementation(
      async (
        _serviceName: string,
        primaryFn: () => Promise<unknown>,
        fallbackFn: () => Promise<unknown> | unknown
      ) => {
        try {
          return {
            data: await primaryFn(),
            source: 'primary',
          };
        } catch (error) {
          return {
            data: await fallbackFn(),
            source: 'fallback',
            originalError: error instanceof Error ? error : new Error('error'),
          };
        }
      }
    );
    mockFetch.mockResolvedValue(
      new Response(createSseStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    mockCreateNewResumableStream.mockResolvedValue(createSseStream());
    mockGetActiveStreamId.mockResolvedValue(null);

    process.env.CLOUD_RUN_ENABLED = 'true';
    process.env.CLOUD_RUN_AI_URL = 'https://example-ai.run.app';
    process.env.CLOUD_RUN_API_SECRET = 'test-secret';
    delete process.env.AI_RESUMABLE_STREAMS_ENABLED;
  });

  describe('GET /resume disabled contract', () => {
    it('GET은 Redis resume을 수행하지 않고 405를 반환해야 함', async () => {
      process.env.AI_RESUMABLE_STREAMS_ENABLED = 'true';
      mockGetActiveStreamId.mockResolvedValue('stream-abc');

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2?sessionId=session-1234&skip=2'
      );

      const response = await GET(request);
      const payload = (await response.json()) as { error: string };

      expect(response.status).toBe(405);
      expect(payload.error).toBe('Stream resume is not supported');
      expect(response.headers.get('Allow')).toBe('POST');
      expect(mockGetActiveStreamId).not.toHaveBeenCalled();
      expect(mockResumeExistingStream).not.toHaveBeenCalled();
      expect(mockClearActiveStreamId).not.toHaveBeenCalled();
    });

    it('유효하지 않은 resume query도 validation 전에 405로 종료해야 함', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2?sessionId=short&skip=-1'
      );

      const response = await GET(request);
      const payload = (await response.json()) as { error: string };

      expect(response.status).toBe(405);
      expect(payload.error).toBe('Stream resume is not supported');
      expect(mockGetActiveStreamId).not.toHaveBeenCalled();
    });
  });

  describe('POST /stream', () => {
    it('마지막 사용자 쿼리가 비어있으면 400을 반환해야 함', async () => {
      mockExtractLastUserQuery.mockReturnValue('   ');

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'test' }],
            sessionId: 'session-1234',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: 'Empty query',
      });
    });

    it('CLOUD_RUN_AI_URL이 없으면 503을 반환해야 함', async () => {
      delete process.env.CLOUD_RUN_AI_URL;

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            sessionId: 'session-1234',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: 'Streaming not available',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('CLOUD_RUN_API_SECRET이 없으면 503을 반환해야 함', async () => {
      delete process.env.CLOUD_RUN_API_SECRET;

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            sessionId: 'session-1234',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: 'Streaming not available',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('CLOUD_RUN_ENABLED=false면 503을 반환해야 함', async () => {
      process.env.CLOUD_RUN_ENABLED = 'false';

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            sessionId: 'session-1234',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: 'Streaming not available',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('resumable stream이 기본 비활성화 상태이면 pass-through 응답을 반환해야 함', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(createSseStream(), {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'X-AI-Latency-Ms': '1987',
          },
        })
      );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
            'X-Device-Type': 'mobile',
            cookie: 'auth_session_id=guest-session-xyz',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            enableWebSearch: true,
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
      expect(response.headers.get('X-Resumable')).toBe('false');
      expect(response.headers.get('X-Session-Id')).toBe('session-1234');
      expect(response.headers.get('X-AI-Mode')).toBe('streaming');
      expect(response.headers.get('X-AI-Source')).toBe('cloud-run');
      expect(response.headers.get('X-AI-Cache-Status')).toBe('BYPASS');
      expect(response.headers.get('X-AI-Latency-Ms')).toMatch(/^\d+$/);
      expect(response.headers.get('X-AI-Processing-Ms')).toBe('1987');
      expect(response.headers.get('Server-Timing')).toContain('ai;dur=');
      expect(response.headers.get('Server-Timing')).toContain(
        'ai_processing;dur=1987'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0]?.[0]).toBe(
        'https://example-ai.run.app/api/ai/supervisor/stream/v2'
      );

      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body).toMatchObject({
        sessionId: 'session-1234',
        deviceType: 'mobile',
        enableWebSearch: true,
      });
      expect(
        (fetchOptions.headers as Record<string, string>)[
          'X-Rate-Limit-Identity'
        ]
      ).toMatch(/^guest:/);

      expect(mockSaveActiveStreamId).not.toHaveBeenCalled();
      expect(mockCreateNewResumableStream).not.toHaveBeenCalled();
    });

    it('pass-through Cloud Run stream 출력은 클라이언트 반환 전에 필터링해야 함', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(createSseStream('data: <script>alert(1)</script>\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe('data: [removed]\n\n');
    });

    it('AI_RESUMABLE_STREAMS_ENABLED=true여도 Redis resumable 저장을 사용하지 않아야 함', async () => {
      process.env.AI_RESUMABLE_STREAMS_ENABLED = 'true';
      mockFetch.mockResolvedValueOnce(
        new Response(createSseStream(), {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'X-AI-Latency-Ms': '1987',
          },
        })
      );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
            'X-Device-Type': 'mobile',
            cookie: 'auth_session_id=guest-session-xyz',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            enableWebSearch: true,
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
      expect(response.headers.get('X-Resumable')).toBe('false');
      expect(response.headers.get('X-Session-Id')).toBe('session-1234');
      expect(response.headers.get('X-AI-Mode')).toBe('streaming');
      expect(response.headers.get('X-AI-Source')).toBe('cloud-run');
      expect(mockSaveActiveStreamId).not.toHaveBeenCalled();
      expect(mockCreateNewResumableStream).not.toHaveBeenCalled();
    });

    it('AI_RESUMABLE_STREAMS_ENABLED=true여도 pass-through stream을 필터링해야 함', async () => {
      process.env.AI_RESUMABLE_STREAMS_ENABLED = 'true';
      mockFetch.mockResolvedValueOnce(
        new Response(createSseStream('data: <script>alert(1)</script>\n\n'), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        })
      );
      mockCreateNewResumableStream.mockImplementationOnce(
        async (
          _streamId: string,
          makeStream: () => ReadableStream<Uint8Array>
        ) => makeStream()
      );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockSaveActiveStreamId).not.toHaveBeenCalled();
      expect(mockCreateNewResumableStream).not.toHaveBeenCalled();
      await expect(response.text()).resolves.toBe('data: [removed]\n\n');
    });

    it('유효하지 않은 X-Device-Type은 desktop으로 정규화해야 함', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
            'X-Device-Type': 'tablet',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body.deviceType).toBe('desktop');
    });

    it('유효하지 않은 헤더 sessionId는 fallback sessionId로 대체해야 함', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'short',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body)) as {
        sessionId: string;
      };

      expect(body.sessionId).toMatch(/^session-/);
      expect(body.sessionId).not.toBe('short');
    });

    it('enableRAG 값도 Cloud Run으로 전달해야 함', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'RAG 테스트' }],
            enableRAG: true,
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body).toMatchObject({
        sessionId: 'session-1234',
        enableRAG: true,
      });
    });

    it('semantic intent metadata와 trace를 Cloud Run으로 전달해야 함', async () => {
      const metadata = {
        intentFrame: {
          domainId: 'openmanager-monitoring',
          intent: 'metric_peak',
          capabilityId: 'monitoring.metric_peak',
          scope: 'whole_fleet',
          targets: [],
          metric: 'load1',
          timeWindow: '24h',
          aggregation: 'peak',
          ambiguity: 'low',
          executionMode: 'single',
          confidence: 0.91,
        },
      };
      const semanticQueryTrace = {
        originalQuery: '최근 24시간 load1 피크 알려줘',
        selectedDomain: 'openmanager-monitoring',
        selectedCapability: 'monitoring.metric_peak',
        evidenceAvailable: false,
        clarificationRequired: false,
        reasonCodes: [],
      };

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [
              { role: 'user', content: '최근 24시간 load1 피크 알려줘' },
            ],
            metadata,
            semanticQueryTrace,
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body).toMatchObject({
        sessionId: 'session-1234',
        metadata,
        semanticQueryTrace,
      });
    });

    it('PIN guest auth context이면 Cloud Run에 developer disclosure mode를 서버 측에서만 전달한다', async () => {
      mockGetAPIAuthContext.mockReturnValue({
        authType: 'guest',
        userId: 'issued-guest-session-id',
      });

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: 'OpenManager 내부 자료 경로 알려줘',
              },
            ],
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body).toMatchObject({
        sessionId: 'session-1234',
        internalDisclosureMode: 'developer',
      });
    });

    it('test-secret auth context이면 Cloud Run에 developer disclosure mode를 전달한다', async () => {
      mockGetAPIAuthContext.mockReturnValue({
        authType: 'test-secret',
      });

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: 'OpenManager 내부 자료 경로 알려줘',
              },
            ],
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body).toMatchObject({
        sessionId: 'session-1234',
        internalDisclosureMode: 'developer',
      });
    });

    it('developer disclosure mode이면 첫 스트림 이벤트로 developer-context를 노출한다', async () => {
      mockGetAPIAuthContext.mockReturnValue({
        authType: 'test-secret',
      });
      mockFetch.mockResolvedValueOnce(
        new Response(
          createSseStream(
            'data: {"type":"data-done","data":{"success":true}}\n\n'
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          }
        )
      );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: 'OpenManager 내부 자료 경로 알려줘',
              },
            ],
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const events = await readSseEvents(response);
      expect(events[0]).toMatchObject({
        type: 'data-developer-context',
        data: {
          mode: 'developer',
          meta: {
            session: null,
            stream: null,
            system: {
              cloudRunHealthy: true,
              disclosureMode: 'developer',
            },
            rag: null,
          },
        },
      });
      expect(events[1]).toMatchObject({
        type: 'data-done',
        data: { success: true },
      });
    });

    it('일반 guest full access 컨텍스트는 developer disclosure mode를 전달하지 않는다', async () => {
      mockGetAPIAuthContext.mockReturnValue({ authType: 'guest' });

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: 'OpenManager 내부 자료 경로 알려줘',
              },
            ],
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body.internalDisclosureMode).toBeUndefined();
    });

    it('analysisMode 값도 Cloud Run으로 전달해야 함', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'RCA 분석' }],
            analysisMode: 'thinking',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body).toMatchObject({
        sessionId: 'session-1234',
        analysisMode: 'thinking',
      });
    });

    it('localRouteDecision을 Cloud Run으로 안전하게 전달해야 함', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            localRouteDecision: {
              intent: 'chat',
              executionPath: 'stream',
              complexity: 'simple',
              reasonCodes: ['complexity_below_threshold'],
              ruleVersion: '2026-05-03-v1',
              decidedBy: 'frontend',
              providerRawError: 'must not leak',
            },
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body)) as {
        localRouteDecision?: Record<string, unknown>;
      };
      expect(body.localRouteDecision).toMatchObject({
        intent: 'chat',
        executionPath: 'stream',
        complexity: 'simple',
        reasonCodes: ['complexity_below_threshold'],
        ruleVersion: '2026-05-03-v1',
        decidedBy: 'frontend',
      });
      expect(body.localRouteDecision).not.toHaveProperty('providerRawError');
    });

    it('frontend가 아닌 localRouteDecision은 Cloud Run으로 전달하지 않아야 함', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            localRouteDecision: {
              intent: 'chat',
              executionPath: 'stream',
              mode: 'single',
              reasonCodes: ['client_claimed'],
              ruleVersion: '2026-05-03-v1',
              decidedBy: 'cloud-run',
            },
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body)) as {
        localRouteDecision?: Record<string, unknown>;
      };
      expect(body.localRouteDecision).toBeUndefined();
    });

    it('인증 컨텍스트 userId가 있어도 stream state를 저장하지 않아야 함', async () => {
      process.env.AI_RESUMABLE_STREAMS_ENABLED = 'true';
      mockGetAPIAuthContext.mockReturnValueOnce({
        authType: 'supabase',
        userId: 'user-777',
      });

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSaveActiveStreamId).not.toHaveBeenCalled();
    });

    it('인증 컨텍스트 keyFingerprint가 있어도 stream state를 저장하지 않아야 함', async () => {
      process.env.AI_RESUMABLE_STREAMS_ENABLED = 'true';
      mockGetAPIAuthContext.mockReturnValueOnce({
        authType: 'api-key',
        keyFingerprint: 'fp-from-auth',
      });

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
            'x-api-key': 'header-api-key-should-not-win',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSaveActiveStreamId).not.toHaveBeenCalled();
    });

    it('인증 컨텍스트가 없어도 auth_session_id로 stream state를 저장하지 않아야 함', async () => {
      process.env.AI_RESUMABLE_STREAMS_ENABLED = 'true';
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
            cookie: 'auth_session_id=guest-session-xyz; theme=dark',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
          }),
        }
      );

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSaveActiveStreamId).not.toHaveBeenCalled();
    });

    it('긴 대화 이력은 컨텍스트 메시지 수를 제한해야 함', async () => {
      const messages = Array.from({ length: 30 }, (_, idx) => ({
        role: idx % 2 === 0 ? 'user' : 'assistant',
        content: `message-${idx}`,
      }));

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-1234',
          },
          body: JSON.stringify({
            messages,
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body.messages.length).toBeLessThanOrEqual(24);
      expect(body.messages.at(-1)?.content).toBe('message-29');
    });

    it('정규화된 메시지 검증 실패 시 400을 반환해야 함', async () => {
      mockNormalizeMessagesForCloudRun.mockReturnValueOnce([
        { role: 'user', content: '' },
      ]);

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            sessionId: 'session-1234',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: 'Invalid normalized messages',
      });
    });

    it('fetch AbortError 발생 시 신규 stream state 저장 없이 fallback을 반환해야 함', async () => {
      process.env.AI_RESUMABLE_STREAMS_ENABLED = 'true';
      const abortError = new DOMException(
        'The operation was aborted',
        'AbortError'
      );
      mockFetch.mockRejectedValueOnce(abortError);

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-timeout',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 확인' }],
            sessionId: 'session-timeout',
          }),
        }
      );

      const response = await POST(request);

      // AbortError now returns graceful fallback stream (status 200)
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Fallback-Response')).toBe('true');
      expect(response.headers.get('X-AI-Latency-Ms')).toMatch(/^\d+$/);
      expect(mockSaveActiveStreamId).not.toHaveBeenCalled();
      expect(mockClearActiveStreamId).not.toHaveBeenCalled();
      expect(mockClearStream).not.toHaveBeenCalled();
    });

    it('Cloud Run 5xx 응답 시 fallback 스트림을 반환해야 함', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Internal Server Error', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-5000',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '메모리 사용량 원인 분석' }],
            sessionId: 'session-5000',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Fallback-Response')).toBe('true');
      expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
      expect(response.headers.get('X-AI-Source')).toBe('fallback');
      expect(response.headers.get('X-AI-Latency-Ms')).toMatch(/^\d+$/);
      expect(mockExecuteWithCircuitBreakerAndFallback).toHaveBeenCalledWith(
        'cloud-run-supervisor-stream',
        expect.any(Function),
        expect.any(Function)
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const streamText = await response.text();
      expect(streamText).toContain('AI 분석 서비스가 일시적으로 불안정합니다');
      expect(streamText).toContain('cloud_run_500');
      expect(streamText).not.toContain('⚠️ 오류:');
    });

    it('Circuit Breaker OPEN 상태면 Cloud Run fetch를 생략하고 fallback 스트림을 반환해야 함', async () => {
      mockExecuteWithCircuitBreakerAndFallback.mockImplementationOnce(
        async (
          _serviceName: string,
          _primaryFn: () => Promise<unknown>,
          fallbackFn: () => Promise<unknown> | unknown
        ) => ({
          data: await fallbackFn(),
          source: 'fallback',
        })
      );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-cb-open',
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '장애 원인 분석' }],
            sessionId: 'session-cb-open',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Fallback-Response')).toBe('true');
      expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
      expect(response.headers.get('X-AI-Source')).toBe('fallback');
      expect(mockExecuteWithCircuitBreakerAndFallback).toHaveBeenCalledWith(
        'cloud-run-supervisor-stream',
        expect.any(Function),
        expect.any(Function)
      );
      expect(mockFetch).not.toHaveBeenCalled();

      const streamText = await response.text();
      expect(streamText).toContain('circuit_breaker_open');
      expect(streamText).toContain('AI 분석 서비스가 일시적으로 불안정합니다');
    });

    it('첫 질의(warmup 헤더)에서 Cloud Run 5xx면 1회 재시도 후 성공할 수 있어야 함', async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response('Service Unavailable', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        )
        .mockResolvedValueOnce(
          new Response(createSseStream(), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          })
        );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-retry-1',
            'X-AI-First-Query': '1',
            'X-AI-Warmup-Started-At': String(Date.now()),
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: '서버 상태 요약해줘' }],
            sessionId: 'session-retry-1',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Fallback-Response')).toBeNull();
      expect(response.headers.get('X-AI-Source')).toBe('cloud-run');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('첫 질의(warmup 헤더)에서 TimeoutError면 1회 재시도 후 성공할 수 있어야 함', async () => {
      mockFetch
        .mockRejectedValueOnce(
          new DOMException('The operation timed out', 'TimeoutError')
        )
        .mockResolvedValueOnce(
          new Response(createSseStream(), {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream' },
          })
        );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-Id': 'session-timeout-retry',
            'X-AI-First-Query': '1',
            'X-AI-Warmup-Started-At': String(Date.now()),
          },
          body: JSON.stringify({
            messages: [
              { role: 'user', content: '첫 질의 타임아웃 재시도 확인' },
            ],
            sessionId: 'session-timeout-retry',
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Fallback-Response')).toBeNull();
      expect(response.headers.get('X-AI-Source')).toBe('cloud-run');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
