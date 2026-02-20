import { createHash } from 'crypto';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetActiveStreamId,
  mockClearActiveStreamId,
  mockSaveActiveStreamId,
  mockHasExistingStream,
  mockResumeExistingStream,
  mockCreateNewResumableStream,
  mockClearStream,
  mockExtractLastUserQuery,
  mockNormalizeMessagesForCloudRun,
  mockSecurityCheck,
  mockGetMaxTimeout,
  mockFetch,
  mockGetAPIAuthContext,
  mockGetRouteMaxExecutionMs,
  mockGetFunctionTimeoutReserveMs,
} = vi.hoisted(() => ({
  mockGetActiveStreamId: vi.fn(),
  mockClearActiveStreamId: vi.fn(),
  mockSaveActiveStreamId: vi.fn(),
  mockHasExistingStream: vi.fn(),
  mockResumeExistingStream: vi.fn(),
  mockCreateNewResumableStream: vi.fn(),
  mockClearStream: vi.fn(),
  mockExtractLastUserQuery: vi.fn(),
  mockNormalizeMessagesForCloudRun: vi.fn(),
  mockSecurityCheck: vi.fn(),
  mockGetMaxTimeout: vi.fn(),
  mockFetch: vi.fn(),
  mockGetAPIAuthContext: vi.fn(() => null),
  mockGetRouteMaxExecutionMs: vi.fn(),
  mockGetFunctionTimeoutReserveMs: vi.fn(),
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
}));

vi.mock('@/lib/ai/utils/message-normalizer', () => ({
  extractLastUserQuery: mockExtractLastUserQuery,
  normalizeMessagesForCloudRun: mockNormalizeMessagesForCloudRun,
}));

vi.mock('../../security', () => ({
  securityCheck: mockSecurityCheck,
}));

vi.mock('@/config/ai-proxy.config', () => ({
  getMaxTimeout: mockGetMaxTimeout,
  getRouteMaxExecutionMs: mockGetRouteMaxExecutionMs,
  getFunctionTimeoutReserveMs: mockGetFunctionTimeoutReserveMs,
}));

vi.mock('./stream-state', () => ({
  getActiveStreamId: mockGetActiveStreamId,
  clearActiveStreamId: mockClearActiveStreamId,
  saveActiveStreamId: mockSaveActiveStreamId,
}));

vi.mock('./upstash-resumable', () => ({
  createUpstashResumableContext: () => ({
    hasExistingStream: mockHasExistingStream,
    resumeExistingStream: mockResumeExistingStream,
    createNewResumableStream: mockCreateNewResumableStream,
    clearStream: mockClearStream,
  }),
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

describe('Supervisor Stream V2 Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);

    mockExtractLastUserQuery.mockReturnValue('서버 상태 알려줘');
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
    mockFetch.mockResolvedValue(
      new Response(createSseStream(), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    mockCreateNewResumableStream.mockResolvedValue(createSseStream());

    process.env.CLOUD_RUN_AI_URL = 'https://example-ai.run.app';
    process.env.CLOUD_RUN_API_SECRET = 'test-secret';
  });

  describe('GET /resume', () => {
    it('skip 값이 음수이면 400을 반환해야 함', async () => {
      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2?sessionId=session-123&skip=-1'
      );

      const response = await GET(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'skip must be a non-negative integer',
      });
    });

    it('활성 스트림이 없으면 204를 반환해야 함', async () => {
      mockGetActiveStreamId.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2?sessionId=session-1234'
      );

      const response = await GET(request);

      expect(response.status).toBe(204);
    });

    it('완료된 스트림은 resume 후 세션 매핑을 정리해야 함', async () => {
      mockGetActiveStreamId.mockResolvedValue('stream-abc');
      mockHasExistingStream.mockResolvedValue('completed');
      mockResumeExistingStream.mockResolvedValue(
        createSseStream('data: resumed\n\n')
      );

      const request = new NextRequest(
        'http://localhost/api/ai/supervisor/stream/v2?sessionId=session-1234&skip=2'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Resumed')).toBe('true');
      expect(response.headers.get('X-Stream-Id')).toBe('stream-abc');
      expect(response.headers.get('X-Skip-Chunks')).toBe('2');
      expect(mockClearActiveStreamId).toHaveBeenCalledWith(
        'session-1234',
        expect.any(String)
      );
    });
  });

  it('sessionId가 8자 미만이면 400을 반환해야 함', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/supervisor/stream/v2?sessionId=short'
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'sessionId required (8-128 chars)',
    });
  });

  it('sessionId가 없으면 400을 반환해야 함', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/supervisor/stream/v2'
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'sessionId required (8-128 chars)',
    });
  });

  it('skip이 숫자가 아니면 400을 반환해야 함', async () => {
    const request = new NextRequest(
      'http://localhost/api/ai/supervisor/stream/v2?sessionId=session-1234&skip=abc'
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'skip must be a non-negative integer',
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
    });

    it('Cloud Run v2로 프록시 후 resumable 응답을 반환해야 함', async () => {
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
            enableWebSearch: true,
          }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('x-vercel-ai-ui-message-stream')).toBe('v1');
      expect(response.headers.get('X-Resumable')).toBe('true');
      expect(response.headers.get('X-Session-Id')).toBe('session-1234');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0]?.[0]).toBe(
        'https://example-ai.run.app/api/ai/supervisor/stream/v2'
      );

      const fetchOptions = mockFetch.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(String(fetchOptions.body));
      expect(body).toMatchObject({
        sessionId: 'session-1234',
        enableWebSearch: true,
      });

      expect(mockSaveActiveStreamId).toHaveBeenCalledWith(
        'session-1234',
        expect.any(String),
        expect.any(String)
      );
      expect(mockCreateNewResumableStream).toHaveBeenCalledTimes(1);
    });

    it('인증 컨텍스트 userId가 있으면 ownerKey는 해시 기반 user 키를 사용해야 함', async () => {
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

      const expectedOwnerKey = `user:${createHash('sha256').update('user-777').digest('hex').slice(0, 20)}`;
      expect(mockSaveActiveStreamId).toHaveBeenCalledWith(
        'session-1234',
        expect.any(String),
        expectedOwnerKey
      );
    });

    it('인증 컨텍스트 keyFingerprint가 있으면 헤더보다 우선해야 함', async () => {
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

      expect(mockSaveActiveStreamId).toHaveBeenCalledWith(
        'session-1234',
        expect.any(String),
        'api:fp-from-auth'
      );
    });

    it('인증 컨텍스트가 없으면 auth_session_id 쿠키를 ownerKey로 사용해야 함', async () => {
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

      const expectedOwnerKey = `guest:${createHash('sha256').update('guest-session-xyz').digest('hex').slice(0, 20)}`;
      expect(mockSaveActiveStreamId).toHaveBeenCalledWith(
        'session-1234',
        expect.any(String),
        expectedOwnerKey
      );
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

    it('fetch AbortError 발생 시 스트림 정리 후 타임아웃 에러를 반환해야 함', async () => {
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

      // AbortError returns a UIMessageStream error response (status 200 with error content)
      expect(response.status).toBe(200);
      expect(mockClearActiveStreamId).toHaveBeenCalled();
      expect(mockClearStream).toHaveBeenCalled();
    });
  });
});
