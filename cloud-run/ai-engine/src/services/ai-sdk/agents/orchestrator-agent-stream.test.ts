import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateText,
  mockStepCountIs,
  mockStreamText,
  mockExecuteReporterWithPipeline,
  mockStreamTextInChunks,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockStepCountIs: vi.fn(() => () => false),
  mockStreamText: vi.fn(),
  mockExecuteReporterWithPipeline: vi.fn(),
  mockStreamTextInChunks: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  hasToolCall: vi.fn(() => () => false),
  stepCountIs: mockStepCountIs,
}));

vi.mock('../../../lib/ai-sdk-utils', () => ({
  buildMultimodalContent: vi.fn((query: string) => query),
  extractToolResultOutput: vi.fn(
    (toolResult: { result?: unknown; output?: unknown }) =>
      toolResult.result ?? toolResult.output
  ),
}));

vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../lib/text-sanitizer', () => ({
  sanitizeChineseCharacters: vi.fn((text: string) => text),
}));

vi.mock('../../observability/langfuse', () => ({
  createTimeoutSpan: vi.fn(() => ({ complete: vi.fn() })),
  logTimeoutEvent: vi.fn(),
}));

vi.mock('../../resilience/circuit-breaker', () => ({
  getCircuitBreaker: vi.fn(() => ({
    isAllowed: () => true,
    execute: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('./orchestrator-routing', () => ({
  getAgentConfig: vi.fn(() => ({
    instructions: 'Test instructions',
    tools: {
      getServerMetrics: { execute: vi.fn() },
      finalAnswer: { execute: vi.fn() },
    },
  })),
  getAgentProviderOrder: vi.fn(() => ['cerebras', 'groq']),
  getAgentMaxSteps: vi.fn((agentName: string) =>
    agentName === 'Analyst Agent' || agentName === 'Reporter Agent' ? 10 : 7
  ),
  executeReporterWithPipeline: (...args: unknown[]) =>
    mockExecuteReporterWithPipeline(...args),
}));

vi.mock('./orchestrator-context', () => ({
  saveAgentFindingsToContext: vi.fn(() => Promise.resolve()),
}));

vi.mock('./config/agent-model-selectors', () => ({
  selectTextModel: vi.fn(
    (_agentName: string, providers: string[]) => ({
      model: { provider: providers[0] },
      provider: providers[0],
      modelId: `${providers[0]}-model`,
    })
  ),
}));

vi.mock('./orchestrator-web-search', () => ({
  filterToolsByWebSearch: vi.fn((tools: unknown) => tools),
  filterToolsByRAG: vi.fn((tools: unknown) => tools),
}));

vi.mock('./response-quality', () => ({
  evaluateAgentResponseQuality: vi.fn((_agentName: string, text: string) => ({
    responseChars: text.length,
    formatCompliance: true,
    qualityFlags: [],
    latencyTier: 'fast',
  })),
}));

vi.mock('./orchestrator-decomposition', () => ({
  streamTextInChunks: (...args: unknown[]) => mockStreamTextInChunks(...args),
}));

import { executeAgentStream } from './orchestrator-agent-stream';
import { ORCHESTRATOR_CONFIG } from './orchestrator-types';

function createStreamResult(options: {
  chunks?: string[];
  steps?: Array<{
    finishReason?: string;
    toolCalls?: Array<{ toolName: string }>;
    toolResults?: Array<{ toolName: string; result?: unknown; output?: unknown }>;
  }>;
}) {
  return {
    textStream: (async function* () {
      for (const chunk of options.chunks ?? []) {
        yield chunk;
      }
    })(),
    steps: Promise.resolve(
      (options.steps ?? []).map((step) => ({
        finishReason: step.finishReason ?? 'stop',
        toolCalls: step.toolCalls ?? [],
        toolResults: step.toolResults ?? [],
      }))
    ),
    usage: Promise.resolve({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }),
  };
}

async function collectEvents(query: string) {
  const events: Array<{ type: string; data: unknown }> = [];
  for await (const event of executeAgentStream(
    query,
    'NLQ Agent',
    Date.now(),
    'test-session',
    true,
    true
  )) {
    events.push(event);
  }
  return events;
}

describe('executeAgentStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStepCountIs.mockClear();
    mockGenerateText.mockResolvedValue({ text: '' });
    mockStreamTextInChunks.mockImplementation(function* (text: string) {
      yield { type: 'text_delta', data: text };
    });
  });

  it('uses deterministic fallback for starter summary prompts without extra LLM summarization', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['   '],
        steps: [
          {
            toolCalls: [{ toolName: 'getServerLogs' }],
            toolResults: [
              {
                toolName: 'getServerMetrics',
                result: {
                  servers: [
                    { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
                    { id: 'api-01', status: 'warning', cpu: 71, memory: 78, disk: 36 },
                    { id: 'db-01', status: 'online', cpu: 40, memory: 56, disk: 42 },
                  ],
                  alertServers: [
                    {
                      id: 'api-01',
                      status: 'warning',
                      cpu: 71,
                      memory: 78,
                      disk: 36,
                      memoryTrend: 'rising',
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );

    const events = await collectEvents('현재 모든 서버의 상태를 요약해줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('📊 **서버 현황 요약**');
    expect(textPayload).toContain('api-01');
    expect(mockGenerateText).not.toHaveBeenCalled();

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toBeDefined();
    expect((doneEvent?.data as { success: boolean }).success).toBe(true);
    expect(
      (doneEvent?.data as { usage: { totalTokens?: number } }).usage.totalTokens
    ).toBe(15);
    expect(
      (doneEvent?.data as { metadata: { ttfbMs?: number } }).metadata.ttfbMs
    ).toBeTypeOf('number');
    expect(mockStepCountIs).toHaveBeenCalledWith(7);
  });

  it('exposes provider attempts and fallback reason in stream done metadata', async () => {
    mockStreamText
      .mockReturnValueOnce(createStreamResult({ chunks: ['   '] }))
      .mockReturnValueOnce(createStreamResult({ chunks: ['대안 모델 응답'] }));

    const events = await collectEvents('최근 에러 로그 보여줘');
    const doneEvent = events.find((event) => event.type === 'done');
    const doneData = doneEvent?.data as {
      metadata: {
        provider: string;
        usedFallback?: boolean;
        fallbackReason?: string;
        providerAttempts?: Array<{
          provider: string;
          modelId: string;
          error?: string;
        }>;
      };
    };

    expect(doneData.metadata.provider).toBe('groq');
    expect(doneData.metadata.usedFallback).toBe(true);
    expect(doneData.metadata.fallbackReason).toBe('empty_response');
    expect(doneData.metadata.providerAttempts).toMatchObject([
      {
        provider: 'cerebras',
        modelId: 'cerebras-model',
        error: 'EMPTY_RESPONSE',
      },
      {
        provider: 'groq',
        modelId: 'groq-model',
      },
    ]);
  });

  it('delegates empty tool-result summarization to the next provider without same-provider retries', async () => {
    mockStreamText.mockReturnValueOnce(
      createStreamResult({
        chunks: ['   '],
        steps: [
          {
            toolCalls: [{ toolName: 'getServerMetrics' }],
            toolResults: [
              {
                toolName: 'getServerLogs',
                result: {
                  logs: [
                    {
                      serverId: 'api-was-dc1-01',
                      level: 'error',
                      message: 'database connection timeout',
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );
    mockGenerateText.mockResolvedValueOnce({
      text: 'Groq 요약 응답',
      usage: { inputTokens: 21, outputTokens: 8, totalTokens: 29 },
    });

    const events = await collectEvents('최근 에러 로그 기반으로 원인을 분석해줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('Groq 요약 응답');
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    expect(mockStreamText.mock.calls[0]?.[0]).toMatchObject({
      maxRetries: 0,
    });
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText.mock.calls[0]?.[0]).toMatchObject({
      model: { provider: 'groq' },
      maxRetries: 0,
    });

    const doneEvent = events.find((event) => event.type === 'done');
    const doneData = doneEvent?.data as {
      metadata: {
        provider: string;
        modelId: string;
        usedFallback?: boolean;
        fallbackReason?: string;
        providerAttempts?: Array<{ provider: string; error?: string }>;
      };
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    };

    expect(doneData.usage).toEqual({
      promptTokens: 21,
      completionTokens: 8,
      totalTokens: 29,
    });
    expect(doneData.metadata.provider).toBe('groq');
    expect(doneData.metadata.modelId).toBe('groq-model');
    expect(doneData.metadata.usedFallback).toBe(true);
    expect(doneData.metadata.fallbackReason).toBe('empty_response');
    expect(doneData.metadata.providerAttempts).toMatchObject([
      { provider: 'cerebras', error: 'EMPTY_RESPONSE' },
      { provider: 'groq' },
    ]);
  });

  it('keeps expanded stream max steps for Analyst Agent multi-tool workflows', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['분석 결과'],
      })
    );

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeAgentStream(
      '이상 원인을 분석해줘',
      'Analyst Agent',
      Date.now(),
      'test-session',
      true,
      true
    )) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'done')).toBe(true);
    expect(mockStepCountIs).toHaveBeenCalledWith(10);
  });

  it('prefers deterministic summary over streamed model text for parity-sensitive prompts', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['잘못된 요약'],
        steps: [
          {
            toolCalls: [{ toolName: 'getServerMetrics' }],
            toolResults: [
              {
                toolName: 'getServerMetrics',
                result: {
                  servers: [
                    { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
                    { id: 'api-01', status: 'warning', cpu: 71, memory: 78, disk: 36 },
                    { id: 'db-01', status: 'online', cpu: 40, memory: 56, disk: 42 },
                  ],
                },
              },
            ],
          },
        ],
      })
    );

    const events = await collectEvents('현재 모든 서버의 상태를 요약해줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('📊 **서버 현황 요약**');
    expect(textPayload).toContain('전체 3대');
    expect(textPayload).not.toContain('잘못된 요약');
  });

  it('uses current-state deterministic summary when summary prompt has no tool results', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['모델이 도구 없이 만든 요약'],
        steps: [],
      })
    );

    const events = await collectEvents('현재 모든 서버의 상태를 요약해줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('📊 **서버 현황 요약**');
    expect(textPayload).not.toContain('모델이 도구 없이 만든 요약');
  });

  it('retries the next provider when the first provider returns no output', async () => {
    mockStreamText.mockImplementation(
      ({ model }: { model: { provider: string } }) => {
        if (model.provider === 'cerebras') {
          throw new Error('No output generated');
        }

        return createStreamResult({
          chunks: ['정상 응답'],
          steps: [
            {
              toolCalls: [{ toolName: 'finalAnswer' }],
              toolResults: [
                {
                  toolName: 'finalAnswer',
                  result: { answer: '정상 응답' },
                },
              ],
            },
          ],
        });
      }
    );

    const events = await collectEvents('CPU 사용률 알려줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('정상 응답');
    expect(mockStreamText).toHaveBeenCalledTimes(2);

    const retryStatusEvent = events.find((event) => event.type === 'agent_status');
    expect(retryStatusEvent).toBeDefined();
    expect(retryStatusEvent?.data).toMatchObject({
      agent: 'NLQ Agent',
      status: 'processing',
      message: 'cerebras 응답 없음, 대안 모델로 전환 중...',
    });

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toBeDefined();
    expect((doneEvent?.data as { success: boolean }).success).toBe(true);
    expect(
      (doneEvent?.data as { usage: { totalTokens?: number } }).usage.totalTokens
    ).toBe(15);
    expect(
      (doneEvent?.data as { metadata: { ttfbMs?: number } }).metadata.ttfbMs
    ).toBeTypeOf('number');
  });

  it('emits agent_status before retrying the next provider after an empty response', async () => {
    mockStreamText.mockImplementation(
      ({ model }: { model: { provider: string } }) => {
        if (model.provider === 'cerebras') {
          return createStreamResult({
            chunks: ['   '],
            steps: [],
          });
        }

        return createStreamResult({
          chunks: ['대체 모델 응답'],
          steps: [
            {
              toolCalls: [{ toolName: 'finalAnswer' }],
              toolResults: [
                {
                  toolName: 'finalAnswer',
                  result: { answer: '대체 모델 응답' },
                },
              ],
            },
          ],
        });
      }
    );

    const events = await collectEvents('CPU 사용률 알려줘');
    const retryStatusEvent = events.find((event) => event.type === 'agent_status');

    expect(retryStatusEvent).toBeDefined();
    expect(retryStatusEvent?.data).toMatchObject({
      agent: 'NLQ Agent',
      status: 'processing',
      message: 'cerebras 응답 없음, 대안 모델로 전환 중...',
    });

    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('대체 모델 응답');
    expect(mockStreamText).toHaveBeenCalledTimes(2);
  });

  it('emits a threshold-aware slow processing warning for multi-agent streaming', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['지연 응답'],
        steps: [],
      })
    );

    const events: Array<{ type: string; data: unknown }> = [];
    const startTime =
      Date.now() - ORCHESTRATOR_CONFIG.warnThreshold - 1_000;

    for await (const event of executeAgentStream(
      'CPU 사용률 알려줘',
      'NLQ Agent',
      startTime,
      'test-session',
      true,
      true
    )) {
      events.push(event);
    }

    const warningEvent = events.find((event) => event.type === 'warning');
    expect(warningEvent).toBeDefined();
    expect(warningEvent?.data).toMatchObject({
      code: 'SLOW_PROCESSING',
      message: `처리 시간이 ${ORCHESTRATOR_CONFIG.warnThreshold / 1000}초를 초과했습니다.`,
      threshold: ORCHESTRATOR_CONFIG.warnThreshold,
    });
  });

  it('preserves totalTokens when reporter pipeline returns a direct result', async () => {
    mockExecuteReporterWithPipeline.mockResolvedValueOnce({
      success: true,
      response: '리포터 파이프라인 응답',
      handoffs: [{ from: 'Orchestrator', to: 'Reporter Agent', reason: 'Routing' }],
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
        handoffCount: 1,
        durationMs: 30,
      },
    });

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeAgentStream(
      '장애 보고서 만들어줘',
      'Reporter Agent',
      Date.now(),
      'test-session',
      true,
      true
    )) {
      events.push(event);
    }

    const doneEvent = events.find((event) => event.type === 'done');
    expect(doneEvent).toBeDefined();
    expect(mockExecuteReporterWithPipeline).toHaveBeenCalledOnce();
    expect(
      (doneEvent?.data as { usage: { totalTokens?: number } }).usage.totalTokens
    ).toBe(18);
  });

  it('preserves zero totalTokens when all providers end with no output fallback', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('No output generated');
    });

    const events = await collectEvents('CPU 사용률 알려줘');
    const doneEvent = events.find((event) => event.type === 'done');

    expect(doneEvent).toBeDefined();
    expect(
      (doneEvent?.data as { usage: { totalTokens?: number } }).usage.totalTokens
    ).toBe(0);
    expect((doneEvent?.data as { success: boolean }).success).toBe(false);
    expect(
      (doneEvent?.data as { metadata: { ttfbMs?: number } }).metadata.ttfbMs
    ).toBeTypeOf('number');
  });
});
