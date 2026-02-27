/**
 * Orchestrator Decomposition Tests
 *
 * Tests for streaming task decomposition (Collect-then-Stream pattern).
 *
 * @version 4.0.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock model-provider
vi.mock('../model-provider', () => ({
  checkProviderStatus: vi.fn(() => ({
    cerebras: true,
    groq: true,
    mistral: true,
    gemini: true,
  })),
  getCerebrasModel: vi.fn(() => ({ modelId: 'llama-3.3-70b' })),
  getGroqModel: vi.fn(() => ({ modelId: 'llama-3.3-70b-versatile' })),
  getMistralModel: vi.fn(() => ({ modelId: 'mistral-large-3-25-12' })),
  getGeminiFlashLiteModel: vi.fn(() => ({ modelId: 'gemini-2.5-flash-lite' })),
  getVisionAgentModel: vi.fn(() => ({
    model: { modelId: 'gemini-2.5-flash-lite' },
    provider: 'gemini',
    modelId: 'gemini-2.5-flash-lite',
  })),
  logProviderStatus: vi.fn(),
}));

vi.mock('../../../lib/redis-client', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRedisClient: vi.fn(() => null),
    isRedisAvailable: vi.fn(() => false),
    redisGet: vi.fn(async () => null),
    redisSet: vi.fn(async () => false),
    redisDel: vi.fn(async () => false),
    redisDelByPattern: vi.fn(async () => 0),
    resetRedisClient: vi.fn(),
  };
});

vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({
    text: 'Mock response',
    usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    finishReason: 'stop',
    toolCalls: [],
    steps: [],
  })),
  generateObject: vi.fn(async () => ({
    object: {
      selectedAgent: 'NLQ Agent',
      confidence: 0.86,
      reasoning: 'Mock reasoning',
    },
    usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
    finishReason: 'stop',
  })),
  streamText: vi.fn(() => ({
    textStream: (async function* () {
      yield 'Mock streaming response';
    })(),
    steps: Promise.resolve([]),
    usage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
  })),
  stepCountIs: vi.fn(() => () => false),
  hasToolCall: vi.fn(() => () => false),
}));

vi.mock('../../../tools-ai-sdk', () => ({
  getServerMetrics: { execute: vi.fn() },
  getServerMetricsAdvanced: { execute: vi.fn() },
  filterServers: { execute: vi.fn() },
  getServerByGroup: { execute: vi.fn() },
  getServerByGroupAdvanced: { execute: vi.fn() },
  detectAnomalies: { execute: vi.fn() },
  detectAnomaliesAllServers: { execute: vi.fn() },
  predictTrends: { execute: vi.fn() },
  analyzePattern: { execute: vi.fn() },
  correlateMetrics: { execute: vi.fn() },
  findRootCause: { execute: vi.fn() },
  buildIncidentTimeline: { execute: vi.fn() },
  getServerLogs: { execute: vi.fn() },
  searchKnowledgeBase: { execute: vi.fn() },
  searchWeb: { execute: vi.fn() },
  recommendCommands: { execute: vi.fn() },
  finalAnswer: { execute: vi.fn() },
  evaluateIncidentReport: { execute: vi.fn() },
  validateReportStructure: { execute: vi.fn() },
  scoreRootCauseConfidence: { execute: vi.fn() },
  refineRootCauseAnalysis: { execute: vi.fn() },
  enhanceSuggestedActions: { execute: vi.fn() },
  extendServerCorrelation: { execute: vi.fn() },
  incidentEvaluationTools: {},
  analyzeScreenshot: { execute: vi.fn() },
  analyzeLargeLog: { execute: vi.fn() },
  searchWithGrounding: { execute: vi.fn() },
  analyzeUrlContent: { execute: vi.fn() },
  visionTools: {},
  visionToolDescriptions: {},
}));

describe('streamTextInChunks', { timeout: 90000 }, () => {
  it('should split text into chunks of specified size', async () => {
    const mod = await import('./orchestrator-decomposition');

    const text = 'Hello World! This is a test.';
    const events = [...mod.streamTextInChunks(text, 10)];

    expect(events.length).toBe(3);
    expect(events[0]).toEqual({ type: 'text_delta', data: 'Hello Worl' });
    expect(events[1]).toEqual({ type: 'text_delta', data: 'd! This is' });
    expect(events[2]).toEqual({ type: 'text_delta', data: ' a test.' });
  });

  it('should handle empty text', async () => {
    const mod = await import('./orchestrator-decomposition');

    const events = [...mod.streamTextInChunks('', 80)];
    expect(events.length).toBe(0);
  });

  it('should handle text shorter than chunk size', async () => {
    const mod = await import('./orchestrator-decomposition');

    const events = [...mod.streamTextInChunks('Short', 80)];
    expect(events.length).toBe(1);
    expect(events[0].data).toBe('Short');
  });
});

describe('unifyResults', () => {
  it('should return single agent response without wrapping', async () => {
    const mod = await import('./orchestrator-decomposition');

    const result = mod.unifyResults([
      { agent: 'NLQ Agent', response: 'Server status OK' },
    ]);

    expect(result).toBe('Server status OK');
  });

  it('should combine multiple agent results with headers', async () => {
    const mod = await import('./orchestrator-decomposition');

    const result = mod.unifyResults([
      { agent: 'NLQ Agent', response: 'Status data' },
      { agent: 'Analyst Agent', response: 'Analysis result' },
    ]);

    expect(result).toContain('# 종합 분석 결과');
    expect(result).toContain('## NLQ 분석');
    expect(result).toContain('Status data');
    expect(result).toContain('## Analyst 분석');
    expect(result).toContain('Analysis result');
  });

  it('should return fallback for empty results', async () => {
    const mod = await import('./orchestrator-decomposition');

    const result = mod.unifyResults([]);
    expect(result).toBe('결과를 생성할 수 없습니다.');
  });
});

describe('decomposeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null for simple queries', async () => {
    const mod = await import('./orchestrator-decomposition');

    const result = await mod.decomposeTask('서버 상태');
    expect(result).toBeNull();
  });
});

describe('executeMultiAgentStream with decomposition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should stream text_delta events for simple queries', async () => {
    const mod = await import('./orchestrator-execution');

    const events: Array<{ type: string; data: unknown }> = [];

    for await (const event of mod.executeMultiAgentStream({
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'decomp-test-1',
    })) {
      events.push(event);
    }

    const textDeltas = events.filter((e) => e.type === 'text_delta');
    expect(textDeltas.length).toBeGreaterThan(0);

    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents.length).toBe(1);
  });
});
