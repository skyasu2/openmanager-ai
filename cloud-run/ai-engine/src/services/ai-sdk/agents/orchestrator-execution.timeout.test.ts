import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExecuteForcedRouting,
  mockGenerateObjectWithFallback,
} = vi.hoisted(() => ({
  mockExecuteForcedRouting: vi.fn(),
  mockGenerateObjectWithFallback: vi.fn(),
}));

vi.mock('./schemas', () => ({
  routingSchema: {},
  getAgentFromRouting: vi.fn(() => null),
}));

vi.mock('./context-store', () => ({
  getContextSummary: vi.fn(async () => null),
  getOrCreateSessionContext: vi.fn(async () => ({ handoffs: [] })),
  recordHandoffEvent: vi.fn(async () => undefined),
}));

vi.mock('./orchestrator-types', () => ({
  ORCHESTRATOR_CONFIG: {
    timeout: 90_000,
    hardTimeout: 90_000,
    warnThreshold: 60_000,
    forcedRoutingConfidence: 0.85,
    fallbackRoutingConfidence: 0.65,
  },
  ORCHESTRATOR_INSTRUCTIONS: 'test instructions',
  buildRoutingPrompt: (query: string) => query,
}));

vi.mock('./orchestrator-web-search', () => ({
  resolveRAGSetting: vi.fn(() => true),
  resolveWebSearchSetting: vi.fn(() => true),
}));

vi.mock('./orchestrator-context', () => ({
  preFilterQuery: vi.fn(() => ({
    shouldHandoff: true,
    suggestedAgent: 'Reporter Agent',
    confidence: 0.68,
  })),
  saveAgentFindingsToContext: vi.fn(async () => undefined),
}));

vi.mock('./orchestrator-routing', () => ({
  getOrchestratorModel: vi.fn(() => ({
    model: { modelId: 'test-orchestrator-model' },
    provider: 'cerebras',
    modelId: 'test-orchestrator-model',
  })),
  getAgentConfig: vi.fn(() => ({ getModel: vi.fn(() => ({ modelId: 'reporter-model' })) })),
  executeForcedRouting: (...args: unknown[]) => mockExecuteForcedRouting(...args),
  executeWithAgentFactory: vi.fn(),
  recordHandoff: vi.fn(),
  getRecentHandoffs: vi.fn(() => []),
  ORCHESTRATOR_PROVIDER_ORDER: ['cerebras', 'mistral', 'groq'],
}));

vi.mock('../../../config/timeout-config', () => ({
  TIMEOUT_CONFIG: {
    orchestrator: {
      routingDecision: 10_000,
    },
  },
}));

vi.mock('./response-quality', () => ({
  evaluateAgentResponseQuality: vi.fn(() => ({
    responseChars: 24,
    formatCompliance: true,
    qualityFlags: [],
    latencyTier: 'fast',
  })),
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./orchestrator-execution-helpers', () => ({
  buildFastPathResponse: vi.fn(),
  executeVisionOrFallback: vi.fn(),
  getLastUserQuery: vi.fn((request: { messages?: Array<{ content?: string }> }) =>
    request.messages?.at(-1)?.content ?? null
  ),
  mapOrchestratorErrorCode: vi.fn(() => 'ORCHESTRATOR_TIMEOUT'),
  streamFastPathResponse: vi.fn(),
}));

vi.mock('./orchestrator-decomposition', () => ({
  decomposeTask: vi.fn(async () => null),
  executeParallelSubtasks: vi.fn(),
  executeParallelSubtasksStream: vi.fn(),
  executeSequentialSubtasksStream: vi.fn(),
}));

vi.mock('./orchestrator-agent-stream', () => ({
  executeAgentStream: vi.fn(),
}));

vi.mock('./orchestrator-object-fallback', () => ({
  generateObjectWithFallback: (...args: unknown[]) =>
    mockGenerateObjectWithFallback(...args),
}));

vi.mock('../../observability/langfuse', () => ({
  createSupervisorTrace: vi.fn(() => ({
    id: 'trace-timeout-test',
    update: vi.fn(),
    score: vi.fn(),
    generation: vi.fn(),
    span: vi.fn(),
    event: vi.fn(),
  })),
  finalizeTrace: vi.fn(),
}));

import { executeMultiAgent } from './orchestrator-execution';

describe('executeMultiAgent timeout contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the suggested agent when non-stream routing times out', async () => {
    mockGenerateObjectWithFallback.mockRejectedValueOnce(
      new Error('Routing decision timeout after 10000ms')
    );
    mockExecuteForcedRouting.mockResolvedValueOnce({
      success: true,
      response: 'Reporter fallback response',
      handoffs: [],
      finalAgent: 'Reporter Agent',
      toolsCalled: [],
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      metadata: {
        provider: 'mock',
        modelId: 'mock-reporter',
        totalRounds: 1,
        handoffCount: 0,
        durationMs: 25,
      },
    });

    const result = await executeMultiAgent({
      messages: [{ role: 'user', content: '서버 상태 분석 그리고 보고서 만들어줘' }],
      sessionId: 'timeout-contract-test',
    });

    expect(mockGenerateObjectWithFallback).toHaveBeenCalledOnce();
    expect(mockExecuteForcedRouting).toHaveBeenCalledWith(
      '서버 상태 분석 그리고 보고서 만들어줘',
      'Reporter Agent',
      expect.any(Number),
      true,
      true,
      undefined,
      undefined,
      null
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.finalAgent).toBe('Reporter Agent');
      expect(result.response).toBe('Reporter fallback response');
      expect(result.handoffs).toEqual([
        {
          from: 'Orchestrator',
          to: 'Reporter Agent',
          reason: 'Fallback routing (routing timeout)',
        },
      ]);
    }
  });
});
