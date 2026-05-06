import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExecuteSupervisorStream } = vi.hoisted(() => ({
  mockExecuteSupervisorStream: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/model-config', () => ({
  logAPIKeyStatus: vi.fn(),
  validateAPIKeys: vi.fn(() => ({ all: true })),
}));

vi.mock('../services/ai-sdk', () => ({
  executeSupervisor: vi.fn(),
  executeSupervisorStream: mockExecuteSupervisorStream,
  checkSupervisorHealth: vi.fn(() => ({ healthy: true })),
  logProviderStatus: vi.fn(),
  createSupervisorStreamResponse: vi.fn(() => new Response('')),
}));

vi.mock('../services/observability/langfuse-flush', () => ({
  flushLangfuseBestEffort: vi.fn(),
}));

import { supervisorRouter } from './supervisor';

const app = new Hono();
app.route('/supervisor', supervisorRouter);

describe('supervisor internal disclosure mode routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSupervisorStream.mockImplementation(async function* () {
      yield { type: 'text_delta', data: 'ok' };
      yield {
        type: 'done',
        data: { success: true, toolsCalled: [], metadata: {} },
      };
    });
  });

  it('forwards developer disclosure mode through the legacy SSE stream endpoint', async () => {
    const response = await app.request('/supervisor/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: 'OpenManager 내부 자료 경로 알려줘',
          },
        ],
        sessionId: 'session-123',
        internalDisclosureMode: 'developer',
      }),
    });

    expect(response.status).toBe(200);
    await response.text();

    expect(mockExecuteSupervisorStream).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-123',
        internalDisclosureMode: 'developer',
      })
    );
  });
});
