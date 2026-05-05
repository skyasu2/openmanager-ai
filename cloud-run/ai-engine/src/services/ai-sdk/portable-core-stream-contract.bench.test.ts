import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateUIMessageStream,
  mockCreateUIMessageStreamResponse,
  mockGenerateId,
  mockExecuteSupervisorStream,
  mockFlushLangfuseBestEffort,
} = vi.hoisted(() => ({
  mockCreateUIMessageStream: vi.fn((config: unknown) => config),
  mockCreateUIMessageStreamResponse: vi.fn((params: unknown) => params),
  mockGenerateId: vi.fn(() => 'bench-nonce'),
  mockExecuteSupervisorStream: vi.fn(),
  mockFlushLangfuseBestEffort: vi.fn(async () => undefined),
}));

vi.mock('ai', () => ({
  createUIMessageStream: mockCreateUIMessageStream,
  createUIMessageStreamResponse: mockCreateUIMessageStreamResponse,
  generateId: mockGenerateId,
}));

vi.mock('./supervisor-single-agent', () => ({
  executeSupervisorStream: mockExecuteSupervisorStream,
}));

vi.mock('../observability/langfuse-flush', () => ({
  flushLangfuseBestEffort: mockFlushLangfuseBestEffort,
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { createSupervisorStreamResponse } from './supervisor-stream-response';

describe('portable core stream contract snapshot benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pins UI message stream event shape for text, tool, and done metadata', async () => {
    mockExecuteSupervisorStream.mockReturnValue((async function* () {
      yield {
        type: 'tool_call',
        data: { tool: 'getServerMetrics', status: 'start' },
      };
      yield {
        type: 'tool_result',
        data: { tool: 'getServerMetrics', status: 'done' },
      };
      yield { type: 'text_delta', data: 'CPU 42%' };
      yield {
        type: 'done',
        data: {
          success: true,
          metadata: {
            provider: 'groq',
            modelId: 'groq-model',
          },
        },
      };
    })());

    const request = {
      sessionId: 'portable-stream-bench',
      mode: 'auto' as const,
      messages: [{ role: 'user' as const, content: 'CPU 알려줘' }],
      traceId: 'trace-portable-stream-bench',
    };
    const response = createSupervisorStreamResponse(request) as unknown as {
      stream: {
        execute: (args: {
          writer: { write: (chunk: Record<string, unknown>) => void };
        }) => Promise<void>;
      };
      headers: Record<string, string>;
    };

    const writes: Record<string, unknown>[] = [];
    await response.stream.execute({
      writer: {
        write: (chunk) => {
          writes.push(chunk);
        },
      },
    });

    expect(response.headers).toMatchObject({
      'X-Session-Id': 'portable-stream-bench',
      'X-Stream-Protocol': 'ui-message-stream',
    });
    expect(writes.map((chunk) => chunk.type)).toEqual([
      'data-start',
      'data-mode',
      'data-tool-call',
      'data-tool-result',
      'text-start',
      'text-delta',
      'text-end',
      'data-done',
    ]);
    expect(writes[1]).toMatchObject({
      type: 'data-mode',
      data: {
        mode: 'single',
        assistantPlan: {
          kind: 'chat',
          executionPath: 'stream',
          stream: true,
          job: false,
          decidedBy: 'cloud-run',
        },
      },
    });
    expect(writes.at(-1)).toMatchObject({
      type: 'data-done',
      data: {
        success: true,
        responseSummary: 'CPU 42%',
        metadata: {
          provider: 'groq',
          modelId: 'groq-model',
          routeDecision: {
            intent: 'chat',
            executionPath: 'stream',
            mode: 'single',
            decidedBy: 'cloud-run',
          },
          assistantResult: {
            kind: 'chat',
            status: 'completed',
          },
        },
      },
    });
  });
});
