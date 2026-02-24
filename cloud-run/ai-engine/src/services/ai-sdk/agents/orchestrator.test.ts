/**
 * Orchestrator Tests
 *
 * Unit tests for multi-agent orchestration system.
 * Tests mode selection, fallback chains, and response handling.
 *
 * @version 4.0.0 - Updated for BaseAgent/AgentFactory pattern (v7.1.0)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock model-provider before imports
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

// Avoid external Upstash network calls in orchestrator tests.
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

// Mock AI SDK - now we mock the actual 'ai' package
vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({
    text: 'Mock response from generateText',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    finishReason: 'stop',
    toolCalls: [],
    steps: [],
  })),
  generateObject: vi.fn(async () => ({
    object: {
      selectedAgent: 'NLQ Agent',
      confidence: 0.86,
      reasoning: 'Mock reasoning for agent selection',
    },
    usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
    finishReason: 'stop',
  })),
  streamText: vi.fn(() => ({
    textStream: (async function* () {
      yield 'Mock ';
      yield 'streaming ';
      yield 'response';
    })(),
    fullStream: (async function* () {
      yield { type: 'text-delta', textDelta: 'Mock ' };
      yield { type: 'text-delta', textDelta: 'streaming ' };
      yield { type: 'text-delta', textDelta: 'response' };
      yield { type: 'finish', finishReason: 'stop' };
    })(),
    toDataStreamResponse: vi.fn(),
    usage: Promise.resolve({ promptTokens: 100, completionTokens: 50, totalTokens: 150 }),
  })),
  stepCountIs: vi.fn(() => () => false),
  hasToolCall: vi.fn(() => () => false),
}));

// Mock tools - include all tools from agent-configs
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
  // AI SDK v6 Best Practice: finalAnswer for graceful loop termination
  finalAnswer: { execute: vi.fn() },
  // Incident evaluation tools
  evaluateIncidentReport: { execute: vi.fn() },
  validateReportStructure: { execute: vi.fn() },
  scoreRootCauseConfidence: { execute: vi.fn() },
  refineRootCauseAnalysis: { execute: vi.fn() },
  enhanceSuggestedActions: { execute: vi.fn() },
  extendServerCorrelation: { execute: vi.fn() },
  incidentEvaluationTools: {},
  // Vision tools (Gemini Flash-Lite)
  analyzeScreenshot: { execute: vi.fn() },
  analyzeLargeLog: { execute: vi.fn() },
  searchWithGrounding: { execute: vi.fn() },
  analyzeUrlContent: { execute: vi.fn() },
  visionTools: {},
  visionToolDescriptions: {},
}));

// ============================================================================
// Tests for AI SDK v6 Native Architecture
// ============================================================================

describe('Multi-Agent Orchestrator (AI SDK v6 Native)', { timeout: 60000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Configuration', () => {
    it('should have all required agent configs defined', async () => {
      const { AGENT_CONFIGS } = await import('./config');

      expect(AGENT_CONFIGS['NLQ Agent']).toBeDefined();
      expect(AGENT_CONFIGS['NLQ Agent'].name).toBe('NLQ Agent');

      expect(AGENT_CONFIGS['Analyst Agent']).toBeDefined();
      expect(AGENT_CONFIGS['Analyst Agent'].name).toBe('Analyst Agent');

      expect(AGENT_CONFIGS['Reporter Agent']).toBeDefined();
      expect(AGENT_CONFIGS['Reporter Agent'].name).toBe('Reporter Agent');

      expect(AGENT_CONFIGS['Advisor Agent']).toBeDefined();
      expect(AGENT_CONFIGS['Advisor Agent'].name).toBe('Advisor Agent');
    });

    it('should have getAgentConfig function working', async () => {
      const { getAgentConfig } = await import('./config');

      const nlqConfig = getAgentConfig('NLQ Agent');
      expect(nlqConfig).toBeDefined();
      expect(nlqConfig?.instructions).toBeDefined();
      expect(nlqConfig?.tools).toBeDefined();
    });
  });

  describe('executeMultiAgent', () => {
    it('should execute and return successful response', async () => {
      const { executeMultiAgent } = await import('./orchestrator');

      const result = await executeMultiAgent({
        messages: [{ role: 'user', content: '서버 상태 알려줘' }],
        sessionId: 'test-session-1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.response).toBeDefined();
        expect(result.metadata).toBeDefined();
        expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return error for empty messages', async () => {
      const { executeMultiAgent } = await import('./orchestrator');

      const result = await executeMultiAgent({
        messages: [],
        sessionId: 'test-session-2',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_REQUEST');
        expect(result.error).toBe('No user message found');
      }
    });

    it('should return error for no user message', async () => {
      const { executeMultiAgent } = await import('./orchestrator');

      const result = await executeMultiAgent({
        messages: [{ role: 'assistant', content: 'Hello' }],
        sessionId: 'test-session-3',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_REQUEST');
      }
    });

    it('should track usage metrics', async () => {
      const { executeMultiAgent } = await import('./orchestrator');

      const result = await executeMultiAgent({
        messages: [{ role: 'user', content: 'CPU 상태 확인' }],
        sessionId: 'test-session-4',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.usage).toBeDefined();
        expect(result.usage.promptTokens).toBeGreaterThanOrEqual(0);
        expect(result.usage.completionTokens).toBeGreaterThanOrEqual(0);
        expect(result.usage.totalTokens).toBeGreaterThanOrEqual(0);
      }
    });

    it('should propagate ragSources from tool results', async () => {
      const { executeMultiAgent } = await import('./orchestrator');
      const { generateText } = await import('ai');

      vi.mocked(generateText).mockResolvedValueOnce({
        text: 'RAG 기반 응답',
        usage: { inputTokens: 42, outputTokens: 18, totalTokens: 60 },
        finishReason: 'stop',
        toolCalls: [],
        steps: [
          {
            toolCalls: [{ toolName: 'searchKnowledgeBase' }],
            toolResults: [
              {
                toolName: 'searchKnowledgeBase',
                result: {
                  similarCases: [
                    {
                      title: 'Redis OOM incident',
                      similarity: 0.91,
                      sourceType: 'knowledge-base',
                      category: 'incident',
                    },
                  ],
                },
              },
            ],
          },
        ],
      } as unknown as Awaited<ReturnType<typeof generateText>>);

      const result = await executeMultiAgent({
        messages: [{ role: 'user', content: '메모리 장애 원인 알려줘' }],
        sessionId: 'test-session-rag-sources',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.ragSources).toBeDefined();
        expect(result.ragSources).toHaveLength(1);
        expect(result.ragSources?.[0]?.title).toBe('Redis OOM incident');
        expect(result.ragSources?.[0]?.similarity).toBe(0.91);
      }
    });
  });
});

describe('Agent Model Selection (AI SDK v6)', () => {
  it('NLQ agent config should have getModel function', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['NLQ Agent'].getModel).toBeDefined();
    expect(typeof AGENT_CONFIGS['NLQ Agent'].getModel).toBe('function');
  });

  it('Analyst agent config should have getModel function', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Analyst Agent'].getModel).toBeDefined();
  });

  it('Reporter agent config should have getModel function', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Reporter Agent'].getModel).toBeDefined();
  });

  it('Advisor agent config should have getModel function', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Advisor Agent'].getModel).toBeDefined();
  });

  it('isAgentAvailable should return true when model is available', async () => {
    const { isAgentAvailable } = await import('./config');
    // With mocked providers, agents should be available
    expect(isAgentAvailable('NLQ Agent')).toBe(true);
    expect(isAgentAvailable('Analyst Agent')).toBe(true);
  });
});

describe('Agent Tools Configuration (AI SDK v6)', () => {
  it('NLQ agent should have server metric tools', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['NLQ Agent'].tools).toBeDefined();
    expect(Object.keys(AGENT_CONFIGS['NLQ Agent'].tools).length).toBeGreaterThan(0);
  });

  it('Analyst agent should have analysis tools', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Analyst Agent'].tools).toBeDefined();
    expect(Object.keys(AGENT_CONFIGS['Analyst Agent'].tools).length).toBeGreaterThan(0);
  });

  it('Reporter agent should have reporting tools', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Reporter Agent'].tools).toBeDefined();
    expect(Object.keys(AGENT_CONFIGS['Reporter Agent'].tools).length).toBeGreaterThan(0);
  });

  it('Advisor agent should have knowledge tools', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Advisor Agent'].tools).toBeDefined();
    expect(Object.keys(AGENT_CONFIGS['Advisor Agent'].tools).length).toBeGreaterThan(0);
  });
});

describe('Agent Pattern Matching (AI SDK v6)', () => {
  it('NLQ agent should have matchPatterns for server queries', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['NLQ Agent'].matchPatterns).toBeDefined();
    expect(AGENT_CONFIGS['NLQ Agent'].matchPatterns.length).toBeGreaterThan(0);
    expect(AGENT_CONFIGS['NLQ Agent'].matchPatterns).toContain('서버');
  });

  it('Analyst agent should have matchPatterns for analysis', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Analyst Agent'].matchPatterns).toBeDefined();
    expect(AGENT_CONFIGS['Analyst Agent'].matchPatterns).toContain('이상');
    expect(AGENT_CONFIGS['Analyst Agent'].matchPatterns).toContain('예측');
  });

  it('Reporter agent should have matchPatterns for reports', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Reporter Agent'].matchPatterns).toBeDefined();
    expect(AGENT_CONFIGS['Reporter Agent'].matchPatterns).toContain('보고서');
    expect(AGENT_CONFIGS['Reporter Agent'].matchPatterns).toContain('장애');
  });

  it('Advisor agent should have matchPatterns for troubleshooting', async () => {
    const { AGENT_CONFIGS } = await import('./config');
    expect(AGENT_CONFIGS['Advisor Agent'].matchPatterns).toBeDefined();
    expect(AGENT_CONFIGS['Advisor Agent'].matchPatterns).toContain('해결');
    expect(AGENT_CONFIGS['Advisor Agent'].matchPatterns).toContain('명령어');
  });
});

// ============================================================================
// executeMultiAgentStream Tests
// ============================================================================

describe('executeMultiAgentStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should yield text_delta events for streaming', async () => {
    const { executeMultiAgentStream } = await import('./orchestrator');

    const events: Array<{ type: string; data: unknown }> = [];

    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '서버 상태 알려줘' }],
      sessionId: 'stream-test-1',
    })) {
      events.push(event);
    }

    // Should have at least one text_delta event
    const textDeltas = events.filter((e) => e.type === 'text_delta');
    expect(textDeltas.length).toBeGreaterThan(0);

    // Should end with done event
    const doneEvents = events.filter((e) => e.type === 'done');
    expect(doneEvents.length).toBe(1);
  });

  it('should yield error event for empty messages', async () => {
    const { executeMultiAgentStream } = await import('./orchestrator');

    const events: Array<{ type: string; data: unknown }> = [];

    for await (const event of executeMultiAgentStream({
      messages: [],
      sessionId: 'stream-test-2',
    })) {
      events.push(event);
    }

    // Should have error event
    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents.length).toBe(1);
    expect((errorEvents[0].data as { code: string }).code).toBe('INVALID_REQUEST');
  });

  it('should yield error event for no user message', async () => {
    const { executeMultiAgentStream } = await import('./orchestrator');

    const events: Array<{ type: string; data: unknown }> = [];

    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'assistant', content: 'Hello' }],
      sessionId: 'stream-test-3',
    })) {
      events.push(event);
    }

    const errorEvents = events.filter((e) => e.type === 'error');
    expect(errorEvents.length).toBe(1);
  });

  it('should include metadata in done event', async () => {
    const { executeMultiAgentStream } = await import('./orchestrator');

    const events: Array<{ type: string; data: unknown }> = [];

    for await (const event of executeMultiAgentStream({
      messages: [{ role: 'user', content: '서버 상태' }],
      sessionId: 'stream-test-5',
    })) {
      events.push(event);
    }

    const doneEvent = events.find((e) => e.type === 'done');
    expect(doneEvent).toBeDefined();

    const doneData = doneEvent?.data as {
      success: boolean;
      metadata?: { durationMs: number };
    };
    expect(doneData.success).toBe(true);
    expect(doneData.metadata?.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// preFilterQuery Tests
// ============================================================================

describe('preFilterQuery', () => {
  it('should suggest NLQ Agent for server queries', async () => {
    const { preFilterQuery } = await import('./orchestrator');

    const result = preFilterQuery('web-server-01 CPU 상태 알려줘');

    expect(result.suggestedAgent).toBe('NLQ Agent');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should suggest Analyst Agent for analysis queries', async () => {
    const { preFilterQuery } = await import('./orchestrator');

    const result = preFilterQuery('이상 징후 탐지해줘');

    expect(result.suggestedAgent).toBe('Analyst Agent');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should suggest Reporter Agent for report queries', async () => {
    const { preFilterQuery } = await import('./orchestrator');

    const result = preFilterQuery('장애 보고서 생성해줘');

    expect(result.suggestedAgent).toBe('Reporter Agent');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should suggest Advisor Agent for troubleshooting queries', async () => {
    const { preFilterQuery } = await import('./orchestrator');

    const result = preFilterQuery('CPU 높을 때 해결 방법 알려줘');

    expect(result.suggestedAgent).toBe('Advisor Agent');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should return direct response for greeting', async () => {
    const { preFilterQuery } = await import('./orchestrator');

    const result = preFilterQuery('안녕하세요');

    expect(result.shouldHandoff).toBe(false);
    expect(result.directResponse).toBeDefined();
    expect(result.directResponse?.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Agent Config Tests
// ============================================================================

describe('Agent Config Exports', () => {
  it('should have config getters for each agent', async () => {
    const { getNlqAgentConfig } = await import('./nlq-agent');
    const { getAnalystAgentConfig } = await import('./analyst-agent');
    const { getReporterAgentConfig } = await import('./reporter-agent');
    const { getAdvisorAgentConfig } = await import('./advisor-agent');

    expect(getNlqAgentConfig()).toBeDefined();
    expect(getAnalystAgentConfig()).toBeDefined();
    expect(getReporterAgentConfig()).toBeDefined();
    expect(getAdvisorAgentConfig()).toBeDefined();
  });
});

// ============================================================================
// Vision Agent Config Integration Tests (v7.1.0)
// Note: Detailed isVisionQuery tests are in vision-agent.test.ts
// Note: Detailed AgentFactory tests are in agent-factory.test.ts
// ============================================================================

describe('Vision Agent Config Integration', () => {
  it('should have Vision Agent config in AGENT_CONFIGS', async () => {
    const { AGENT_CONFIGS } = await import('./config');

    expect(AGENT_CONFIGS['Vision Agent']).toBeDefined();
    expect(AGENT_CONFIGS['Vision Agent'].name).toBe('Vision Agent');
    expect(AGENT_CONFIGS['Vision Agent'].tools).toHaveProperty('analyzeScreenshot');
  });

  it('should have all 7 agent types in AGENT_CONFIGS', async () => {
    const { AGENT_CONFIGS } = await import('./config');

    expect(Object.keys(AGENT_CONFIGS)).toEqual([
      'NLQ Agent',
      'Analyst Agent',
      'Reporter Agent',
      'Advisor Agent',
      'Evaluator Agent',
      'Optimizer Agent',
      'Vision Agent',
    ]);
  });
});
