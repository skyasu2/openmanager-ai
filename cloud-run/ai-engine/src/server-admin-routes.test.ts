import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('./lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), level: 'info' },
}));

vi.mock('./lib/error-handler', () => ({
  jsonSuccess: (_c: unknown, payload: unknown) => payload,
}));

vi.mock('./services/ai-sdk/agents', () => ({
  executeMultiAgent: vi.fn(),
  getAvailableAgentsStatus: vi.fn(() => ({ supervisor: true })),
  preFilterQuery: vi.fn(() => ({
    confidence: 0.1,
    shouldHandoff: false,
    suggestedAgent: null,
  })),
}));

vi.mock('./services/resilience/circuit-breaker', () => ({
  getAllCircuitStats: vi.fn(() => ({})),
  resetAllCircuitBreakers: vi.fn(),
}));

vi.mock('./services/observability/langfuse', () => ({
  getLangfuseUsageStatus: vi.fn(() => ({ enabled: true })),
  getLangfuseClientStatus: vi.fn(() => ({
    isOperational: true,
    clientInitialized: true,
    loadAttempted: true,
    hasKeysConfigured: true,
  })),
}));

import { registerAdminRoutes } from './server-admin-routes';

function createApp() {
  const app = new Hono();
  registerAdminRoutes(app, () => true);
  return app;
}

describe('server-admin-routes', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      LANGFUSE_PUBLIC_KEY: 'pk-test',
      LANGFUSE_SECRET_KEY: 'sk-test',
      LANGFUSE_BASE_URL: 'https://langfuse.example.com',
      LANGFUSE_TRACES_TIMEOUT_MS: '100',
    };
    vi.restoreAllMocks();
  });

  it('returns 504 when Langfuse traces request times out', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }) as Promise<Response>
    );

    const res = await createApp().request('/monitoring/traces');

    expect(res.status).toBe(504);
    await expect(res.json()).resolves.toMatchObject({
      error: 'Langfuse API timeout',
    });
  });

  it('exposes Langfuse runtime state on monitoring', async () => {
    const res = await createApp().request('/monitoring');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      langfuse: {
        enabled: true,
        isOperational: true,
        clientInitialized: true,
        loadAttempted: true,
        hasKeysConfigured: true,
      },
    });
  });

  it('sorts and filters traces for diagnostics queries', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          {
            id: 'trace-aux',
            name: 'timeout_monitor_NLQ Agent_stream',
            sessionId: 'session-old',
            input: 'older input',
            output: 'older output',
            metadata: { sampled: true },
            createdAt: '2026-03-17T03:06:00.000Z',
            updatedAt: '2026-03-17T03:06:01.000Z',
          },
          {
            id: 'trace-new',
            name: 'supervisor-execution',
            sessionId: 'session-target',
            input: 'newer input',
            output: 'newer output',
            metadata: { sampled: true },
            createdAt: '2026-03-17T03:05:00.000Z',
            updatedAt: '2026-03-17T03:05:01.000Z',
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await createApp().request('/monitoring/traces?limit=1&q=session-target');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://langfuse.example.com/api/public/traces?limit=100',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringContaining('Basic '),
        }),
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      count: 1,
      fetchedCount: 2,
      requestedLimit: 1,
      query: 'session-target',
      includeAuxiliary: false,
      traces: [
        {
          id: 'trace-new',
          sessionId: 'session-target',
          createdAt: '2026-03-17T03:05:00.000Z',
        },
      ],
    });
  });

  it('can include auxiliary timeout traces when explicitly requested', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        data: [
          {
            id: 'trace-aux',
            name: 'timeout_monitor_NLQ Agent_stream',
            sessionId: 'session-target',
            input: 'input',
            output: 'output',
            metadata: { sampled: true },
            createdAt: '2026-03-17T03:06:00.000Z',
            updatedAt: '2026-03-17T03:06:01.000Z',
          },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await createApp().request('/monitoring/traces?limit=1&q=session-target&includeAuxiliary=true');

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      count: 1,
      includeAuxiliary: true,
      traces: [
        {
          id: 'trace-aux',
          name: 'timeout_monitor_NLQ Agent_stream',
        },
      ],
    });
  });
});
