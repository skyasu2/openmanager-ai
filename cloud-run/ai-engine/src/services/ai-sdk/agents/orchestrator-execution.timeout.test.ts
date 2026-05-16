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
  routingSchema: { parse: vi.fn((value: unknown) => value) },
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
  ORCHESTRATOR_PROVIDER_ORDER: ['cerebras', 'groq', 'mistral'],
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
  generateStructuredOutputWithFallback: (...args: unknown[]) =>
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

describe('executeMultiAgent direct routing contract', () => {
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

  it('direct-routes the suggested agent without non-stream Orchestrator LLM routing', async () => {
    mockExecuteForcedRouting.mockResolvedValueOnce({
      success: true,
      response: 'Reporter direct response',
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

    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteForcedRouting).toHaveBeenCalledWith(
      '서버 상태 분석 그리고 보고서 만들어줘',
      'Reporter Agent',
      expect.any(Number),
      true,
      true,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.finalAgent).toBe('Reporter Agent');
      expect(result.response).toBe('Reporter direct response');
      expect(result.handoffs).toEqual([
        {
          from: 'Direct Router',
          to: 'Reporter Agent',
          reason: 'Direct routing (pre-filter specialist)',
        },
      ]);
    }
  });

  it('uses vision fallback helper for direct Vision Agent routing', async () => {
    const contextModule = await import('./orchestrator-context');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Vision Agent',
      confidence: 0.7,
    });

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

    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteVisionOrFallback).toHaveBeenCalledOnce();
    expect(mockExecuteForcedRouting).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.finalAgent).toBe('Analyst Agent');
      expect(result.handoffs).toEqual([
        {
          from: 'Direct Router',
          to: 'Analyst Agent',
          reason: 'Direct routing (pre-filter specialist)',
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
      null,
      undefined,
      undefined,
      undefined
    );

    const fallbackStatus = events.find((event) => event.type === 'agent_status');
    expect(fallbackStatus).toBeDefined();
    expect((fallbackStatus?.data as { message?: string }).message).toContain(
      'Vision Agent 사용 불가'
    );
  });

  it('routes low-confidence Vision direct stream fallback to Analyst Agent when vision provider is unavailable', async () => {
    const contextModule = await import('./orchestrator-context');
    const routingModule = await import('./orchestrator-routing');

    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Vision Agent',
      confidence: 0.7,
    });

    vi.mocked(routingModule.getAgentConfig).mockImplementation((agentName: string) => {
      if (agentName === 'Vision Agent') {
        return { getModel: vi.fn(() => null) } as unknown as ReturnType<typeof routingModule.getAgentConfig>;
      }
      return { getModel: vi.fn(() => ({ modelId: 'analyst-model' })) } as unknown as ReturnType<typeof routingModule.getAgentConfig>;
    });

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '저신뢰 Vision direct fallback 확인' }],
      sessionId: 'stream-vision-direct-fallback-test',
      images: [{ data: 'base64', mimeType: 'image/png' }],
    })) {
      events.push(event);
    }

    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteAgentStream).toHaveBeenCalledTimes(1);
    expect(mockExecuteAgentStream).toHaveBeenCalledWith(
      '저신뢰 Vision direct fallback 확인',
      'Analyst Agent',
      expect.any(Number),
      'stream-vision-direct-fallback-test',
      true,
      true,
      [{ data: 'base64', mimeType: 'image/png' }],
      undefined,
      null,
      undefined,
      undefined,
      undefined
    );

    const statusMessages = events
      .filter((event) => event.type === 'agent_status')
      .map((event) => (event.data as { message?: string }).message ?? '');

    expect(statusMessages.some((message) => message.includes('라우팅 타임아웃'))).toBe(false);
    expect(statusMessages.some((message) => message.includes('Vision Agent 사용 불가'))).toBe(true);
  });

  it('adds routingDecisionTrace to forced stream done metadata', async () => {
    const contextModule = await import('./orchestrator-context');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Reporter Agent',
      confidence: 0.9,
    });

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '장애 보고서 작성해줘' }],
      sessionId: 'stream-routing-trace-prefilter-source',
    })) {
      events.push(event);
    }

    const doneEvent = events.find((event) => event.type === 'done');
    const doneData = doneEvent?.data as {
      metadata?: {
        routingDecisionTrace?: {
          agentDecision?: {
            source: string;
            selectedAgent?: string;
            reasonCodes: string[];
          };
        };
      };
    };

    expect(doneData.metadata?.routingDecisionTrace?.agentDecision).toMatchObject({
      source: 'pre_filter',
      selectedAgent: 'Reporter Agent',
      reasonCodes: ['agent_source_pre_filter'],
    });
  });

  it('adds deterministic fallback routingDecisionTrace to stream done metadata', async () => {
    const contextModule = await import('./orchestrator-context');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      confidence: 0.5,
    });

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '왜 느려졌는지 분석해줘' }],
      sessionId: 'stream-routing-trace-deterministic-fallback',
    })) {
      events.push(event);
    }

    const doneEvent = events.find((event) => event.type === 'done');
    const doneData = doneEvent?.data as {
      metadata?: {
        routingDecisionTrace?: {
          agentDecision?: {
            source: string;
            selectedAgent?: string;
            confidence?: number;
            reasonCodes: string[];
          };
        };
      };
    };

    expect(doneData.metadata?.routingDecisionTrace?.agentDecision).toMatchObject({
      source: 'deterministic_fallback',
      selectedAgent: 'Metrics Query Agent',
      confidence: 0.5,
      reasonCodes: ['agent_source_deterministic_fallback'],
    });
  });

  it('records pre-filter forced routing source without calling LLM routing', async () => {
    const contextModule = await import('./orchestrator-context');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Reporter Agent',
      confidence: 0.9,
    });
    mockExecuteForcedRouting.mockResolvedValueOnce({
      success: true,
      response: 'Reporter forced response',
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
      messages: [{ role: 'user', content: '장애 보고서 작성해줘' }],
      sessionId: 'routing-trace-prefilter-source',
    });

    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata.routingDecisionTrace?.agentDecision).toMatchObject({
        source: 'pre_filter',
        selectedAgent: 'Reporter Agent',
        reasonCodes: ['agent_source_pre_filter'],
      });
    }
  });

  it('runs high-confidence non-stream forced routing before task decomposition', async () => {
    const contextModule = await import('./orchestrator-context');
    const decompositionModule = await import('./orchestrator-decomposition');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Reporter Agent',
      confidence: 0.9,
    });
    mockExecuteForcedRouting.mockResolvedValueOnce({
      success: true,
      response: 'Reporter forced response',
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
      messages: [{ role: 'user', content: '장애 보고서 작성해줘' }],
      sessionId: 'forced-routing-before-decomposition',
    });

    expect(result.success).toBe(true);
    expect(decompositionModule.decomposeTask).not.toHaveBeenCalled();
    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteForcedRouting).toHaveBeenCalledOnce();
  });

  it('runs high-confidence stream forced routing before task decomposition', async () => {
    const contextModule = await import('./orchestrator-context');
    const decompositionModule = await import('./orchestrator-decomposition');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Reporter Agent',
      confidence: 0.9,
    });

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '장애 보고서 작성해줘' }],
      sessionId: 'stream-forced-routing-before-decomposition',
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'done')).toBe(true);
    expect(decompositionModule.decomposeTask).not.toHaveBeenCalled();
    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteAgentStream).toHaveBeenCalledOnce();
  });

  it('uses low-confidence suggested agent directly without decomposition or LLM routing', async () => {
    const contextModule = await import('./orchestrator-context');
    const decompositionModule = await import('./orchestrator-decomposition');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Reporter Agent',
      confidence: 0.68,
    });
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
      messages: [
        {
          role: 'user',
          content: '서버 상태 분석 결과를 보고서로 정리해줘',
        },
      ],
      sessionId: 'single-subtask-fallback-before-llm',
    });

    expect(result.success).toBe(true);
    expect(decompositionModule.decomposeTask).not.toHaveBeenCalled();
    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteForcedRouting).toHaveBeenCalledWith(
      '서버 상태 분석 결과를 보고서로 정리해줘',
      'Reporter Agent',
      expect.any(Number),
      true,
      true,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined
    );
  });

  it('direct-routes low-confidence non-stream suggestions without Orchestrator LLM or decomposition', async () => {
    const contextModule = await import('./orchestrator-context');
    const decompositionModule = await import('./orchestrator-decomposition');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Reporter Agent',
      confidence: 0.68,
    });
    mockExecuteForcedRouting.mockResolvedValueOnce({
      success: true,
      response: 'Reporter direct response',
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
      messages: [
        {
          role: 'user',
          content: '서버 상태 분석 결과를 보고서로 정리해줘',
        },
      ],
      sessionId: 'direct-low-confidence-non-stream',
    });

    expect(result.success).toBe(true);
    expect(decompositionModule.decomposeTask).not.toHaveBeenCalled();
    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteForcedRouting).toHaveBeenCalledWith(
      '서버 상태 분석 결과를 보고서로 정리해줘',
      'Reporter Agent',
      expect.any(Number),
      true,
      true,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined
    );
    if (result.success) {
      expect(result.metadata.routingDecisionTrace?.agentDecision).toMatchObject({
        source: 'pre_filter',
        selectedAgent: 'Reporter Agent',
        reasonCodes: ['agent_source_pre_filter'],
      });
    }
  });

  it('direct-routes low-confidence stream suggestions without Orchestrator LLM or decomposition', async () => {
    const contextModule = await import('./orchestrator-context');
    const decompositionModule = await import('./orchestrator-decomposition');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      suggestedAgent: 'Advisor Agent',
      confidence: 0.68,
    });

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '장애 대응 순서 알려줘' }],
      sessionId: 'direct-low-confidence-stream',
    })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'done')).toBe(true);
    expect(decompositionModule.decomposeTask).not.toHaveBeenCalled();
    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteAgentStream).toHaveBeenCalledWith(
      '장애 대응 순서 알려줘',
      'Advisor Agent',
      expect.any(Number),
      'direct-low-confidence-stream',
      true,
      true,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined
    );
  });

  it('falls back to Metrics Query Agent when direct routing has no suggested agent', async () => {
    const contextModule = await import('./orchestrator-context');
    const decompositionModule = await import('./orchestrator-decomposition');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      confidence: 0.5,
    });
    mockExecuteForcedRouting.mockResolvedValueOnce({
      success: true,
      response: 'Metrics fallback response',
      handoffs: [],
      finalAgent: 'Metrics Query Agent',
      toolsCalled: [],
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      metadata: {
        provider: 'mock',
        modelId: 'mock-metrics',
        totalRounds: 1,
        handoffCount: 0,
        durationMs: 25,
      },
    });

    const result = await executeMultiAgent({
      messages: [{ role: 'user', content: '이 요청 처리해줘' }],
      sessionId: 'direct-no-suggested-agent',
    });

    expect(result.success).toBe(true);
    expect(decompositionModule.decomposeTask).not.toHaveBeenCalled();
    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteForcedRouting).toHaveBeenCalledWith(
      '이 요청 처리해줘',
      'Metrics Query Agent',
      expect.any(Number),
      true,
      true,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined
    );
    if (result.success) {
      expect(result.metadata.routingDecisionTrace?.agentDecision).toMatchObject({
        source: 'deterministic_fallback',
        selectedAgent: 'Metrics Query Agent',
        reasonCodes: ['agent_source_deterministic_fallback'],
      });
    }
  });

  it('records deterministic fallback source when pre-filter is not decisive', async () => {
    const contextModule = await import('./orchestrator-context');
    vi.mocked(contextModule.preFilterQuery).mockReturnValueOnce({
      shouldHandoff: true,
      confidence: 0.5,
    });
    mockExecuteForcedRouting.mockResolvedValueOnce({
      success: true,
      response: 'Metrics fallback response',
      handoffs: [],
      finalAgent: 'Metrics Query Agent',
      toolsCalled: [],
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      metadata: {
        provider: 'mock',
        modelId: 'mock-analyst',
        totalRounds: 1,
        handoffCount: 0,
        durationMs: 25,
      },
    });

    const result = await executeMultiAgent({
      messages: [{ role: 'user', content: '왜 느려졌는지 분석해줘' }],
      sessionId: 'routing-trace-deterministic-fallback',
    });

    expect(mockGenerateObjectWithFallback).not.toHaveBeenCalled();
    expect(mockExecuteForcedRouting).toHaveBeenCalledWith(
      '왜 느려졌는지 분석해줘',
      'Metrics Query Agent',
      expect.any(Number),
      true,
      true,
      undefined,
      undefined,
      null,
      undefined,
      undefined,
      undefined
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata.routingDecisionTrace?.agentDecision).toMatchObject({
        source: 'deterministic_fallback',
        selectedAgent: 'Metrics Query Agent',
        confidence: 0.5,
        reasonCodes: ['agent_source_deterministic_fallback'],
      });
    }
  });
});
