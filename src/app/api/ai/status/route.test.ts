import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetBreaker,
  mockGetHistory,
  mockGetAIStatusSummary,
  mockResetBreaker,
  mockResetAll,
  mockClearHistory,
} = vi.hoisted(() => ({
  mockGetBreaker: vi.fn(),
  mockGetHistory: vi.fn(),
  mockGetAIStatusSummary: vi.fn(),
  mockResetBreaker: vi.fn(),
  mockResetAll: vi.fn(),
  mockClearHistory: vi.fn(),
}));

vi.mock('@/lib/auth/api-auth', () => ({
  withAdminAuth: (handler: unknown) => handler,
}));

vi.mock('@/lib/ai/circuit-breaker', () => ({
  aiCircuitBreaker: {
    getBreaker: mockGetBreaker,
    resetBreaker: mockResetBreaker,
    resetAll: mockResetAll,
  },
  circuitBreakerEvents: {
    getHistory: mockGetHistory,
    clearHistory: mockClearHistory,
  },
  getAIStatusSummary: mockGetAIStatusSummary,
}));

import { GET, POST } from './route';

describe('/api/ai/status route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAIStatusSummary.mockReturnValue({
      circuitBreakers: {},
      recentEvents: [],
      stateStore: 'in-memory',
      stats: {
        totalBreakers: 0,
        openBreakers: 0,
        totalFailures: 0,
        recentFailovers: 0,
        recentRateLimits: 0,
      },
    });
    mockGetBreaker.mockReturnValue({
      getStatus: () => ({
        serviceName: 'groq',
        state: 'CLOSED',
        failures: 0,
        threshold: 3,
        lastFailTime: 0,
      }),
    });
    mockGetHistory.mockReturnValue([
      { type: 'success', service: 'groq', timestamp: 1 },
    ]);
    mockResetBreaker.mockReturnValue(true);
  });

  it('전체 AI circuit breaker 요약을 반환한다', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/ai/status')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      circuitBreakers: {},
      stateStore: 'in-memory',
      stats: { totalBreakers: 0 },
    });
    expect(typeof payload.timestamp).toBe('number');
    expect(mockGetAIStatusSummary).toHaveBeenCalledTimes(1);
  });

  it('service 쿼리가 있으면 해당 breaker 상태와 이벤트만 반환한다', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/ai/status?service=groq&eventLimit=5'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      service: 'groq',
      status: {
        serviceName: 'groq',
        state: 'CLOSED',
      },
      events: [{ type: 'success', service: 'groq', timestamp: 1 }],
    });
    expect(mockGetBreaker).toHaveBeenCalledWith('groq');
    expect(mockGetHistory).toHaveBeenCalledWith({
      service: 'groq',
      limit: 5,
    });
  });

  it('특정 service reset 성공 시 명시적인 메시지를 반환한다', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/ai/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', service: 'groq' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.message).toBe("Circuit breaker for 'groq' has been reset");
    expect(mockResetBreaker).toHaveBeenCalledWith('groq');
  });

  it('존재하지 않는 service reset은 404를 반환한다', async () => {
    mockResetBreaker.mockReturnValueOnce(false);

    const response = await POST(
      new NextRequest('http://localhost/api/ai/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', service: 'missing' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("Service 'missing' not found");
  });

  it('알 수 없는 action은 400을 반환한다', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/ai/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unknown' }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Unknown action: unknown');
    expect(mockResetAll).not.toHaveBeenCalled();
    expect(mockClearHistory).not.toHaveBeenCalled();
  });
});
