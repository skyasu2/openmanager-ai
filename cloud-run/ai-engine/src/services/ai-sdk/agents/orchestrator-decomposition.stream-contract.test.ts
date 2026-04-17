import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockExecuteForcedRouting,
  mockSaveAgentFindingsToContext,
} = vi.hoisted(() => ({
  mockExecuteForcedRouting: vi.fn(),
  mockSaveAgentFindingsToContext: vi.fn(),
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./orchestrator-context', () => ({
  saveAgentFindingsToContext: (...args: unknown[]) =>
    mockSaveAgentFindingsToContext(...args),
}));

vi.mock('./orchestrator-routing', () => ({
  getOrchestratorModel: vi.fn(() => ({
    model: { modelId: 'test-orchestrator-model' },
    provider: 'cerebras',
    modelId: 'test-orchestrator-model',
  })),
  getAgentConfig: vi.fn(() => ({
    getModel: vi.fn(() => ({ modelId: 'test-agent-model' })),
  })),
  executeForcedRouting: (...args: unknown[]) => mockExecuteForcedRouting(...args),
  ORCHESTRATOR_PROVIDER_ORDER: ['cerebras', 'mistral', 'groq'],
}));

describe('orchestrator decomposition stream contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes totalTokens in parallel stream done usage', async () => {
    const mod = await import('./orchestrator-decomposition');

    mockExecuteForcedRouting
      .mockResolvedValueOnce({
        success: true,
        response: 'NLQ response',
        handoffs: [],
        finalAgent: 'NLQ Agent',
        toolsCalled: ['getServerMetrics'],
        usage: {
          promptTokens: 10,
          completionTokens: 4,
          totalTokens: 14,
        },
        metadata: {
          provider: 'mock',
          modelId: 'mock-nlq',
          totalRounds: 1,
          handoffCount: 0,
          durationMs: 20,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        response: 'Analyst response',
        handoffs: [],
        finalAgent: 'Analyst Agent',
        toolsCalled: ['detectAnomalies'],
        usage: {
          promptTokens: 8,
          completionTokens: 5,
          totalTokens: 13,
        },
        metadata: {
          provider: 'mock',
          modelId: 'mock-analyst',
          totalRounds: 1,
          handoffCount: 0,
          durationMs: 25,
        },
      });

    const events: Array<{ type: string; data: unknown }> = [];

    for await (const event of mod.executeParallelSubtasksStream(
      [
        { task: '서버 상태 조회', agent: 'NLQ Agent' },
        { task: '이상 징후 분석', agent: 'Analyst Agent' },
      ],
      Date.now(),
      true,
      true,
      'stream-contract-session'
    )) {
      events.push(event);
    }

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toBeDefined();
    expect(
      (doneEvent?.data as { usage: { totalTokens?: number } }).usage.totalTokens
    ).toBe(27);
  });

  it('includes totalTokens in sequential stream done usage', async () => {
    const mod = await import('./orchestrator-decomposition');

    mockExecuteForcedRouting
      .mockResolvedValueOnce({
        success: true,
        response: 'Reporter response',
        handoffs: [],
        finalAgent: 'Reporter Agent',
        toolsCalled: ['buildIncidentTimeline'],
        usage: {
          promptTokens: 12,
          completionTokens: 6,
          totalTokens: 18,
        },
        metadata: {
          provider: 'mock',
          modelId: 'mock-reporter',
          totalRounds: 1,
          handoffCount: 0,
          durationMs: 30,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        response: 'Advisor response',
        handoffs: [],
        finalAgent: 'Advisor Agent',
        toolsCalled: ['recommendCommands'],
        usage: {
          promptTokens: 7,
          completionTokens: 3,
          totalTokens: 10,
        },
        metadata: {
          provider: 'mock',
          modelId: 'mock-advisor',
          totalRounds: 1,
          handoffCount: 0,
          durationMs: 22,
        },
      });

    const events: Array<{ type: string; data: unknown }> = [];

    for await (const event of mod.executeSequentialSubtasksStream(
      [
        { task: '장애 타임라인 작성', agent: 'Reporter Agent' },
        { task: '후속 조치 제안', agent: 'Advisor Agent' },
      ],
      Date.now(),
      true,
      true,
      'stream-contract-session'
    )) {
      events.push(event);
    }

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toBeDefined();
    expect(
      (doneEvent?.data as { usage: { totalTokens?: number } }).usage.totalTokens
    ).toBe(28);
  });
});
