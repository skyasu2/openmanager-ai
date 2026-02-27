/**
 * @vitest-environment node
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetDefaultTimeout,
  mockGetCurrentMaxDuration,
  mockGetFunctionTimeoutReserveMs,
  mockGetMaxFunctionDurationMs,
  mockGetRouteMaxExecutionMs,
  mockGetMinTimeout,
  mockGetMaxTimeout,
  mockClampTimeout,
  mockWithAICache,
  mockExecuteWithCircuitBreakerAndFallback,
  mockCreateFallbackResponse,
  mockIsCloudRunEnabled,
  mockProxyToCloudRun,
  mockSupabaseFrom,
  mockInsert,
  mockDebugInfo,
  mockDebugError,
} = vi.hoisted(() => ({
  mockGetDefaultTimeout: vi.fn(),
  mockGetCurrentMaxDuration: vi.fn(),
  mockGetFunctionTimeoutReserveMs: vi.fn(),
  mockGetMaxFunctionDurationMs: vi.fn(),
  mockGetRouteMaxExecutionMs: vi.fn(),
  mockGetMinTimeout: vi.fn(),
  mockGetMaxTimeout: vi.fn(),
  mockClampTimeout: vi.fn(),
  mockWithAICache: vi.fn(),
  mockExecuteWithCircuitBreakerAndFallback: vi.fn(),
  mockCreateFallbackResponse: vi.fn(),
  mockIsCloudRunEnabled: vi.fn(),
  mockProxyToCloudRun: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockDebugInfo: vi.fn(),
  mockDebugError: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/config/ai-proxy.config', () => ({
  getDefaultTimeout: mockGetDefaultTimeout,
  getCurrentMaxDuration: mockGetCurrentMaxDuration,
  getFunctionTimeoutReserveMs: mockGetFunctionTimeoutReserveMs,
  getMaxFunctionDurationMs: mockGetMaxFunctionDurationMs,
  getRouteMaxExecutionMs: mockGetRouteMaxExecutionMs,
  getMinTimeout: mockGetMinTimeout,
  getMaxTimeout: mockGetMaxTimeout,
  clampTimeout: mockClampTimeout,
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

vi.mock('@/lib/ai-proxy/proxy', () => ({
  isCloudRunEnabled: mockIsCloudRunEnabled,
  proxyToCloudRun: mockProxyToCloudRun,
}));

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
  },
}));

vi.mock('@/types/type-utils', () => ({
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

vi.mock('@/utils/debug', () => ({
  default: {
    info: mockDebugInfo,
    error: mockDebugError,
  },
}));

import { POST } from './route';

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/ai/incident-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/ai/incident-report POST', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockGetDefaultTimeout.mockReturnValue(30000);
    mockGetCurrentMaxDuration.mockReturnValue(60);
    mockGetFunctionTimeoutReserveMs.mockReturnValue(1500);
    mockGetMaxFunctionDurationMs.mockReturnValue(60_000);
    mockGetRouteMaxExecutionMs.mockReturnValue(60_000);
    mockGetMinTimeout.mockImplementation((endpoint: string) =>
      endpoint === 'incident-report' ? 5000 : 3000
    );
    mockGetMaxTimeout.mockImplementation((endpoint: string) =>
      endpoint === 'incident-report' ? 45_000 : 30_000
    );
    mockClampTimeout.mockImplementation((endpoint: string, timeout: number) => {
      const minTimeout = endpoint === 'incident-report' ? 5000 : 3000;
      const maxTimeout = endpoint === 'incident-report' ? 45_000 : 30_000;
      return Math.max(minTimeout, Math.min(maxTimeout, timeout));
    });
    mockIsCloudRunEnabled.mockReturnValue(true);
    mockSupabaseFrom.mockReturnValue({
      insert: mockInsert,
    });
    mockInsert.mockResolvedValue({ error: null });

    mockProxyToCloudRun.mockResolvedValue({
      success: true,
      data: {
        id: 'report-1',
        title: 'CPU 과부하 감지',
        severity: 'high',
        created_at: '2026-02-18T02:30:00.000Z',
      },
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

    mockCreateFallbackResponse.mockReturnValue({
      success: true,
      source: 'fallback',
      message: '인시던트 보고서 생성이 일시적으로 불가능합니다.',
      retryAfter: 30000,
      generatedAt: '2026-02-18T02:30:00.000Z',
      data: {
        source: 'fallback',
        message: '인시던트 보고서 생성이 일시적으로 불가능합니다.',
      },
    });
  });

  it('generate 액션은 캐시를 우회하고 Cloud Run 결과를 반환한다', async () => {
    const response = await POST(
      createPostRequest({ action: 'generate', metrics: [] })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('MISS');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mockWithAICache).not.toHaveBeenCalled();
    expect(mockProxyToCloudRun).toHaveBeenCalledTimes(1);
    expect(data.success).toBe(true);
    expect(data.report?.id).toBe('report-1');
  });

  it('enableRAG 값이 Cloud Run proxy body에 전달되어야 함', async () => {
    await POST(
      createPostRequest({ action: 'generate', metrics: [], enableRAG: true })
    );

    expect(mockProxyToCloudRun).toHaveBeenCalledTimes(1);
    const proxyCall = mockProxyToCloudRun.mock.calls[0];
    expect(proxyCall?.[0]).toMatchObject({
      path: '/api/ai/incident-report',
      body: expect.objectContaining({
        enableRAG: true,
        action: 'generate',
      }),
    });
  });

  it('generate 액션에서 폴백이 발생하면 실패 계약을 반환한다', async () => {
    mockGetDefaultTimeout.mockReturnValue(5000);
    mockProxyToCloudRun.mockResolvedValue({
      success: false,
      error: 'Cloud Run error: 503 - temporarily unavailable',
    });

    mockExecuteWithCircuitBreakerAndFallback
      .mockResolvedValueOnce({
        source: 'fallback',
        data: {
          source: 'fallback',
          message: 'AI 엔진 일시 중단',
          retryAfter: 45000,
        },
      })
      .mockResolvedValueOnce({
        source: 'fallback',
        data: {
          source: 'fallback',
          message: 'AI 엔진 일시 중단',
          retryAfter: 45000,
        },
      });

    const response = await POST(
      createPostRequest({ action: 'generate', metrics: [] })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Fallback-Response')).toBe('true');
    expect(response.headers.get('X-Retry-After')).toBe('45000');
    expect(response.headers.get('X-Retry-Attempt')).toBe('1');
    expect(response.headers.get('X-Direct-Retry-Attempt')).toBe('1');
    expect(response.headers.get('X-Fallback-Reason')).toBe(
      'upstream_unavailable'
    );
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(data.success).toBe(false);
    expect(data.source).toBe('fallback');
    expect(data.report).toBeNull();
    expect(data.message).toBe('AI 엔진 일시 중단');
    expect(data.retryAfter).toBe(45000);
  });

  it('free tier에서는 direct retry 예산이 부족하면 direct retry를 시도하지 않는다', async () => {
    mockGetCurrentMaxDuration.mockReturnValue(10);
    mockGetFunctionTimeoutReserveMs.mockReturnValue(1200);
    mockGetMaxFunctionDurationMs.mockReturnValue(10_000);
    mockGetRouteMaxExecutionMs.mockReturnValue(10_000);
    mockGetDefaultTimeout.mockReturnValue(7_000);

    mockExecuteWithCircuitBreakerAndFallback
      .mockResolvedValueOnce({
        source: 'fallback',
        data: {
          source: 'fallback',
          message: '일시적 오류',
          retryAfter: 30000,
        },
      })
      .mockResolvedValueOnce({
        source: 'fallback',
        data: {
          source: 'fallback',
          message: '일시적 오류',
          retryAfter: 30000,
        },
      });

    const response = await POST(
      createPostRequest({ action: 'generate', metrics: [] })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Direct-Retry-Attempt')).toBe('0');
    expect(mockProxyToCloudRun).not.toHaveBeenCalled();
    expect(response.headers.get('X-Fallback-Response')).toBe('true');
    expect(data.success).toBe(false);
    expect(data.message).toBe('일시적 오류');
  });

  it('generate 액션은 1차 폴백 후 재시도 성공 시 성공 응답을 반환한다', async () => {
    mockExecuteWithCircuitBreakerAndFallback
      .mockResolvedValueOnce({
        source: 'fallback',
        data: {
          source: 'fallback',
          message: '일시적 오류',
          retryAfter: 30000,
        },
      })
      .mockImplementationOnce(
        async (_serviceName: string, primaryFn: () => Promise<unknown>) => ({
          data: await primaryFn(),
          source: 'primary',
        })
      );

    const response = await POST(
      createPostRequest({ action: 'generate', metrics: [] })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Retry-Attempt')).toBe('1');
    expect(response.headers.get('X-Cache')).toBe('MISS');
    expect(response.headers.get('X-Direct-Retry')).toBeNull();
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(data.success).toBe(true);
    expect(data.report?.id).toBe('report-1');
  });

  it('generate 액션은 폴백 2회 이후 direct 재시도로 복구할 수 있다', async () => {
    mockGetDefaultTimeout.mockReturnValue(5000);
    mockExecuteWithCircuitBreakerAndFallback
      .mockResolvedValueOnce({
        source: 'fallback',
        data: {
          source: 'fallback',
          message: '일시적 오류',
          retryAfter: 30000,
        },
      })
      .mockResolvedValueOnce({
        source: 'fallback',
        data: {
          source: 'fallback',
          message: '일시적 오류',
          retryAfter: 30000,
        },
      });

    mockProxyToCloudRun.mockResolvedValue({
      success: true,
      data: {
        id: 'report-direct-retry',
        title: 'Direct retry 성공',
        severity: 'high',
        created_at: '2026-02-18T02:30:00.000Z',
      },
    });

    const response = await POST(
      createPostRequest({ action: 'generate', metrics: [] })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Retry-Attempt')).toBe('1');
    expect(response.headers.get('X-Direct-Retry')).toBe('1');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(data.success).toBe(true);
    expect(data.report?.id).toBe('report-direct-retry');
    expect(mockProxyToCloudRun).toHaveBeenCalledTimes(1);
  });

  it('generate 반복 호출에서도 캐시 경로를 사용하지 않는다', async () => {
    await POST(createPostRequest({ action: 'generate', metrics: [] }));
    await POST(createPostRequest({ action: 'generate', metrics: [] }));

    expect(mockWithAICache).not.toHaveBeenCalled();
    expect(mockProxyToCloudRun).toHaveBeenCalledTimes(2);
  });

  it('non-generate 액션은 캐시 HIT 헤더를 반환한다', async () => {
    mockWithAICache.mockResolvedValueOnce({
      cached: true,
      data: {
        success: true,
        report: { id: 'cached-report-1' },
      },
    });

    const response = await POST(createPostRequest({ action: 'history' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Cache')).toBe('HIT');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mockWithAICache).toHaveBeenCalledTimes(1);
    expect(mockProxyToCloudRun).not.toHaveBeenCalled();
    expect(data.success).toBe(true);
    expect(data.report.id).toBe('cached-report-1');
  });

  it('fallback 메시지 우선순위는 message > data.message > 기본값이다', async () => {
    mockWithAICache
      .mockResolvedValueOnce({
        cached: false,
        data: {
          source: 'fallback',
          data: { source: 'fallback', message: 'data-message-only' },
        },
      })
      .mockResolvedValueOnce({
        cached: false,
        data: {
          source: 'fallback',
          data: {},
        },
      });

    const first = await POST(createPostRequest({ action: 'history' }));
    const firstData = await first.json();
    expect(firstData.message).toBe('data-message-only');

    const second = await POST(createPostRequest({ action: 'history' }));
    const secondData = await second.json();
    expect(secondData.message).toBe(
      '보고서 생성 서비스가 일시적으로 불안정합니다.'
    );
  });
});
