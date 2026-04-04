import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateText,
  mockStreamText,
  mockExecuteMultiAgent,
  mockGetSupervisorModel,
  mockRecordModelUsage,
  mockIsSingleModeAllowed,
  mockCreateSupervisorTrace,
  mockSelectExecutionMode,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockStreamText: vi.fn(),
  mockExecuteMultiAgent: vi.fn(),
  mockGetSupervisorModel: vi.fn(() => ({
    model: { modelId: 'groq-model' },
    provider: 'groq',
    modelId: 'groq-model',
  })),
  mockRecordModelUsage: vi.fn(async () => undefined),
  mockIsSingleModeAllowed: vi.fn(() => false),
  mockCreateSupervisorTrace: vi.fn(() => ({
    id: 'trace-supervisor-test',
    event: vi.fn(),
    score: vi.fn(),
    generation: vi.fn(),
    span: vi.fn(),
    update: vi.fn(),
  })),
  mockSelectExecutionMode: vi.fn(() => 'multi'),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  stepCountIs: vi.fn(() => () => false),
  hasToolCall: vi.fn(() => () => false),
}));

vi.mock('./agents', () => ({
  executeMultiAgent: mockExecuteMultiAgent,
  executeMultiAgentStream: vi.fn(async function* () {
    yield { type: 'error', data: { code: 'MODEL_UNAVAILABLE', error: 'Orchestrator not available' } };
  }),
}));

vi.mock('./model-provider', () => ({
  getSupervisorModel: mockGetSupervisorModel,
  getVisionAgentModel: vi.fn(() => null),
  recordModelUsage: mockRecordModelUsage,
  logProviderStatus: vi.fn(),
}));

vi.mock('../../config/timeout-config', () => ({
  TIMEOUT_CONFIG: {
    supervisor: { hard: 30_000, hardStreaming: 30_000, warning: 10_000 },
    agent: { hard: 15_000 },
    orchestrator: { hard: 30_000, warning: 10_000, routingDecision: 10_000 },
    subtask: { hard: 15_000 },
  },
}));

vi.mock('../../tools-ai-sdk', () => ({
  allTools: {},
}));

vi.mock('./agents/orchestrator-web-search', () => ({
  filterToolsByRAG: vi.fn((tools: unknown) => tools),
  filterToolsByWebSearch: vi.fn((tools: unknown) => tools),
  resolveWebSearchSetting: vi.fn(() => false),
}));

vi.mock('../../lib/tavily-hybrid-rag', () => ({
  isTavilyAvailable: vi.fn(() => true),
}));

vi.mock('../observability/langfuse', () => ({
  createSupervisorTrace: mockCreateSupervisorTrace,
  logGeneration: vi.fn(),
  logToolCall: vi.fn(),
  finalizeTrace: vi.fn(),
}));

vi.mock('../resilience/circuit-breaker', () => ({
  CircuitOpenError: class CircuitOpenError extends Error {},
  getCircuitBreaker: vi.fn(() => ({
    isAllowed: () => true,
    execute: async (fn: () => Promise<unknown>) => await fn(),
    getStats: () => ({ failures: 0, totalFailures: 0, lastFailure: undefined }),
  })),
}));

vi.mock('../../lib/ai-sdk-utils', () => ({
  extractToolResultOutput: vi.fn((toolResult: { result?: unknown; output?: unknown }) => toolResult.result ?? toolResult.output),
  extractRagSources: vi.fn(() => []),
}));

vi.mock('../../lib/error-handler', () => ({
  getPublicErrorMessage: vi.fn((code: string) => code),
  getPublicErrorResponse: vi.fn(() => ({ code: 'MODEL_ERROR', message: 'MODEL_ERROR' })),
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../lib/config-parser', () => ({
  isSingleModeAllowed: mockIsSingleModeAllowed,
}));

vi.mock('./supervisor-routing', () => ({
  createSystemPrompt: vi.fn(() => 'system-prompt'),
  RETRY_CONFIG: {
    maxRetries: 0,
    retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'MODEL_ERROR'],
    retryDelayMs: 1,
  },
  selectExecutionMode: mockSelectExecutionMode,
  getIntentCategory: vi.fn(() => 'general'),
  createPrepareStep: vi.fn(() => undefined),
}));

vi.mock('./agents/response-quality', () => ({
  evaluateAgentResponseQuality: vi.fn((_agentName: string, text: string) => ({
    responseChars: text.length,
    formatCompliance: true,
    qualityFlags: [],
    latencyTier: 'fast',
  })),
}));

vi.mock('./supervisor-quality-retry', () => ({
  shouldRetryForQuality: vi.fn(() => false),
}));

