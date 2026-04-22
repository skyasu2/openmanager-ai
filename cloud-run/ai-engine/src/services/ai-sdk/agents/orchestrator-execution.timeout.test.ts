import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExecuteForcedRouting,
  mockGenerateObjectWithFallback,
  mockExecuteVisionOrFallback,
  mockExecuteAgentStream,
} = vi.hoisted(() => ({
  mockExecuteForcedRouting: vi.fn(),
  mockGenerateObjectWithFallback: vi.fn(),
  mockExecuteVisionOrFallback: vi.fn(),
  mockExecuteAgentStream: vi.fn(),
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

vi.mock('./orchestrator-execution-helpers', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('./orchestrator-execution-helpers')>();

  return {
    ...actual,
    buildFastPathResponse: vi.fn(),
    executeVisionOrFallback: (...args: unknown[]) =>
      mockExecuteVisionOrFallback(...args),
    getLastUserQuery: vi.fn(
      (request: { messages?: Array<{ content?: string }> }) =>
        request.messages?.at(-1)?.content ?? null
    ),
    mapOrchestratorErrorCode: vi.fn(() => 'ORCHESTRATOR_TIMEOUT'),
    streamFastPathResponse: vi.fn(),
  };
});

vi.mock('./orchestrator-decomposition', () => ({
  decomposeTask: vi.fn(async () => null),
  executeParallelSubtasks: vi.fn(),
  executeParallelSubtasksStream: vi.fn(),
  executeSequentialSubtasksStream: vi.fn(),
}));

vi.mock('./orchestrator-agent-stream', () => ({
  executeAgentStream: (...args: unknown[]) => mockExecuteAgentStream(...args),
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
import { executeMultiAgentStream } from './orchestrator-execution';

describe('executeMultiAgent timeout contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteVisionOrFallback.mockReset();
    mockExecuteAgentStream.mockImplementation(
      async function* (_query: string, agentName: string) {
        yield {
          type: 'done',
          data: {
            success: true,
            finalAgent: agentName,
            toolsCalled: [],
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            metadata: { durationMs: 1 },
          },
        };
      }
    );
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

  it('uses vision fallback helper when timeout fallback target is Vision Agent', async () => {
    const contextModule = await import('./orchestrator-context');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Vision Agent',
      confidence: 0.7,
    });

    mockGenerateObjectWithFallback.mockRejectedValueOnce(
      new Error('Routing decision timeout after 10000ms')
    );
    mockExecuteVisionOrFallback.mockResolvedValueOnce({
      success: true,
      response: 'Analyst fallback response',
      handoffs: [],
      finalAgent: 'Analyst Agent',
      toolsCalled: [],
      usage: {
        promptTokens: 8,
        completionTokens: 4,
        totalTokens: 12,
      },
      metadata: {
        provider: 'mock',
        modelId: 'mock-analyst',
        totalRounds: 1,
        handoffCount: 0,
        durationMs: 30,
      },
    });

    const result = await executeMultiAgent({
      messages: [{ role: 'user', content: '이 스크린샷 분석해줘' }],
      sessionId: 'timeout-contract-vision-fallback',
      images: [
        {
          mimeType: 'image/png',
          data: 'base64data',
        },
      ],
    });

    expect(mockGenerateObjectWithFallback).toHaveBeenCalledOnce();
    expect(mockExecuteVisionOrFallback).toHaveBeenCalledOnce();
    expect(mockExecuteForcedRouting).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.finalAgent).toBe('Analyst Agent');
      expect(result.handoffs).toEqual([
        {
          from: 'Orchestrator',
          to: 'Analyst Agent',
          reason: 'Fallback routing (routing timeout)',
        },
      ]);
    }
  });

  it('routes Vision forced-stream fallback to Analyst Agent when vision provider is unavailable', async () => {
    const contextModule = await import('./orchestrator-context');
    const routingModule = await import('./orchestrator-routing');

    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Vision Agent',
      confidence: 0.9,
    });

    vi.mocked(routingModule.getAgentConfig).mockImplementation((agentName: string) => {
      if (agentName === 'Vision Agent') {
        return { getModel: vi.fn(() => null) } as unknown as ReturnType<typeof routingModule.getAgentConfig>;
      }
      return { getModel: vi.fn(() => ({ modelId: 'analyst-model' })) } as unknown as ReturnType<typeof routingModule.getAgentConfig>;
    });

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '첨부한 스크린샷 분석해줘' }],
      sessionId: 'stream-vision-fallback-test',
      images: [{ data: 'base64', mimeType: 'image/png' }],
    })) {
      events.push(event);
    }

    expect(mockExecuteAgentStream).toHaveBeenCalledTimes(1);
    expect(mockExecuteAgentStream).toHaveBeenCalledWith(
      '첨부한 스크린샷 분석해줘',
      'Analyst Agent',
      expect.any(Number),
      'stream-vision-fallback-test',
      true,
      true,
      [{ data: 'base64', mimeType: 'image/png' }],
      undefined,
      null
    );

    const fallbackStatus = events.find((event) => event.type === 'agent_status');
    expect(fallbackStatus).toBeDefined();
    expect((fallbackStatus?.data as { message?: string }).message).toContain(
      'Vision Agent 사용 불가'
    );
  });

  it('routes Vision timeout-stream fallback to Analyst Agent when vision provider is unavailable', async () => {
    const contextModule = await import('./orchestrator-context');
    const routingModule = await import('./orchestrator-routing');

    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Vision Agent',
      confidence: 0.7,
    });

    mockGenerateObjectWithFallback.mockRejectedValueOnce(
      new Error('Routing decision timeout after 10000ms')
    );

    vi.mocked(routingModule.getAgentConfig).mockImplementation((agentName: string) => {
      if (agentName === 'Vision Agent') {
        return { getModel: vi.fn(() => null) } as unknown as ReturnType<typeof routingModule.getAgentConfig>;
      }
      return { getModel: vi.fn(() => ({ modelId: 'analyst-model' })) } as unknown as ReturnType<typeof routingModule.getAgentConfig>;
    });

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '라우팅 타임아웃 시 Vision fallback 확인' }],
      sessionId: 'stream-vision-timeout-fallback-test',
      images: [{ data: 'base64', mimeType: 'image/png' }],
    })) {
      events.push(event);
    }

    expect(mockGenerateObjectWithFallback).toHaveBeenCalledTimes(1);
    expect(mockExecuteAgentStream).toHaveBeenCalledTimes(1);
    expect(mockExecuteAgentStream).toHaveBeenCalledWith(
      '라우팅 타임아웃 시 Vision fallback 확인',
      'Analyst Agent',
      expect.any(Number),
      'stream-vision-timeout-fallback-test',
      true,
      true,
      [{ data: 'base64', mimeType: 'image/png' }],
      undefined,
      null
    );

    const statusMessages = events
      .filter((event) => event.type === 'agent_status')
      .map((event) => (event.data as { message?: string }).message ?? '');

    expect(statusMessages.some((message) => message.includes('라우팅 타임아웃'))).toBe(true);
    expect(statusMessages.some((message) => message.includes('Vision Agent 사용 불가'))).toBe(true);
  });
});
