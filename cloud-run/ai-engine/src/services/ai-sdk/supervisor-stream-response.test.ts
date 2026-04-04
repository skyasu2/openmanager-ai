import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateUIMessageStream,
  mockCreateUIMessageStreamResponse,
  mockGenerateId,
  mockExecuteSupervisorStream,
  mockResolveSupervisorModeDecision,
  mockBuildSupervisorModeMetadata,
  mockFlushLangfuseBestEffort,
} = vi.hoisted(() => ({
  mockCreateUIMessageStream: vi.fn((config: unknown) => config),
  mockCreateUIMessageStreamResponse: vi.fn((params: unknown) => params),
  mockGenerateId: vi.fn(() => 'nonce-1'),
  mockExecuteSupervisorStream: vi.fn(),
  mockResolveSupervisorModeDecision: vi.fn(() => ({
    requestedMode: 'auto',
    resolvedMode: 'single',
    modeSelectionSource: 'auto_complexity',
    autoSelectedByComplexity: 'single',
  })),
  mockBuildSupervisorModeMetadata: vi.fn((decision: Record<string, unknown>) => ({
    requestedMode: decision.requestedMode,
    resolvedMode: decision.resolvedMode,
    modeSelectionSource: decision.modeSelectionSource,
    ...(decision.autoSelectedByComplexity
      ? { autoSelectedByComplexity: decision.autoSelectedByComplexity }
      : {}),
  })),
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

vi.mock('./supervisor-mode', () => ({
  resolveSupervisorModeDecision: mockResolveSupervisorModeDecision,
  buildSupervisorModeMetadata: mockBuildSupervisorModeMetadata,
}));

vi.mock('../../lib/error-handler', () => ({
  getPublicErrorResponse: vi.fn(() => ({
    code: 'INTERNAL_ERROR',
    message: 'Internal Server Error',
  })),
  sanitizeErrorData: vi.fn((data: Record<string, unknown>) => data),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../observability/langfuse-flush', () => ({
  flushLangfuseBestEffort: mockFlushLangfuseBestEffort,
}));

import { createSupervisorStreamResponse } from './supervisor-stream-response';

describe('createSupervisorStreamResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteSupervisorStream.mockReturnValue((async function* () {
      yield { type: 'text_delta', data: 'CPU 42%' };
      yield {
        type: 'done',
        data: {
          success: true,
          metadata: {
            mode: 'single',
            provider: 'groq',
            modelId: 'groq-model',
            requestedMode: 'auto',
            resolvedMode: 'single',
            modeSelectionSource: 'auto_complexity',
            autoSelectedByComplexity: 'single',
          },
        },
      };
    })());
  });

  it('emits data-mode with mode audit metadata and forwards the original request to stream execution', async () => {
    const request = {
      sessionId: 'session-1',
      mode: 'auto' as const,
      messages: [{ role: 'user' as const, content: 'CPU 알려줘' }],
    };

    const response = createSupervisorStreamResponse(request) as unknown as {
      stream: {
        execute: (args: { writer: { write: (chunk: unknown) => void } }) => Promise<void>;
      };
      headers: Record<string, string>;
    };

    const writes: unknown[] = [];
    await response.stream.execute({
      writer: {
        write: (chunk: unknown) => {
          writes.push(chunk);
        },
      },
    });

    expect(mockExecuteSupervisorStream).toHaveBeenCalledWith(request);
    expect(response.headers).toMatchObject({
      'X-Session-Id': 'session-1',
      'X-Stream-Protocol': 'ui-message-stream',
    });
    expect(writes).toContainEqual({
      type: 'data-mode',
      data: {
        mode: 'single',
        requestedMode: 'auto',
        resolvedMode: 'single',
        modeSelectionSource: 'auto_complexity',
        autoSelectedByComplexity: 'single',
      },
    });
    expect(writes).toContainEqual(
      expect.objectContaining({
        type: 'data-done',
        data: expect.objectContaining({
          success: true,
          responseSummary: 'CPU 42%',
          metadata: expect.objectContaining({
            requestedMode: 'auto',
            resolvedMode: 'single',
            modeSelectionSource: 'auto_complexity',
            autoSelectedByComplexity: 'single',
          }),
        }),
      }),
    );
    expect(mockFlushLangfuseBestEffort).toHaveBeenCalledWith('UIMessageStream');
  });
});