vi.mock('./supervisor-stream-messages', () => ({
  buildSupervisorStreamMessages: vi.fn((request: { messages: Array<{ role: string; content: string }> }) => request.messages),
  getLastUserQueryText: vi.fn((messages: Array<{ role: string; content: string }>) => messages.find((message) => message.role === 'user')?.content ?? ''),
}));

import { executeSupervisor } from './supervisor-single-agent';
import { executeSupervisorStream } from './supervisor-stream';

describe('supervisor degraded single fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSingleModeAllowed.mockReturnValue(false);
    mockSelectExecutionMode.mockReturnValue('multi');
    mockExecuteMultiAgent.mockResolvedValue({
      success: false,
      code: 'MODEL_UNAVAILABLE',
      error: 'Orchestrator not available',
    });
    mockGenerateText.mockResolvedValue({
      text: 'single fallback response',
      steps: [],
      usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 },
    });
    mockStreamText.mockReturnValue({
      textStream: (async function* () {
        yield 'single fallback stream';
      })(),
      steps: Promise.resolve([]),
      usage: Promise.resolve({ inputTokens: 1, outputTokens: 2, totalTokens: 3 }),
    });
  });

  it('keeps auto low-complexity requests on single-agent path even when degraded single is disallowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(false);
    mockSelectExecutionMode.mockReturnValue('single');

    const result = await executeSupervisor({
      mode: 'auto',
      messages: [{ role: 'user', content: 'CPU 알려줘' }],
      sessionId: 'session-auto-single',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toBe('single fallback response');
      expect(result.metadata.mode).toBe('single');
      expect(result.metadata.provider).toBe('groq');
      expect(result.metadata.requestedMode).toBe('auto');
      expect(result.metadata.resolvedMode).toBe('single');
      expect(result.metadata.modeSelectionSource).toBe('auto_complexity');
      expect(result.metadata.autoSelectedByComplexity).toBe('single');
    }
    expect(mockExecuteMultiAgent).not.toHaveBeenCalled();
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('falls back to single-agent when multi-agent returns MODEL_UNAVAILABLE and degraded single is allowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(true);

    const result = await executeSupervisor({
      mode: 'multi',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-fallback',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response).toBe('single fallback response');
      expect(result.metadata.mode).toBe('single');
      expect(result.metadata.provider).toBe('groq');
      expect(result.metadata.fallback).toBe(true);
      expect(result.metadata.fallbackReason).toBe('multi_agent_model_unavailable');
      expect(result.metadata.requestedMode).toBe('multi');
      expect(result.metadata.resolvedMode).toBe('multi');
      expect(result.metadata.modeSelectionSource).toBe('explicit');
      expect(result.metadata.degradedFromMode).toBe('multi');
      expect(result.metadata.degradedReason).toBe('multi_agent_model_unavailable');
    }
    expect(mockExecuteMultiAgent).toHaveBeenCalledTimes(1);
    expect(mockExecuteMultiAgent).toHaveBeenCalledWith(expect.objectContaining({
      requestedMode: 'multi',
      resolvedMode: 'multi',
      modeSelectionSource: 'explicit',
    }));
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('keeps fail-fast behavior when degraded single is not allowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(false);

    const result = await executeSupervisor({
      mode: 'multi',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-fail-fast',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('MODEL_UNAVAILABLE');
    }
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('falls back to single-agent stream when multi-agent stream emits initial MODEL_UNAVAILABLE error', async () => {
    mockIsSingleModeAllowed.mockReturnValue(true);

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'multi',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-stream-fallback',
    })) {
      events.push(event);
    }

    expect(events[0]).toMatchObject({
      type: 'agent_status',
      data: { status: 'degraded' },
    });
    expect(events).toContainEqual({ type: 'text_delta', data: 'single fallback stream' });
    expect(events.at(-1)).toMatchObject({
      type: 'done',
      data: {
        metadata: {
          mode: 'single',
          provider: 'groq',
          fallback: true,
          fallbackReason: 'multi_agent_model_unavailable',
          requestedMode: 'multi',
          resolvedMode: 'multi',
          modeSelectionSource: 'explicit',
          degradedFromMode: 'multi',
          degradedReason: 'multi_agent_model_unavailable',
        },
      },
    });
  });

  it('keeps original stream error when degraded single is not allowed', async () => {
    mockIsSingleModeAllowed.mockReturnValue(false);

    const events = [];
    for await (const event of executeSupervisorStream({
      mode: 'multi',
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'session-stream-fail-fast',
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'error', data: { code: 'MODEL_UNAVAILABLE', error: 'Orchestrator not available' } },
    ]);
  });
});
