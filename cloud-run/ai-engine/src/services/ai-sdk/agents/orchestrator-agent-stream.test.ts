import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateText,
  mockStepCountIs,
  mockStreamText,
  mockExecuteReporterWithPipeline,
  mockEvaluateAgentResponseQuality,
  mockStreamTextInChunks,
  mockMarkProviderQuotaCooldown,
  mockReconcileProviderQuotaReservation,
  mockReserveProviderQuota,
} = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockStepCountIs: vi.fn(() => () => false),
  mockStreamText: vi.fn(),
  mockExecuteReporterWithPipeline: vi.fn(),
  mockEvaluateAgentResponseQuality: vi.fn(
    (_agentName: string, text: string) => ({
      responseChars: text.length,
      formatCompliance: true,
      qualityFlags: [],
      latencyTier: 'fast',
    })
  ),
  mockStreamTextInChunks: vi.fn(),
  mockMarkProviderQuotaCooldown: vi.fn(() => Promise.resolve()),
  mockReconcileProviderQuotaReservation: vi.fn(() => Promise.resolve()),
  mockReserveProviderQuota: vi.fn(
    (provider: string, estimatedTokens: number, modelId?: string) =>
      Promise.resolve({
        reserved: true,
        provider,
        modelId,
        estimatedTokens,
        status: {},
      })
  ),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
  streamText: mockStreamText,
  hasToolCall: vi.fn(() => () => false),
  stepCountIs: mockStepCountIs,
  tool: vi.fn((definition: unknown) => definition),
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

vi.mock('../../resilience/quota-tracker', () => ({
  markProviderQuotaCooldown: mockMarkProviderQuotaCooldown,
  reconcileProviderQuotaReservation: mockReconcileProviderQuotaReservation,
  reserveProviderQuota: mockReserveProviderQuota,
}));

