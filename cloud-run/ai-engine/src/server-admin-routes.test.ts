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
});