vi.mock('./orchestrator-routing', () => ({
  getAgentConfig: vi.fn(() => ({
    instructions: 'Test instructions',
    getModel: vi.fn(() => ({
      model: { provider: 'gemini' },
      provider: 'gemini',
      modelId: 'gemini-vision-model',
    })),
    tools: {
      getServerMetrics: { execute: vi.fn() },
      finalAnswer: { execute: vi.fn() },
    },
  })),
  getAgentProviderOrder: vi.fn(() => ['cerebras', 'groq']),
  getAgentMaxSteps: vi.fn((agentName: string) =>
    agentName === 'Analyst Agent' || agentName === 'Reporter Agent'
      ? 5
      : agentName === 'Vision Agent'
        ? 2
        : 4
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
  evaluateAgentResponseQuality: mockEvaluateAgentResponseQuality,
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

function createTestDataSource() {
  return {
    async snapshot() {
      return {
        timestamp: '2026-05-06T00:00:00+09:00',
        data: {
          servers: [
            { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
            { id: 'api-01', status: 'warning', cpu: 71, memory: 78, disk: 36 },
            { id: 'db-01', status: 'online', cpu: 40, memory: 56, disk: 42 },
          ],
        },
      };
    },
    async history() {
      return [];
    },
  };
}

async function collectEvents(
  query: string,
  dataSource = createTestDataSource(),
  domainId = 'sample-support',
  domainEvidencePrompt?: string
) {
  const events: Array<{ type: string; data: unknown }> = [];
  for await (const event of executeAgentStream(
    query,
    'Metrics Query Agent',
    Date.now(),
    'test-session',
    true,
    true,
    undefined,
    undefined,
    undefined,
    dataSource,
    domainId,
    domainEvidencePrompt
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
    mockEvaluateAgentResponseQuality.mockImplementation(
      (_agentName: string, text: string) => ({
        responseChars: text.length,
        formatCompliance: true,
        qualityFlags: [],
        latencyTier: 'fast',
      })
    );
    mockMarkProviderQuotaCooldown.mockResolvedValue(undefined);
    mockReconcileProviderQuotaReservation.mockResolvedValue(undefined);
    mockReserveProviderQuota.mockImplementation(
      (provider: string, estimatedTokens: number, modelId?: string) =>
        Promise.resolve({
          reserved: true,
          provider,
          modelId,
          estimatedTokens,
          status: {},
        })
    );
    mockStreamTextInChunks.mockImplementation(function* (text: string) {
      yield { type: 'text_delta', data: text };
    });
  });

  it('adds deterministic domain evidence to the agent system prompt for composite advice queries', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['피크 근거를 포함한 대응 요약'],
        steps: [
          {
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [
              {
                toolName: 'finalAnswer',
                result: { answer: '피크 근거를 포함한 대응 요약' },
              },
            ],
          },
        ],
      })
    );

    await collectEvents(
      '최근 하루 load 피크 시간과 대응 방법 알려줘',
      createTestDataSource(),
      'openmanager-monitoring',
      [
        '[결정적 monitoring 피크 지표 근거]',
        '최고 시간대: 2026-05-12 03:50',
        '최고값: 16.58',
        '위 수치와 시간대를 바꾸지 말고, 첫 문장에 결론을 답하세요.',
      ].join('\n')
    );

    const firstCall = mockStreamText.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };

    expect(firstCall.messages?.[0]?.content).toContain(
      '[결정적 monitoring 피크 지표 근거]'
    );
    expect(firstCall.messages?.[0]?.content).toContain(
      '최고 시간대: 2026-05-12 03:50'
    );
    expect(firstCall.messages?.[1]?.content).toBe(
      '최근 하루 load 피크 시간과 대응 방법 알려줘'
    );
  });

  it('injects Analyst anomaly prefetch evidence into stream system prompt', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['사전 수집된 근거로 분석했습니다.'],
        steps: [
          {
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [
              {
                toolName: 'finalAnswer',
                result: { answer: '사전 수집된 근거로 분석했습니다.' },
              },
            ],
          },
        ],
      })
    );

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeAgentStream(
      '전체 장애 원인을 분석해줘',
      'Analyst Agent',
      Date.now(),
      'analyst-session',
      true,
      true,
      undefined,
      undefined,
      undefined,
      createTestDataSource(),
      'openmanager-monitoring'
    )) {
      events.push(event);
    }

    const firstCall = mockStreamText.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };

    expect(firstCall.messages?.[0]?.content).toContain(
      'Analyst precomputed anomaly evidence'
    );
    expect(firstCall.messages?.[0]?.content).toContain(
      'Do not call detectAnomaliesAllServers again'
    );
    expect(events.some((event) => event.type === 'done')).toBe(true);
  });

  it('uses native multimodal prompting without tool loop for Vision image attachments', async () => {
    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['스크린샷 분석 결과'],
        steps: [],
      })
    );

    const events: Array<{ type: string; data: unknown }> = [];
    for await (const event of executeAgentStream(
      '첨부된 Playwright 스크린샷을 분석해줘',
      'Vision Agent',
      Date.now(),
      'vision-session',
      false,
      false,
      [{ data: 'data:image/png;base64,abc', mimeType: 'image/png' }],
      undefined,
      undefined,
      createTestDataSource(),
      'openmanager-monitoring'
    )) {
      events.push(event);
    }

    const firstCall = mockStreamText.mock.calls[0]?.[0] as {
      tools?: unknown;
      stopWhen?: unknown;
    };

    expect(firstCall.tools).toBeUndefined();
    expect(firstCall.stopWhen).toBeUndefined();
    expect(events.some((event) => event.type === 'text_delta')).toBe(true);
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
    expect(mockStepCountIs).toHaveBeenCalledWith(4);
    expect(mockStreamText.mock.calls[0]?.[0]).toMatchObject({
      maxOutputTokens: 2048,
      maxRetries: 0,
    });
    expect(
      (
        doneEvent?.data as {
          metadata: {
            agentLoop?: {
              implementation: string;
              maxSteps: number;
              maxOutputTokens: number;
              sdkMaxRetries: number;
              stepsExecuted: number;
            };
          };
        }
      ).metadata.agentLoop
    ).toEqual({
      implementation: 'core-stream-text',
      maxSteps: 4,
      maxOutputTokens: 2048,
      sdkMaxRetries: 0,
      stepsExecuted: 1,
    });
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

  it('skips a stream provider before streamText when quota admission blocks it', async () => {
    mockReserveProviderQuota.mockImplementation(
      (provider: string, estimatedTokens: number, modelId?: string) =>
        Promise.resolve({
          reserved: provider !== 'cerebras',
          provider,
          modelId,
          estimatedTokens,
          status: {},
          reason: provider === 'cerebras' ? 'minute_request_threshold' : undefined,
        })
    );
    mockStreamText.mockReturnValueOnce(
      createStreamResult({
        chunks: ['Groq 대체 응답'],
        steps: [
          {
            toolCalls: [{ toolName: 'finalAnswer' }],
            toolResults: [
              {
                toolName: 'finalAnswer',
                result: { answer: 'Groq 대체 응답' },
              },
            ],
          },
        ],
      })
    );

    const events = await collectEvents('최근 에러 로그 보여줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('Groq 대체 응답');
    expect(mockStreamText).toHaveBeenCalledTimes(1);
    expect(mockStreamText.mock.calls[0]?.[0]).toMatchObject({
      model: { provider: 'groq' },
    });

    const retryStatusEvent = events.find((event) => event.type === 'agent_status');
    expect(retryStatusEvent?.data).toMatchObject({
      agent: 'Metrics Query Agent',
      status: 'processing',
      message: 'cerebras 쿼터 보호로 대안 모델로 전환 중...',
    });

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
    expect(doneData.metadata.fallbackReason).toBe('rate_limit');
    expect(doneData.metadata.providerAttempts).toMatchObject([
      {
        provider: 'cerebras',
        modelId: 'cerebras-model',
        error: 'QUOTA_ADMISSION:minute_request_threshold',
      },
      {
        provider: 'groq',
        modelId: 'groq-model',
      },
    ]);
  });

  it('marks provider cooldown when streamText returns queue_exceeded', async () => {
    mockStreamText.mockImplementation(({ model }: { model: { provider: string } }) => {
      if (model.provider === 'cerebras') {
        throw new Error('429 queue_exceeded');
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
    });

    const events = await collectEvents('최근 에러 로그 보여줘');

    expect(events.some((event) => event.type === 'done')).toBe(true);
    expect(mockMarkProviderQuotaCooldown).toHaveBeenCalledWith(
      'cerebras',
      'cerebras-model',
      '429 queue_exceeded'
    );
    expect(mockReconcileProviderQuotaReservation).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'cerebras' }),
      0
    );
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

  it('repairs heading-only tool-grounded responses with summarization fallback', async () => {
    mockStreamText.mockReturnValueOnce(
      createStreamResult({
        chunks: ['핵심 요약\n분석 결과:'],
        steps: [
          {
            toolCalls: [{ toolName: 'getServerMetrics' }],
            toolResults: [
              {
                toolName: 'getServerMetrics',
                result: {
                  servers: [
                    {
                      id: 'cache-redis-dc1-01',
                      status: 'warning',
                      cpu: 42,
                      memory: 91,
                      disk: 58,
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
      text: 'cache-redis-dc1-01은 메모리 91%로 임계치에 근접했습니다. 원인은 캐시 적중률 저하 또는 누적된 세션 데이터로 추정됩니다. 즉시 TTL 정리와 큰 키 점검을 권장합니다.',
      usage: { inputTokens: 31, outputTokens: 24, totalTokens: 55 },
    });

    const events = await collectEvents(
      'cache-redis-dc1-01 메모리 사용률이 높은 원인과 즉시 조치안을 알려줘'
    );
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('핵심 요약');
    expect(textPayload).toContain('cache-redis-dc1-01은 메모리 91%');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    expect(mockGenerateText.mock.calls[0]?.[0]).toMatchObject({
      model: { provider: 'groq' },
      maxRetries: 0,
    });

    const doneEvent = events.find((event) => event.type === 'done');
    const doneData = doneEvent?.data as {
      metadata: {
        provider: string;
        usedFallback?: boolean;
        fallbackReason?: string;
        providerAttempts?: Array<{ provider: string; error?: string }>;
      };
    };

    expect(doneData.metadata.provider).toBe('groq');
    expect(doneData.metadata.usedFallback).toBe(true);
    expect(doneData.metadata.fallbackReason).toBe('low_information_response');
    expect(doneData.metadata.providerAttempts).toMatchObject([
      { provider: 'cerebras', error: 'LOW_INFORMATION_RESPONSE' },
      { provider: 'groq' },
    ]);
  });

  it('emits enrichment delta before done when streamed text omits collected metric evidence', async () => {
    mockEvaluateAgentResponseQuality.mockImplementation(
      (_agentName: string, text: string) => ({
        responseChars: text.length,
        formatCompliance: true,
        qualityFlags: text.includes('참고 수치')
          ? []
          : ['MISSING_METRIC_EVIDENCE', 'MISSING_SERVER_REFERENCE'],
        latencyTier: 'fast',
      })
    );
    mockStreamText.mockReturnValueOnce(
      createStreamResult({
        chunks: ['api-01 CPU 87% 상태를 확인했습니다.'],
        steps: [
          {
            toolCalls: [{ toolName: 'getServerMetrics' }],
            toolResults: [
              {
                toolName: 'getServerMetrics',
                result: {
                  servers: [
                    {
                      name: 'api-01',
                      status: 'warning',
                      cpu: 87,
                      memory: 62,
                      disk: 44,
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    );

    const events = await collectEvents('api-01 상태를 근거와 함께 설명해줘');
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('api-01 CPU 87% 상태를 확인했습니다.');
    expect(textPayload).toContain('📊 **참고 수치**: api-01: CPU 87%');
    expect(textPayload).toContain('🖥️ **관련 서버**: api-01');

    const doneEvent = events.find((event) => event.type === 'done');
    const doneData = doneEvent?.data as {
      metadata: {
        qualityFlags?: string[];
        responseChars?: number;
      };
    };
    expect(doneData.metadata.qualityFlags).toEqual([]);
    expect(doneData.metadata.responseChars).toBe(textPayload.length);
    expect(mockGenerateText).not.toHaveBeenCalled();
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
    expect(mockStepCountIs).toHaveBeenCalledWith(5);
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

  it('passes runtime domain id to stream data source context', async () => {
    const snapshot = vi.fn(async () => ({
      timestamp: '2026-05-06T00:00:00+09:00',
      data: {
        servers: [
          { id: 'web-01', status: 'online', cpu: 32, memory: 48, disk: 28 },
        ],
      },
    }));

    mockStreamText.mockReturnValue(
      createStreamResult({
        chunks: ['모델 요약'],
        steps: [],
      })
    );

    const events = await collectEvents(
      '현재 모든 서버의 상태를 요약해줘',
      { snapshot, history: vi.fn(async () => []) },
      'sample-support'
    );

    expect(events.some((event) => event.type === 'done')).toBe(true);
    expect(snapshot.mock.calls[0]?.[0]).toMatchObject({
      domainId: 'sample-support',
      message: '현재 모든 서버의 상태를 요약해줘',
    });
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
      agent: 'Metrics Query Agent',
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
      agent: 'Metrics Query Agent',
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

  it('suppresses raw tool-call JSON text and retries the next provider', async () => {
    mockStreamText.mockImplementation(
      ({ model }: { model: { provider: string } }) => {
        if (model.provider === 'cerebras') {
          return createStreamResult({
            chunks: [
              '{"type":"function","name":"analyzePattern",',
              '"arguments":{"query":"지난 1시간 동안 장애 징후가 있었던 구간만 요약해줘"}}',
            ],
            steps: [],
          });
        }

        return createStreamResult({
          chunks: ['장애 징후 구간은 01:20~01:30 KST이며 네트워크 사용률 상승이 핵심입니다.'],
          steps: [
            {
              toolCalls: [{ toolName: 'finalAnswer' }],
              toolResults: [
                {
                  toolName: 'finalAnswer',
                  result: {
                    answer:
                      '장애 징후 구간은 01:20~01:30 KST이며 네트워크 사용률 상승이 핵심입니다.',
                  },
                },
              ],
            },
          ],
        });
      }
    );

    const events = await collectEvents(
      '지난 1시간 동안 장애 징후가 있었던 구간만 요약해줘'
    );
    const textPayload = events
      .filter((event) => event.type === 'text_delta')
      .map((event) => String(event.data))
      .join('');

    expect(textPayload).toContain('장애 징후 구간은');
    expect(textPayload).not.toContain('"type":"function"');
    expect(textPayload).not.toContain('analyzePattern');
    expect(mockStreamText).toHaveBeenCalledTimes(2);

    const retryStatusEvent = events.find((event) => event.type === 'agent_status');
    expect(retryStatusEvent?.data).toMatchObject({
      agent: 'Metrics Query Agent',
      status: 'processing',
      message: 'cerebras 응답 형식 오류로 대안 모델로 전환 중...',
    });

    const doneEvent = events.find((event) => event.type === 'done');
    const doneData = doneEvent?.data as {
      metadata: {
        provider: string;
        usedFallback?: boolean;
        fallbackReason?: string;
        providerAttempts?: Array<{ provider: string; error?: string }>;
      };
    };
    expect(doneData.metadata.provider).toBe('groq');
    expect(doneData.metadata.usedFallback).toBe(true);
    expect(doneData.metadata.fallbackReason).toBe('raw_tool_call_json');
    expect(doneData.metadata.providerAttempts).toMatchObject([
      { provider: 'cerebras', error: 'RAW_TOOL_CALL_JSON' },
      { provider: 'groq' },
    ]);
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
      'Metrics Query Agent',
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
